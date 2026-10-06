// Per-user bot avatar: face + name, saved on Supabase auth user_metadata.
// Guests (gate is OFF) get the default face and cannot save.
// Pure module: safe to import from client components and tests.

export interface AvatarPreset {
  id: string;
  label: string;
  src: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "host", label: "Host", src: "/avatars/host.webp" },
  { id: "operator", label: "Operator", src: "/avatars/operator.webp" },
  { id: "entity", label: "Entity", src: "/avatars/entity.webp" },
  { id: "sage", label: "Sage", src: "/avatars/sage.webp" },
  { id: "ember", label: "Ember", src: "/avatars/ember.webp" },
  { id: "monk", label: "Monk", src: "/avatars/monk.webp" },
];

export interface BotAvatar {
  face: string;
  name: string;
}

export const DEFAULT_AVATAR: BotAvatar = { face: "host", name: "" };

export function isValidFace(face: string): boolean {
  return AVATAR_PRESETS.some((p) => p.id === face);
}

export function faceSrc(face: string): string {
  return AVATAR_PRESETS.find((p) => p.id === face)?.src ?? AVATAR_PRESETS[0].src;
}

export function sanitizeBotName(name: string): string {
  return name.trim().slice(0, 40);
}

// Read the user's saved avatar from user_metadata, with safe fallbacks for
// guests, missing metadata, and corrupted values.
export function getBotAvatar(user: { user_metadata?: Record<string, unknown> } | null): BotAvatar {
  const raw = user?.user_metadata?.bot_avatar;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_AVATAR };
  const rec = raw as Record<string, unknown>;
  const face = typeof rec.face === "string" && isValidFace(rec.face) ? rec.face : DEFAULT_AVATAR.face;
  const name = typeof rec.name === "string" ? sanitizeBotName(rec.name) : "";
  return { face, name };
}
