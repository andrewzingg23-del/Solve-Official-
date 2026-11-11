// Never retain untrusted provider diagnostics in errors or logs.
export class ProviderError extends Error {
  readonly code: string;
  constructor(provider: string, readonly status: number) {
    const code = status === 401 || status === 403 ? "provider_credentials"
      : status === 429 ? "provider_rate_limited" : "provider_unavailable";
    super(code === "provider_credentials" ? `${provider} credentials or model permissions were rejected.`
      : code === "provider_rate_limited" ? `${provider}'s rate limit or usage quota was reached.`
      : `${provider} could not complete the request (HTTP ${status}).`);
    this.code = code;
  }
}
export function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export type ProviderUsage = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens?: number;
  cacheCreationTokens?: number;
};
// A charged response may contain no usable reply. Keep its reported usage even
// when its text outcome must be refused; never attach raw provider diagnostics.
export class ProviderReplyError extends Error {
  constructor(readonly code: "provider_empty" | "provider_refusal", readonly usage: ProviderUsage) {
    super(code === "provider_empty" ? "The AI provider returned no message." : "The AI engine declined this request.");
  }
}
