// Slice B — turn a project goal into a first website draft. Pure helpers only; the model call and
// persistence live in the server action. A website draft is ONE self-contained HTML document stored
// as a CreativeArtifact body (reusing the existing versioned-artifact home — one concept, one home)
// and shown in a sandboxed, script-free preview.
//
// Generated HTML is UNTRUSTED. The real isolation boundary is the preview iframe rendered with an
// empty `sandbox` attribute (no scripts, no same-origin) — see DraftPreview. stripActiveContent()
// below is defense-in-depth so a draft that is ever rendered outside that sandbox still can't run
// script or load off-document resources.

export const WEBSITE_DRAFT = "website.draft.v1";
export type DraftRequest = { title: string; goal: string };

/** Messages instructing the model to return a single self-contained HTML document. */
export function buildWebsiteDraftMessages(req: DraftRequest): { role: "system" | "user"; content: string }[] {
  const title = req.title.trim();
  const goal = req.goal.trim();
  return [
    {
      role: "system",
      content: [
        "You are a senior web designer producing a first-draft landing page a client can immediately see and react to.",
        "Return EXACTLY ONE complete, self-contained HTML5 document and nothing else — no explanation, no markdown fences.",
        "Rules:",
        "- Start with <!DOCTYPE html>. Include <html>, <head> (with <title> and a responsive viewport meta) and <body>.",
        "- All CSS inline in a single <style> tag. Modern, clean, responsive, accessible (semantic landmarks, good contrast, alt text).",
        "- NO JavaScript, NO <script>, NO external resources (no CDN links, web fonts, remote images or iframes). Use system fonts and CSS gradients/SVG for visuals.",
        "- Write real, specific copy drawn from the user's goal — headline, subheadline, sections, and a clear call to action. Never use lorem ipsum.",
        "- It must look like a real page for THIS idea, not a generic template.",
        "- Keep the whole document COMPACT — under about 10,000 characters. Prefer concise CSS and tight copy over length; a strong one-page draft, not an exhaustive site.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `Project name: ${title || "(untitled)"}\n\nWhat they want to make happen:\n${goal}\n\nDesign the first-draft website now.`,
    },
  ];
}

/** Pulls the HTML document out of the model output (tolerating stray prose or a code fence). Null if none. */
export function extractHtmlDocument(output: unknown): string | null {
  if (typeof output !== "string") return null;
  let text = output.trim();
  if (!text) return null;
  const fence = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = fence[1].trim();
  const doctype = text.search(/<!doctype html>/i);
  if (doctype >= 0) text = text.slice(doctype);
  const close = text.toLowerCase().lastIndexOf("</html>");
  if (close >= 0) text = text.slice(0, close + "</html>".length);
  return /<html[\s>]/i.test(text) && /<\/html>/i.test(text) ? text.trim() : null;
}

/** Cheap predicate for the artifact renderer: does this stored body look like an HTML document? */
export function looksLikeHtmlDocument(body: unknown): body is string {
  return typeof body === "string" && /(<!doctype html>|<html[\s>])/i.test(body) && /<\/html>/i.test(body);
}

/** True when the draft is a real page with visible content, not an empty shell. */
export function isSubstantiveDraft(html: string | null): html is string {
  if (!html) return false;
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? "";
  const visibleText = body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return visibleText.length >= 80 && /<(h1|h2|p|section|main|header)[\s>]/i.test(body);
}

/**
 * Strips anything that could execute or reach off-document when rendered: scripts, inline event
 * handlers, javascript:/data:text/html URLs, and resource-loading embeds. Defense-in-depth behind
 * the script-free sandboxed preview iframe, which is the authoritative boundary.
 */
export function stripActiveContent(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<(iframe|object|embed|frame|frameset|base)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(iframe|object|embed|frame|base|link|meta)\b[^>]*>/gi, (tag) =>
      /<meta\b/i.test(tag) && !/http-equiv\s*=\s*["']?refresh/i.test(tag) ? tag : "",
    )
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src|action)\s*=\s*("|')\s*(javascript:|data:text\/html)[^"']*\2/gi, '$1=$2#$2');
}
