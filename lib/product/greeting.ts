// The name Home greets a person by. Only a word that is plainly a name is used — letters, hyphens
// and apostrophes — after skipping titles; otherwise Home doesn't pretend to know what to call them.
// Found on the 2026-11-10 acceptance run, which greeted a person as "Hello, [automated."
const TITLES = new Set(["mr", "mrs", "ms", "mx", "dr", "prof", "sir", "dame"]);

export function greetingName(name: string): string | null {
  for (const raw of name.trim().split(/\s+/)) {
    const word = raw.replace(/[.,;:!?]+$/, "");
    if (!word || TITLES.has(word.toLowerCase())) continue;
    return /^\p{L}[\p{L}'’-]*$/u.test(word) ? word : null;
  }
  return null;
}
