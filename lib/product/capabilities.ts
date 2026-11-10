// What a person can do to one resource, here and now (docs/architecture/2026-11-10-reusable-foundation.md §7).
//
// One small contract instead of a product per kind of thing: each capability says which resources it
// applies to, which kernel capability it needs, and who provides it. The screen offers only what
// `actionsFor` returns, so nobody is shown a control they can't use — but the screen is never the
// authority: the server action asks the kernel, and the kernel's answer (`require_allowed`) is final.
// The same list can be handed to the connector, so an outside AI sees the same actions a person does.

export type ResourceKind = "text" | "photo" | "link";

/** The kernel capabilities this person holds in the Space the resource lives in. */
export type Held = ReadonlySet<string>;

export type Capability = {
  id: "revise";
  /** What the person sees. */
  label: string;
  appliesTo: (resource: { kind: ResourceKind }) => boolean;
  /** The kernel capability the act needs; the kernel checks it again on every write. */
  requires: string;
  /** Who performs it. "solve" is the kernel itself; providers (a calendar, a code host) come later. */
  provider: "solve";
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "revise",
    label: "Edit",
    // Text pieces only for now: a photo's caption and a link are their own kinds and get their own
    // capability when they're built, rather than a control that half works.
    appliesTo: resource => resource.kind === "text",
    requires: "world.entity.write",
    provider: "solve",
  },
];

/** The kernel capabilities a member's role carries in a Space, as the kernel grants them. */
export function heldInSpace(role: "owner" | "editor" | "viewer" | null): Held {
  if (role === "owner" || role === "editor") return new Set(["kernel.read", "world.entity.write"]);
  if (role === "viewer") return new Set(["kernel.read"]);
  return new Set();
}

/** What this person may do to this resource. Empty means: show no controls. */
export function actionsFor(resource: { kind: ResourceKind }, held: Held): Capability[] {
  return CAPABILITIES.filter(c => c.appliesTo(resource) && (held.has(c.requires) || held.has("*")));
}
