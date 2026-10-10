import { validatePersona, type Persona } from "../bot/persona";
import { isValidFace } from "../bot/avatar";
export type IdentityInputResult = { ok: true; name: string; face: string; persona: Persona } | { ok: false; error: string };
export function validateIdentityInput(input: unknown, existing: Persona): IdentityInputResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Check your profile and try again." };
  const fields = input as Record<string, unknown>;
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const botName = typeof fields.botName === "string" ? fields.botName.trim() : "";
  const face = typeof fields.face === "string" ? fields.face : "";
  const control = [...name + botName].some(character => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159));
  if (!name || name.length > 60 || control) return { ok: false, error: "Choose a name up to 60 characters." };
  if (!botName || botName.length > 40) return { ok: false, error: "Choose an AI name up to 40 characters." };
  if (!isValidFace(face)) return { ok: false, error: "Choose one of the available portraits." };
  const persona = validatePersona(fields.persona ?? existing, existing);
  return { ok: true, name, face, persona: { ...persona, name: botName } };
}
