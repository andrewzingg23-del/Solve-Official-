/** SOLVE living Space contract. Data and authority are separate from appearance. */
export const COMPONENT_KINDS = ["projects", "tasks", "calendar", "notes", "connection", "generated-app"] as const;
export type ComponentKind = typeof COMPONENT_KINDS[number];
export type SpaceComponent = {
  id: string;
  kind: ComponentKind;
  title: string;
  region: "main" | "side" | "footer";
  sourceId?: string;
};
export type VisualExpression = {
  mode: "light" | "dark";
  accent: string;
  surface: "solid" | "glass";
  density: "compact" | "comfortable" | "spacious";
  artworkAssetId?: string;
};
export type SpaceDocument = {
  schemaVersion: 1;
  spaceId: string;
  revision: number;
  name: string;
  components: SpaceComponent[];
  expression: VisualExpression;
};
export type PersonalView = {
  spaceId: string;
  actorId: string;
  expression?: Partial<VisualExpression>;
  hiddenComponentIds?: string[];
};
export type SpaceOperation =
  | { type: "add-component"; component: SpaceComponent }
  | { type: "move-component"; componentId: string; region: SpaceComponent["region"] }
  | { type: "remove-component"; componentId: string }
  | { type: "set-expression"; patch: Partial<VisualExpression> };
export type SpaceProposal = {
  spaceId: string;
  baseRevision: number;
  operations: SpaceOperation[];
};
export const DEFAULT_EXPRESSION: VisualExpression = {
  mode: "light", accent: "#303030", surface: "solid", density: "comfortable",
};
