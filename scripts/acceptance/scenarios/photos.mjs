// Photo helpers shared by scenarios.
// A real JPEG drawn in the browser, then given an EXIF segment carrying a GPS position — the way a
// phone photo arrives. The product must remove it before the photo is stored.
export const GPS = "GPS 28.538336 -81.379234 home";
export async function phonePhoto(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    const g = c.getContext("2d"); const grad = g.createLinearGradient(0, 0, 640, 480);
    grad.addColorStop(0, "#f97316"); grad.addColorStop(1, "#2563eb"); g.fillStyle = grad; g.fillRect(0, 0, 640, 480);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  const jpeg = Buffer.from(b64, "base64");
  const body = Buffer.concat([Buffer.from("Exif\0\0MM\0*\0\0\0\x08", "binary"), Buffer.from(GPS)]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
// Wait for the image to actually load (it may be lazy), then report whether it decoded.
export async function loaded(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  return locator.evaluate(img => img.complete && img.naturalWidth > 0 ? true
    : new Promise(r => { img.addEventListener("load", () => r(img.naturalWidth > 0), { once: true }); img.addEventListener("error", () => r(false), { once: true }); setTimeout(() => r(false), 10000); }))
    .catch(() => false);
}
export async function whyNot(locator) {
  const src = await locator.getAttribute("src").catch(() => null);
  if (!src) return `no img (count ${await locator.count()})`;
  const r = await fetch(src).then(x => `${x.status} ${x.headers.get("content-type")}`, e => e.message);
  return `${src.replace(/token=[^&]+/, "token=…").slice(0, 140)} → ${r}`;
}

