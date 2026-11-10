import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { PHOTO_MAX_BYTES, checkPhoto, isPhotoOf, photoName } from "../../lib/product/photo";

const bytes = (...parts: Array<number[] | string>) => new Uint8Array(parts.flatMap(p => typeof p === "string" ? [...p].map(c => c.charCodeAt(0)) : p));
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

const jfif = [0xff, 0xe0, ...be16(16), ...bytes("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0];
const sos = [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9];

it("a clean JPEG, PNG or WebP is accepted, identified by its bytes", () => {
  assert.deepEqual(checkPhoto(bytes([0xff, 0xd8], jfif, sos)), { ok: true, type: "image/jpeg" });
  const ihdr = [...be32(13), ...bytes("IHDR"), ...new Array(13).fill(0), 0, 0, 0, 0];
  const iend = [...be32(0), ...bytes("IEND"), 0, 0, 0, 0];
  assert.deepEqual(checkPhoto(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ihdr, iend)), { ok: true, type: "image/png" });
  assert.deepEqual(checkPhoto(bytes("RIFF", le32(14), "WEBP", "VP8 ", le32(2), [0, 0])), { ok: true, type: "image/webp" });
});

it("a JPEG carrying EXIF — where a phone puts the GPS location — is refused", () => {
  const exif = [0xff, 0xe1, ...be16(14), ...bytes("Exif\0\0MM\0*"), 0, 0];
  assert.deepEqual(checkPhoto(bytes([0xff, 0xd8], jfif, exif, sos)), { ok: false, reason: "carries_metadata" });
  assert.deepEqual(checkPhoto(bytes([0xff, 0xd8], exif, jfif, sos)), { ok: false, reason: "carries_metadata" }, "wherever it sits");
});

it("PNG and WebP metadata chunks are refused too", () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const chunk of ["eXIf", "tEXt", "iTXt", "zTXt"]) {
    assert.deepEqual(checkPhoto(bytes(sig, be32(1), chunk, [0], [0, 0, 0, 0])), { ok: false, reason: "carries_metadata" }, chunk);
  }
  assert.deepEqual(checkPhoto(bytes("RIFF", le32(14), "WEBP", "EXIF", le32(2), [0, 0])), { ok: false, reason: "carries_metadata" });
  assert.deepEqual(checkPhoto(bytes("RIFF", le32(14), "WEBP", "XMP ", le32(2), [0, 0])), { ok: false, reason: "carries_metadata" });
});

it("anything else is refused, whatever it calls itself", () => {
  assert.equal(checkPhoto(new Uint8Array()).ok, false);
  assert.deepEqual(checkPhoto(bytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), { ok: false, reason: "not_a_photo" });
  assert.deepEqual(checkPhoto(bytes("<html>")), { ok: false, reason: "not_a_photo" });
  assert.deepEqual(checkPhoto(bytes("GIF89a")), { ok: false, reason: "not_a_photo" });
  assert.deepEqual(checkPhoto(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 1])), { ok: false, reason: "not_a_photo" }, "a broken segment length");
  assert.deepEqual(checkPhoto(new Uint8Array(PHOTO_MAX_BYTES + 1)), { ok: false, reason: "too_large" });
});

it("a photo's name places it inside exactly one thing", () => {
  const thing = randomUUID(), other = randomUUID(), file = randomUUID();
  const name = photoName(thing, file);
  assert.equal(name, `${thing}/${file}.jpg`);
  assert.equal(isPhotoOf(name, thing), true);
  assert.equal(isPhotoOf(name, other), false, "not another thing's");
  for (const bad of [`${thing}/../${file}.jpg`, `${thing}/${file}.svg`, `${thing}/x/${file}.jpg`, `${file}.jpg`, null, 7]) {
    assert.equal(isPhotoOf(bad, thing), false, String(bad));
  }
  assert.throws(() => photoName("not-a-thing", file));
});
