// Temporary Issue #47 diagnostic. PREVIEW ONLY. Remove before production merge.
// Runs with Vercel's own preview environment; never prints keys, tokens,
// response text, private World data, headers, or provider error messages.
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "fix/issue-47-room-reply-diagnostics"
) {
  const event = (stage, fields = {}) => {
    console.log("[solve-room-ai-probe] " + JSON.stringify({ stage, ...fields }));
  };
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-haiku-4.5";
  if (!key) {
    event("configuration", { code: "missing_key" });
  } else {
    const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" };
    const abort = () => AbortSignal.timeout(20_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: headers.Authorization },
        signal: abort()
      });
      event("authentication", { status: response.status, valid: response.ok });
    } catch (error) {
      event("authentication", { code: error?.name === "TimeoutError" ? "timeout" : "network_error" });
    }
    try {
      // No personal data. Same completion endpoint, model and 1400-token cap as the room.
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          ...headers,
          "HTTP-Referer": "https://solve-sovigrn.vercel.app",
          "X-Title": "Solve"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1400,
          messages: [
            { role: "system", content: "Respond with OK and nothing else." },
            { role: "user", content: "Hello" }
          ]
        }),
        signal: abort()
      });
      const data = await response.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      const finishReason = data?.choices?.[0]?.finish_reason;
      const errorCode = data?.error?.code;
      event("completion", {
        status: response.status,
        model,
        hasContent: typeof content === "string" && content.trim().length > 0,
        finishReason: typeof finishReason === "string" ? finishReason.slice(0, 40) : null,
        errorCode: typeof errorCode === "string" || typeof errorCode === "number" ? errorCode : null
      });
    } catch (error) {
      event("completion", { model, code: error?.name === "TimeoutError" ? "timeout" : "network_error" });
    }
  }
}
