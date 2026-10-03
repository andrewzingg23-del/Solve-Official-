// The subset of node:test the kernel tests use (describe, it), collected and run in order.
type Test = { name: string; fn: () => unknown | Promise<unknown> };
const tests: Test[] = [];
const prefix: string[] = [];

export function describe(name: string, fn: () => void) {
  prefix.push(name);
  try {
    fn();
  } finally {
    prefix.pop();
  }
}

export function it(name: string, fn: () => unknown | Promise<unknown>) {
  tests.push({ name: [...prefix, name].join(" › "), fn });
}

export const test = it;

export type Result = { name: string; ok: boolean; ms: number; error?: string };

// Runs after every test (the browser runner closes that test's databases here).
export const afterEachHooks: (() => Promise<void>)[] = [];

export async function run(onResult: (r: Result) => void = () => {}) {
  const results: Result[] = [];
  for (const t of tests) {
    const started = performance.now();
    let result: Result;
    try {
      await t.fn();
      result = { name: t.name, ok: true, ms: Math.round(performance.now() - started) };
    } catch (error) {
      const e = error as Error;
      result = { name: t.name, ok: false, ms: Math.round(performance.now() - started), error: `${e?.message ?? e}\n${e?.stack ?? ""}`.slice(0, 2000) };
    }
    for (const hook of afterEachHooks) await hook();
    results.push(result);
    onResult(result);
  }
  return results;
}
