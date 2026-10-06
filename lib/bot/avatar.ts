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

// The blank slate: every bot starts as a mannequin (NBA 2K style). Not in the
// gallery grid — it's the starting state you customize away from.
export const BLANK_FACE: AvatarPreset = { id: "blank", label: "Blank", src: "/avatars/blank.webp" };

export interface BotAvatar {
  face: string;
  /** Custom face: data URL (face scan) or hosted URL (Higgsfield). Overrides face. */
  face_url?: string;
  /** True when the face was AI-generated — shown as a label, never hidden. */
  generated?: boolean;
  name: string;
}

export const DEFAULT_AVATAR: BotAvatar = { face: BLANK_FACE.id, name: "" };

export function isValidFace(face: string): boolean {
  return face === BLANK_FACE.id || AVATAR_PRESETS.some((p) => p.id === face);
}

export function isValidFaceUrl(url: string): boolean {
  if (!url || url.length > 500_000) return false;
  return (
    url.startsWith("data:image/jpeg;base64,") ||
    url.startsWith("data:image/png;base64,") ||
    url.startsWith("data:image/webp;base64,") ||
    url.startsWith("https://")
  );
}

export function faceSrc(face: string, face_url?: string): string {
  if (face_url && isValidFaceUrl(face_url)) return face_url;
  if (face === BLANK_FACE.id) return BLANK_FACE.src;
  return AVATAR_PRESETS.find((p) => p.id === face)?.src ?? BLANK_FACE.src;
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
  const out: BotAvatar = { face, name };
  if (typeof rec.face_url === "string" && isValidFaceUrl(rec.face_url)) {
    out.face_url = rec.face_url;
    out.generated = rec.generated === true;
  }
  return out;
}
