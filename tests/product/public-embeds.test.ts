import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicEmbed } from "../../lib/product/public-embeds";

test("accepts only approved YouTube embed targets", () => {
  assert.deepEqual(parsePublicEmbed("https://youtu.be/dQw4w9WgXcQ")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.deepEqual(parsePublicEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=23")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  for (const input of ["https://evil.youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://youtube.com/watch?v=../../a", "https://youtube.com/watch?v=dQw4w9WgXcQx", "http://youtu.be/dQw4w9WgXcQ"]) {
    assert.equal(parsePublicEmbed(input), null, input);
  }
});

test("parses public Spotify paths without forwarding arbitrary query strings", () => {
  const id = "4uLU6hMCjMI75M1A2tKUQC";
  assert.deepEqual(parsePublicEmbed("https://open.spotify.com/track/" + id + "?si=abc")?.src, "https://open.spotify.com/embed/track/" + id);
  assert.equal(parsePublicEmbed("https://open.spotify.com/user/alice"), null);
  assert.equal(parsePublicEmbed("https://badopen.spotify.com/track/" + id), null);
  assert.equal(parsePublicEmbed("https://open.spotify.com:8443/track/" + id), null);
  assert.equal(parsePublicEmbed(null), null);
});
