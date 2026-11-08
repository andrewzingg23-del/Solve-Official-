import {
  COMPONENT_KINDS, DEFAULT_EXPRESSION,
  type PersonalView, type SpaceComponent, type SpaceDocument,
  type SpaceOperation, type SpaceProposal, type VisualExpression,
} from "./contract";

export class SpaceValidationError extends Error {}
const safeId = (s: unknown): s is string =>
  typeof s === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(s);
const safeText = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.length <= 160;
const validAccent = (s: unknown): s is string =>
  typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
const isRegion = (s: unknown): s is SpaceComponent["region"] =>
  s === "main" || s === "side" || s === "footer";
const isKind = (s: unknown): s is SpaceComponent["kind"] =>
  COMPONENT_KINDS.some(k => k === s);

export function validateExpressionPatch(patch: Partial<VisualExpression>): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new SpaceValidationError("Invalid expression");
  for (const [key, value] of Object.entries(patch)) {
    if (key === "mode" && (value === "light" || value === "dark")) continue;
    if (key === "accent" && validAccent(value)) continue;
    if (key === "surface" && (value === "solid" || value === "glass")) continue;
    if (key === "density" && (value === "compact" || value === "comfortable" || value === "spacious")) continue;
    if (key === "artworkAssetId" && (value === undefined || safeId(value))) continue;
    throw new SpaceValidationError("Unsupported expression property: " + key);
  }
}

function validateComponent(component: SpaceComponent): void {
  if (!component || !safeId(component.id) || !isKind(component.kind) ||
      !safeText(component.title) || !isRegion(component.region) ||
      (component.sourceId !== undefined && !safeId(component.sourceId))) {
    throw new SpaceValidationError("Invalid component");
  }
  if (Object.keys(component).some(key => !["id","kind","title","region","sourceId"].includes(key))) {
    throw new SpaceValidationError("Unexpected component property");
  }
}

/** Pure preview compiler. Persisting a result requires separate server authorization. */
export function applySpaceProposal(document: SpaceDocument, proposal: SpaceProposal): SpaceDocument {
  if (document.schemaVersion !== 1 || !safeId(document.spaceId) || !Number.isSafeInteger(document.revision) || document.revision < 0) {
    throw new SpaceValidationError("Unsupported Space document");
  }
  if (!safeText(document.name) || !Array.isArray(document.components) || document.components.length > 100 ||
      document.components.some(c => { try { validateComponent(c); return false; } catch { return true; } }) ||
      new Set(document.components.map(c => c.id)).size !== document.components.length) {
    throw new SpaceValidationError("Invalid existing Space components");
  }
  validateExpressionPatch(document.expression);
  if (proposal.spaceId !== document.spaceId || proposal.baseRevision !== document.revision) {
    throw new SpaceValidationError("Stale or mismatched Space revision");
  }
  if (!Array.isArray(proposal.operations) || proposal.operations.length > 32) {
    throw new SpaceValidationError("Invalid operation batch");
  }
  const next: SpaceDocument = {
    ...document, components: document.components.map(c => ({...c})),
    expression: {...document.expression},
  };
  for (const operation of proposal.operations) {
    if (operation.type === "add-component") {
      validateComponent(operation.component);
      if (next.components.length >= 100 || next.components.some(c => c.id === operation.component.id)) {
        throw new SpaceValidationError("Duplicate component or Space limit reached");
      }
      next.components.push({...operation.component});
    } else if (operation.type === "move-component") {
      if (!isRegion(operation.region)) throw new SpaceValidationError("Invalid region");
      const target = next.components.find(c => c.id === operation.componentId);
      if (!target) throw new SpaceValidationError("Unknown component");
      target.region = operation.region;
    } else if (operation.type === "remove-component") {
      if (!next.components.some(c => c.id === operation.componentId)) throw new SpaceValidationError("Unknown component");
      next.components = next.components.filter(c => c.id !== operation.componentId);
    } else if (operation.type === "set-expression") {
      validateExpressionPatch(operation.patch);
      next.expression = {...next.expression, ...operation.patch};
    } else {
      throw new SpaceValidationError("Unsupported operation");
    }
  }
  next.revision += 1;
  return next;
}

/** Personal visual preferences never modify shared state or permissions. */
export function resolvePersonalView(document: SpaceDocument, view?: PersonalView) {
  if (view && view.spaceId !== document.spaceId) throw new SpaceValidationError("View belongs to another Space");
  const override = view?.expression || {};
  validateExpressionPatch(override);
  if (view && (!safeId(view.actorId) || !Array.isArray(view.hiddenComponentIds ?? []) ||
      (view.hiddenComponentIds ?? []).length > 100 ||
      (view.hiddenComponentIds ?? []).some(id => !safeId(id)))) {
    throw new SpaceValidationError("Invalid personal view");
  }
  const hidden = new Set(view?.hiddenComponentIds || []);
  return {
    spaceId: document.spaceId,
    revision: document.revision,
    name: document.name,
    expression: {...DEFAULT_EXPRESSION, ...document.expression, ...override},
    components: document.components.filter(c => !hidden.has(c.id)).map(c => ({...c})),
  };
}
