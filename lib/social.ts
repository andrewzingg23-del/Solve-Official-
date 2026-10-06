// Social import cards for onboarding. Honest states only: nothing here fakes
// a connection or a stat. Pure module.

export interface SocialProvider {
  id: "instagram" | "facebook" | "x" | "linkedin";
  label: string;
  /** What's missing before this can connect. Plain words. */
  needsSetup: string;
  /** True when the server has the credentials to start OAuth. */
  ready: boolean;
}

export interface SocialConnection {
  connected: boolean;
  name?: string;
  username?: string;
  followers?: number;
}

export function getSocialConnections(user: {
  user_metadata?: Record<string, unknown>;
} | null): Record<string, SocialConnection> {
  const raw = user?.user_metadata?.social_connections;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SocialConnection> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && (v as { connected?: unknown }).connected === true) {
      out[k] = { connected: true };
      const vv = v as Record<string, unknown>;
      if (typeof vv.name === "string") out[k].name = vv.name;
      if (typeof vv.username === "string") out[k].username = vv.username;
      if (typeof vv.followers === "number") out[k].followers = vv.followers;
    }
  }
  return out;
}
