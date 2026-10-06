// The semantic digest of a kernel: every kernel table (so every event, grant, entity, relation,
// ledger entry and evidence record), with what legitimately differs between two generations of the
// same civilization replaced by its order of first appearance: ids, keys, addresses, signatures,
// hashes and timestamps. Same seed, generator and kernel → same digest; any change in meaning
// changes it. Runs unchanged in Node and in the browser, against the kernel itself, so it proves a
// snapshot or a browser boot carries the canonical state it claims to.
export type Query = (sql: string) => Promise<Record<string, unknown>[]>;

export type KernelDigest = {
  digest: string;
  tables: Record<string, number>;
  events: Record<string, number>;
};

// Columns whose values vary by when, not what.
const VOLATILE = new Set(["created_at", "occurred_at", "hash", "prev_hash"]);

const OPAQUE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?|[A-Za-z0-9+/]{32,}={0,2}/g;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]/;
// Long tokens are ids only if they look like one: base58, hex or base64 with digits (not words).
const isOpaque = (token: string) => TIMESTAMP.test(token) || token.length === 36 || /\d/.test(token);

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(new TextEncoder().encode(text)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// `withText` also returns the normalized text the digest hashes, to diff two generations.
export async function kernelDigest(query: Query, { withText = false } = {}): Promise<KernelDigest & { text?: string }> {
  const columns = await query(`
    select c.table_name::text as table_name, c.column_name::text as column_name, c.data_type::text as data_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'kernel' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position`);
  const tables = new Map<string, { volatile: string[]; hasEvent: boolean }>();
  for (const c of columns) {
    const name = String(c.table_name);
    const entry = tables.get(name) ?? { volatile: [], hasEvent: false };
    const column = String(c.column_name);
    if (VOLATILE.has(column) || String(c.data_type).startsWith("timestamp")) entry.volatile.push(column);
    if (column === "event_id") entry.hasEvent = true;
    tables.set(name, entry);
  }

  const labels = new Map<string, string>();
  const label = (text: string, assign: boolean) =>
    text.replace(OPAQUE, (token) => {
      if (TIMESTAMP.test(token)) return "<t>";
      if (!isOpaque(token)) return token;
      let l = labels.get(token);
      if (!l && assign) labels.set(token, (l = `#${labels.size + 1}`));
      return l ?? "#?";
    });
  const mask = (text: string) => text.replace(OPAQUE, (token) => (isOpaque(token) ? "~" : token));

  const lines: string[] = [];
  const counts: Record<string, number> = {};
  // Events first: their order is the kernel's own, so the labels they assign are reproducible.
  const order = ["events", ...[...tables.keys()].filter((t) => t !== "events").sort()];
  for (const name of order) {
    const { volatile, hasEvent } = tables.get(name)!;
    const drop = `array[${volatile.map((v) => `'${v}'`).join(",")}]::text[]`;
    const rows =
      name === "events"
        ? await query(`select (to_jsonb(t) - ${drop})::text as row, t.seq::text as seq from kernel.events t order by t.seq`)
        : hasEvent
          ? await query(`select (to_jsonb(t) - ${drop})::text as row, e.seq::text as seq from kernel.${name} t left join kernel.events e on e.id = t.event_id`)
          : await query(`select (to_jsonb(t) - ${drop})::text as row, null::text as seq from kernel.${name} t`);
    counts[name] = rows.length;
    // Within one event (or a table with no events), order by content with ids masked.
    const sorted = rows
      .map((r) => ({ row: String(r.row), seq: r.seq === null ? Number.MAX_SAFE_INTEGER : Number(r.seq) }))
      .sort((a, b) => a.seq - b.seq || (mask(a.row) < mask(b.row) ? -1 : mask(a.row) > mask(b.row) ? 1 : 0));
    lines.push(`## ${name}`);
    for (const r of sorted) lines.push(label(r.row, hasEvent || name === "events"));
  }

  const events: Record<string, number> = {};
  for (const r of await query("select type, count(*)::int as n from kernel.events group by type order by type")) events[String(r.type)] = Number(r.n);
  const text = lines.join("\n");
  return { digest: await sha256Hex(text), tables: counts, events, ...(withText ? { text } : {}) };
}
