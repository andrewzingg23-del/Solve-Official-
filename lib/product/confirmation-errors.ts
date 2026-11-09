// What a person is told when asking for, or giving, a confirmation does not work.
//
// The kernel's own messages for these cases are already written for people, so the known ones are
// passed through; anything else becomes a plain, truthful fallback rather than raw database text.
// Every message says what happened and what is still true, and none implies success.

const KNOWN: Array<[RegExp, string]> = [
  [/cannot confirm your own record/i, "You can't confirm your own record. Send the link to the person you asked."],
  [/already answered/i, "This was already answered, and an answer can't be changed."],
  [/has expired/i, "This request has expired. Ask the person who sent it for a new link."],
  [/link is unavailable|no such thing/i, "This link isn't available. It may have been withdrawn, or the address may be incomplete."],
  [/authority behind this request has ended/i, "The person who asked no longer holds this, so it can't be answered."],
  [/cannot delegate confirmation|forbidden|only the/i, "Only the person who holds this can ask about it."],
];

export function confirmationError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, words] of KNOWN) if (pattern.test(message)) return words;
  return fallback;
}
