import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePublicMedia } from "../../lib/product/public-media";

test("supported Spotify public links become official provider embeds", () => {
  const url = "https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ?si=abc";
  const result = parsePublicMedia(url);
  assert.equal(result?.provider, "Spotify");
  assert.equal(result?.embedUrl, "https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ");
  assert.equal(result?.sourceUrl, "https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ");
});

test("YouTube video IDs work without importing video account data", () => {
  const watch = parsePublicMedia("https://www.youtube.com/watch?v=M7lc1UVf-VE&feature=share");
  const short = parsePublicMedia("https://youtu.be/M7lc1UVf-VE");
  assert.equal(watch?.embedUrl, "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1");
  assert.deepEqual(watch, short);
});

test("unsafe, arbitrary, or private addresses cannot become iframes", () => {
  for (const input of [
    "javascript:alert(1)",
    "http://www.youtube.com/watch?v=M7lc1UVf-VE",
    "https://www.youtube.com.evil.com/watch?v=M7lc1UVf-VE",
    "https://open.spotify.com.evil.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
    "https://127.0.0.1/admin",
    "https://open.spotify.com@evil.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
    "https://user:pass@open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
    "https://open.spotify.com:8080/track/0Lr4kGOYn9l83EjuK6cZFQ",
    "https://open.spotify.com/track/../../etc/passwd",
    "https://www.youtube.com/watch?v=not-real",
    "https://youtu.be/M7lc1UVf-VE/anything",
    "<iframe src='https://www.youtube.com/embed/M7lc1UVf-VE'></iframe>",
    "https://spotify.link/unknown",
  ]) assert.equal(parsePublicMedia(input), null, input);
});

test("only requested public media data is exposed, not arbitrary parameters", () => {
  const r = parsePublicMedia("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?token=secret");
  assert.equal(r?.embedUrl.includes("secret"), false);
  assert.deepEqual(Object.keys(r ?? {}).sort(), ["embedUrl","label","provider","sourceUrl"].sort());
});
