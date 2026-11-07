/**
 * Collaboration addressing inside an already-authorized World room.
 *
 * Addressing is routing metadata carried in the saved message body until a
 * kernel-native per-client directed-message API exists. It is NOT an access
 * control rule, a verified provider identity, or a promise an AI is running.
 * The kernel remains responsible for author/actor provenance and World grants.
 */
export const TEAM_RECIPIENTS = ["team", "claude", "chatgpt", "muse"] as const;
export type TeamRecipient = (typeof TEAM_RECIPIENTS)[number];

export const TEAM_RECIPIENT_LABELS: Record<TeamRecipient, string> = {
  team: "Everyone",
  claude: "Claude",
  chatgpt: "ChatGPT",
  muse: "Muse",
};

const PREFIX = /^@(team|claude|chatgpt|muse)(?=\s|$)\s*/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

export function teamRecipient(value: unknown): TeamRecipient | null {
  return typeof value === "string" &&
    TEAM_RECIPIENTS.includes(value.toLowerCase() as TeamRecipient)
    ? value.toLowerCase() as TeamRecipient : null;
}

export function parseTeamMessage(value: string): {
  recipient: TeamRecipient; body: string; addressed: boolean;
} {
  const matched = PREFIX.exec(value);
  if (!matched) return { recipient: "team", body: value, addressed: false };
  return {
    recipient: matched[1].toLowerCase() as TeamRecipient,
    body: value.slice(matched[0].length),
    addressed: true,
  };
}

/** Stable visible prefix; every reader sees the same addressed recipient. */
export function formatTeamMessage(recipient: TeamRecipient, rawText: string): string {
  const body = rawText.trim();
  if (!teamRecipient(recipient) || !body || CONTROL.test(body)) {
    throw new Error("Enter a valid shared message and teammate.");
  }
  const text = `@${recipient} ${body}`;
  if (text.length > 8000) throw new Error("Message is too long for the shared room.");
  return text;
}
