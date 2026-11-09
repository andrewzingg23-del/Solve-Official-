/** Recognize explicit, bounded project creation requests only.
 * The parser never grants permission: authenticated server actions remain authoritative.
 * Ambiguous questions and general AI conversation must not trigger writes.
 */
export function projectCreationIntent(message: string): { title: string; goal: string } | null {
  const match = /^\s*(?:please\s+)?(?:create|start|make|set\s+up|build)\s+(?:(?:me\s+)?(?:a\s+|my\s+|new\s+))?project(?:\s+(?:for\s+me|called|named))?\s*(?::\s*|\s+(?:to|for|about)\s+)([\s\S]+)$/i.exec(message);
  if (!match) return null;
  const goal = match[1].trim();
  // "for me" without a stated purpose is not a project goal. The generic
  // "for" separator must not reinterpret its final "me" as a title.
  if (/^me$/i.test(goal) && /\bfor\s+me\s*$/i.test(message)) return null;
  if (!goal || goal.length > 7000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(goal)) return null;
  // Questions are conversational, not an instruction to persist a project.
  if (/\?\s*$/.test(goal)) return null;
  const title = (goal.split(/[.!?\n]/, 1)[0]?.trim() || goal).slice(0, 160).trim();
  return title ? { title, goal } : null;
}
