import { stripActiveContent } from "./website-draft";

// Render-time policy, never persisted into the user's versioned source. The opaque-origin sandbox
// prevents script/authority access but does not itself prevent image, font or CSS network requests.
// Put the trusted policy BEFORE all supplied markup (even malformed documents and early resources).
// A later generated CSP can only add restrictions; it cannot relax this policy.
const PREVIEW_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

export function buildDraftPreviewDocument(html: string): string {
  return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}"></head>${stripActiveContent(html)}</html>`;
}
