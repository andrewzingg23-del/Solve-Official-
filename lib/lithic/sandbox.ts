// Server-side Lithic sandbox client. Never import from client components.
// Key lives in LITHIC_SANDBOX_API_KEY (Vercel env, all targets).

const BASE = "https://sandbox.lithic.com/v1";

function headers() {
  const key = process.env.LITHIC_SANDBOX_API_KEY;
  if (!key) throw new Error("LITHIC_SANDBOX_API_KEY not configured");
  return { Authorization: key, "Content-Type": "application/json" };
}

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lithic ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export type LithicCard = {
  token: string;
  last_four: string;
  state: string;
  type: string;
  spend_limit: number;
  created: string;
};

export async function listAccounts() {
  const data = await req("GET", "/accounts");
  return data.data ?? [];
}

export async function createVirtualCard(accountToken: string, memo = "SOV ID spend card"): Promise<LithicCard> {
  return req("POST", "/cards", {
    type: "VIRTUAL",
    account_token: accountToken,
    memo,
    state: "OPEN",
    spend_limit: 0,
    spend_limit_duration: "TRANSACTION",
  });
}

export async function listCards() {
  const data = await req("GET", "/cards?page_size=25");
  return (data.data ?? []) as LithicCard[];
}

export function isConfigured() {
  return Boolean(process.env.LITHIC_SANDBOX_API_KEY);
}
