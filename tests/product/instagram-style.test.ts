import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isInstagramStyleRequest, instagramProfileUrl, instagramHandleInRequest, suggestInstagramAppearance } from "../../lib/product/instagram-style";
import { extractInstagramProfileMatches, sourceWordsFromProfile } from "../../lib/product/instagram-public-search";
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
  assert.match(home, /router\.push\("\/personalize\/instagram" \+/);
  assert.match(space, /isInstagramStyleRequest\(message\)/);
  assert.match(space, /router\.push\("\/personalize\/instagram" \+/);
});

test("Instagram profile URLs are fixed to the real profile origin", () => {
  assert.equal(instagramProfileUrl("@hello_world"), "https://www.instagram.com/hello_world/");
  assert.equal(instagramProfileUrl("instagram.com/hello_world"), "https://www.instagram.com/hello_world/");
  assert.equal(instagramHandleInRequest("Please search my Instagram @hello_world and personalize SOLVE"), "hello_world");
  assert.equal(instagramHandleInRequest("Style SOLVE from https://instagram.com/hello_world/"), "hello_world");
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


test("public Instagram search only trusts citations on the exact requested Instagram profile", () => {
  const body = {
    choices: [{
      message: {
        content: "The model can say anything but it isn't accepted as evidence.",
        annotations: [
          { type:"url_citation", url_citation: {
            url: "https://www.instagram.com/real.creator/?hl=en",
            title:"real.creator Instagram",content:"Photography, vintage cars and ocean landscapes"
          }},
          { type:"url_citation", url_citation: {
            url: "https://instagram.com/otherperson/", title:"Other",content:"Private details"
          }},
          { type:"url_citation", url_citation: {
            url: "https://instagram.com/p/secret-post/", title:"Unattributed post", content:"ignore"
          }},
          { type:"url_citation", url_citation: {
            url: "https://instagram.com.evil.net/real.creator/", title:"Spoof", content:"ignore"
          }},
          { type:"url_citation", url_citation: {
            url: "http://www.instagram.com/real.creator/", title:"Insecure",content:"ignore"
          }},
        ]
      }
    }]
  };
  const matches = extractInstagramProfileMatches(body,"real.creator");
  assert.equal(matches.length,1);
  assert.equal(matches[0].url,"https://www.instagram.com/real.creator/");
  assert.match(sourceWordsFromProfile(matches),/vintage cars/);
  assert.deepEqual(extractInstagramProfileMatches({ choices:[{message:{ content:"I found Instagram." }}]},"real.creator"),[]);
  assert.deepEqual(extractInstagramProfileMatches(body,"someoneelse"),[]);
});

test("search uses real OpenRouter web search and never invents an account", () => {
  const search = read("app/personalize/instagram/search.ts");
  assert.match(search, /openrouter:web_search/);
  assert.match(search, /OPENROUTER_API_KEY/);
  assert.match(search, /instagramProfileUrl\(rawProfile\)/);
  assert.match(search, /extractInstagramProfileMatches\(result, handle\)/);
  assert.match(search, /getUser/);
  const studio = read("app/personalize/instagram/studio.tsx");
  assert.match(studio, /searchPublicInstagram\(handle\)/);
  assert.match(studio, /Publicly indexed match/);
  assert.match(studio, /Not account verification/);
});


test("the central AI conversation returns a typed capability action without pretending to fetch Instagram", () => {
  const chat = read("app/api/bot/chat/route.ts");
  assert.match(chat, /isInstagramStyleRequest\(chat\.message\)/);
  assert.match(chat, /source: "instagram-personalization"/);
  assert.match(chat, /action: \{ kind: "navigate", href, label: "Personalize from Instagram" \}/);
  assert.ok(chat.indexOf("if (isInstagramStyleRequest(chat.message))") < chat.indexOf("const apiKey = process.env.OPENROUTER_API_KEY"));
});


test("one approved personal appearance reaches Home, Space and Workbench", () => {
  const home = read("app/page.tsx");
  const entry = read("app/reality/entry.tsx");
  const workPage = read("app/world/[worldId]/workbench/page.tsx");
  const workView = read("app/world/[worldId]/workbench/workbench.tsx");
  const css = read("app/reality/reality.css");
  assert.match(home,/initialAppearance=\{normalizeAppearance/);
  assert.match(entry,/data-style-tone=\{initialAppearance\.tone\}/);
  assert.match(workPage,/tone=\{normalizeAppearance/);
  assert.match(workView,/data-style-tone=\{tone\}/);
  for(const tone of ["graphite","ocean","mint","sunset","violet"]) {
    assert.ok(css.includes('data-style-tone="' + tone + '"'));
  }
});
