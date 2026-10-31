// A small per-person TTL cache so Your AI's chat doesn't re-read the passport's
// profile and project list on every message. The passport logs each read on its
// own record, so reading profile + projects + related facts every message is
// three reads per turn; profile and the project list barely change between
// messages, so we keep them ~10 minutes and re-read only the message-specific
// facts. Best-effort and per-instance (serverless): a cold start reads fresh.
export const TEN_MINUTES_MS = 10 * 60 * 1000;

type Entry = { at: number; value: string };

export class TtlCache {
  private store = new Map<string, Entry>();
  constructor(
    private readonly ttlMs = TEN_MINUTES_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** The cached value, or null when missing or past its TTL (expired entries are dropped). */
  get(key: string): string | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (this.now() - e.at >= this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: string): void {
    this.store.set(key, { at: this.now(), value });
  }

  clear(): void {
    this.store.clear();
  }
}
