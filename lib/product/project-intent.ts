/** Only explicit project-creation commands can trigger a write from personal chat.
 * Ordinary conversation and appearance requests must never create projects. */
export function projectCreationIntent(message: string): { title: string; goal: string } | null {
  const match = /^\s*(?:please\s+)?create\s+(?:a\s+)?project\s+for\s+me\s*:\s*([\s\S]+)$/i.exec(message);
  if (!match) return null;
  const goal = match[1].trim();
  if (!goal || goal.length > 7000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(goal)) return null;
  const title = (goal.split(/[.!?\n]/, 1)[0]?.trim() || goal).slice(0, 160).trim();
  return title ? { title, goal } : null;
}
