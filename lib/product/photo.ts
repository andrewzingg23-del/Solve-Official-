// What a photo in a shared thing must be before it is recorded.
//
// Phone photos carry hidden metadata — above all the GPS location where they were taken, which in
// a product built for friends, families and children is a home address. The browser redraws every
// photo before upload, which drops that metadata; the server then checks the stored bytes itself
// and refuses any file that still carries it, so the guarantee does not rest on the browser.

export const PHOTO_BUCKET = "things";
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** The longest side a photo is redrawn to. Large enough for a phone screen at 3x; small enough to load quickly. */
export const PHOTO_MAX_SIDE = 2048;
/** How long a link to a photo works. A person who loses access can't get a new one. */
export const PHOTO_LINK_SECONDS = 600;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NAME = new RegExp(`^(${UUID})/${UUID}\\.(jpg|png|webp)$`);

/** A stored photo's name: `<thing>/<file>.<ext>`. The thing is in the path, so storage can ask the kernel about it. */
export function photoName(worldId: string, fileId: string, ext: "jpg" | "png" | "webp" = "jpg"): string {
  const name = `${worldId.toLowerCase()}/${fileId.toLowerCase()}.${ext}`;
  if (!NAME.test(name)) throw new Error("Not a valid photo name");
  return name;
}

/** Whether a name is a well-formed photo inside this thing — and only this thing. */
export function isPhotoOf(name: unknown, worldId: string): name is string {
  if (typeof name !== "string") return false;
  const match = NAME.exec(name);
  return Boolean(match && match[1] === worldId.toLowerCase());
}

export type PhotoCheck =
  | { ok: true; type: "image/jpeg" | "image/png" | "image/webp" }
  | { ok: false; reason: "empty" | "too_large" | "not_a_photo" | "carries_metadata" };

const has = (bytes: Uint8Array, at: number, sig: number[]) => sig.every((b, i) => bytes[at + i] === b);
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));

/** Reads the bytes themselves — never a name or a declared type — and refuses anything that isn't a clean photo. */
export function checkPhoto(bytes: Uint8Array): PhotoCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, reason: "too_large" };

  if (has(bytes, 0, [0xff, 0xd8, 0xff])) {
    // Walk the JPEG's segments up to the image data. APP1 holds EXIF (with GPS) and XMP; both refused.
    let i = 2;
    while (i + 4 <= bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1];
      if (marker === 0xda || marker === 0xd9) break; // start of image data, or end
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if (length < 2) return { ok: false, reason: "not_a_photo" };
      if (marker === 0xe1) return { ok: false, reason: "carries_metadata" };
      i += 2 + length;
    }
    return { ok: true, type: "image/jpeg" };
  }
  if (has(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    for (let i = 8; i + 8 <= bytes.length;) {
      const length = ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
      const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (type === "eXIf" || type === "iTXt" || type === "tEXt" || type === "zTXt") return { ok: false, reason: "carries_metadata" };
      if (type === "IEND") break;
      i += 12 + length;
    }
    return { ok: true, type: "image/png" };
  }
  if (has(bytes, 0, ascii("RIFF")) && has(bytes, 8, ascii("WEBP"))) {
    for (let i = 12; i + 8 <= bytes.length;) {
      const type = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
      const length = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | ((bytes[i + 7] << 24) >>> 0);
      if (type === "EXIF" || type === "XMP ") return { ok: false, reason: "carries_metadata" };
      i += 8 + length + (length % 2);
    }
    return { ok: true, type: "image/webp" };
  }
  return { ok: false, reason: "not_a_photo" };
}

export function photoProblem(reason: Exclude<PhotoCheck, { ok: true }>["reason"]): string {
  switch (reason) {
    case "empty": return "That file is empty.";
    case "too_large": return "That photo is too large. Photos can be up to 10 MB.";
    case "carries_metadata": return "That photo still carries hidden details, like where it was taken, so it wasn't added. Try adding it again from this page.";
    default: return "That isn't a photo SOLVE can show. Try a JPEG, PNG or WebP.";
  }
}
