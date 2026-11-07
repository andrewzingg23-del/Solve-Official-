// Small, auditable contact-export contract for the on-device SOV Card preview.
// Only explicit, validated contact fields enter the vCard. This is not publication.
export type SovContactInput = {
  name: string;
  email?: string;
  website?: string;
};

export function safeContactEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().slice(0, 254);
  if (/[\r\n\u0000-\u001f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function safeSovLink(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function vcardEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, " ").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function createSovVCard(input: SovContactInput): string | null {
  const name = typeof input.name === "string" ? input.name.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, 90) : "";
  if (!name) return null;
  const email = safeContactEmail(input.email);
  const website = safeSovLink(input.website);
  return [
    "BEGIN:VCARD", "VERSION:3.0", "FN:" + vcardEscape(name),
    ...(email ? ["EMAIL;TYPE=INTERNET:" + vcardEscape(email)] : []),
    ...(website ? ["URL:" + vcardEscape(website)] : []),
    "END:VCARD", "",
  ].join("\r\n");
}
