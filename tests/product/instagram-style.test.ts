import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isInstagramStyleRequest, instagramProfileUrl, suggestInstagramAppearance } from "../../lib/product/instagram-style";
import { DEFAULT_APPEARANCE } from "../../lib/product/appearance";

const read = (path: string) => readFileSync(path, "utf8");

test("an Instagram personalization request becomes an action rather than a generic World", () => {
  for (const request of [
    "Search my Instagram and make SOLVE feel like me",
    "Find my Instagram and personalize my Space",
    "make this look like my insta",
    "Connect my IG profile",
    "Make my Instagram aesthetic my theme"
  ]) assert.equal(isInstagramStyleRequest(request), true, request);
  for (const request of [
    "Build my website", "What is Instagram?", "Create a new shared project", "", null
  ]) assert.equal(isInstagramStyleRequest(request), false, String(request));

  const home = read("app/reality/entry.tsx");
  const space = read("app/space/personal-space.tsx");
  assert.match(home, /isInstagramStyleRequest\(intention\)/);
  assert.match(home, /router\.push\("\/personalize\/instagram"\)/);
  assert.match(space, /isInstagramStyleRequest\(message\)/);
  assert.match(space, /router\.push\("\/personalize\/instagram"\)/);
});

test("Instagram profile URLs are fixed to the real profile origin", () => {
  assert.equal(instagramProfileUrl("@hello_world"), "https://www.instagram.com/hello_world/");
  assert.equal(instagramProfileUrl("https://www.instagram.com/good.photo/?hl=en"), "https://www.instagram.com/good.photo/");
  for (const invalid of [
    "https://evil.com/hello_world",
    "https://instagram.com.evil.org/good",
    "https://instagram.com/p/",
    "https://instagram.com/direct/",
    "https://instagram.com@evil.com/hello_world",
    "not a handle",
    ""
  ]) assert.equal(instagramProfileUrl(invalid), null, invalid);
});

test("only supplied photos/captions produce an Instagram style, no speculative claims", () => {
  const current = DEFAULT_APPEARANCE;
  assert.equal(suggestInstagramAppearance(current, [], "").analysis, null);
  const blue = suggestInstagramAppearance(current, [205, 225, 215], "");
  assert.equal(blue.next.tone, "ocean");
  assert.equal(blue.analysis?.photosRead, 3);
  assert.equal(blue.analysis?.source, "photos");
  const sunset = suggestInstagramAppearance(current, [20, 25, 40], "");
  assert.equal(sunset.next.tone, "sunset");
  const monochrome = suggestInstagramAppearance(current, [-1, -1], "");
  assert.equal(monochrome.next.tone, "graphite");
  const caption = suggestInstagramAppearance(current, [], "blue water and ocean sunsets");
  assert.ok(caption.analysis);
  assert.equal(caption.analysis?.source, "captions");
  assert.deepEqual(current, DEFAULT_APPEARANCE);
});

test("source content is processed on-device and the account saves only reviewed appearance", () => {
  const studio = read("app/personalize/instagram/studio.tsx");
  const actions = read("app/personalize/instagram/actions.ts");
  assert.match(studio, /URL\.createObjectURL\(file\)/);
  assert.match(studio, /getImageData/);
  assert.match(studio, /applyInstagramInspiredLook\(proposal\.next, proposal\.analysis\.source\)/);
  assert.match(studio, /Nothing changes automatically/);
  assert.doesNotMatch(studio, /fetch\(["']https?:\/\/.*instagram/);
  assert.match(actions, /supabase\.auth\.getUser/);
  assert.match(actions, /sov_space_appearance: next/);
  assert.match(actions, /solve_reality_mode_v1: "personal"/);
  assert.doesNotMatch(actions, /access_token|post_media|captionText|instagram_password/);
});
