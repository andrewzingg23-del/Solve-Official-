// The subset of node:assert/strict the kernel tests use, with strict (Object.is) semantics.
class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

const show = (v: unknown) => {
  try {
    return typeof v === "bigint" ? `${v}n` : JSON.stringify(v, (_, x) => (typeof x === "bigint" ? `${x}n` : x));
  } catch {
    return String(v);
  }
};

function deepStrictEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a)) {
    const y = b as unknown[];
    return a.length === y.length && a.every((v, i) => deepStrictEqual(v, y[i]));
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  return (
    ka.length === kb.length &&
    ka.every((k, i) => k === kb[i] && deepStrictEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

type Validator = RegExp | ((e: unknown) => boolean) | (new (...args: never[]) => unknown) | Record<string, unknown>;

function check(error: unknown, expected?: Validator) {
  if (expected === undefined) return;
  if (expected instanceof RegExp) {
    if (!expected.test(String((error as Error)?.message ?? error))) throw new AssertionError(`error ${show(String(error))} does not match ${expected}`);
    return;
  }
  if (typeof expected === "function") {
    if ((expected as { prototype?: unknown }).prototype && error instanceof (expected as new () => unknown)) return;
    const ok = (expected as (e: unknown) => boolean)(error);
    if (ok !== true) throw new AssertionError(`validator rejected ${show(String(error))}`);
    return;
  }
  for (const [k, v] of Object.entries(expected)) {
    const actual = (error as Record<string, unknown>)?.[k];
    if (v instanceof RegExp ? !v.test(String(actual)) : !deepStrictEqual(actual, v)) {
      throw new AssertionError(`error.${k} is ${show(actual)}, expected ${show(v)}`);
    }
  }
}

function assert(value: unknown, message?: string): asserts value {
  if (!value) throw new AssertionError(message ?? `expected truthy, got ${show(value)}`);
}

assert.ok = assert;
assert.equal = (a: unknown, b: unknown, message?: string) => {
  if (!Object.is(a, b)) throw new AssertionError(message ?? `${show(a)} !== ${show(b)}`);
};
assert.strictEqual = assert.equal;
assert.notEqual = (a: unknown, b: unknown, message?: string) => {
  if (Object.is(a, b)) throw new AssertionError(message ?? `${show(a)} === ${show(b)}`);
};
assert.deepEqual = (a: unknown, b: unknown, message?: string) => {
  if (!deepStrictEqual(a, b)) throw new AssertionError(message ?? `${show(a)} does not deep-equal ${show(b)}`);
};
assert.deepStrictEqual = assert.deepEqual;
assert.match = (s: string, re: RegExp, message?: string) => {
  if (!re.test(s)) throw new AssertionError(message ?? `${show(s)} does not match ${re}`);
};
assert.fail = (message = "failed") => {
  throw new AssertionError(message);
};
assert.throws = (fn: () => unknown, expected?: Validator, message?: string) => {
  try {
    fn();
  } catch (error) {
    check(error, expected);
    return;
  }
  throw new AssertionError(message ?? "missing expected exception");
};
assert.rejects = async (target: Promise<unknown> | (() => Promise<unknown>), expected?: Validator, message?: string) => {
  try {
    await (typeof target === "function" ? target() : target);
  } catch (error) {
    check(error, expected);
    return;
  }
  throw new AssertionError(message ?? "Missing expected rejection.");
};

export default assert;
export { AssertionError };
