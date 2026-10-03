// Runs the kernel test files, unchanged, in the browser against PGlite loaded natively from
// /pglite (no bundler transformation). Same migrations, same harness, same assertions as npm test.
import { kernelMigrations, loadPGlite } from "../../lib/sandbox/pglite";
import { setKernelRuntime } from "../kernel/harness";
import "../kernel/kernel.test";
import "../kernel/client.test";
import "../kernel/money.test";
import "../kernel/payments.test";
import "../kernel/actions.test";
import type { PGliteLike } from "../../lib/kernel/local";
import { afterEachHooks, run, type Result } from "./shims/node-test";

declare global {
  interface Window {
    __kernelTests?: { done: boolean; results: Result[] };
  }
}

// Each test gets a fresh database cloned from one migrated template, as in Node. Browser memory
// is tighter, so the template is dumped once and every test's databases close after it runs.
const live: { close(): Promise<void> }[] = [];
afterEachHooks.push(async () => {
  for (const db of live.splice(0)) await db.close();
});
setKernelRuntime({
  create: async () => {
    const PGlite = await loadPGlite();
    const template = new PGlite();
    let dump: ArrayBuffer | undefined;
    const wrapped: PGliteLike = {
      query: (sql, params) => template.query(sql, params),
      exec: (sql) => template.exec(sql),
      transaction: (fn) => template.transaction(fn),
      clone: async () => {
        dump ??= await (await template.dumpDataDir("none")).arrayBuffer();
        const db = new PGlite({ loadDataDir: new Blob([dump]) });
        live.push(db);
        return db;
      },
    };
    return wrapped;
  },
  migrations: kernelMigrations,
});

const out = document.getElementById("out")!;
const state: { done: boolean; results: Result[] } = { done: false, results: [] };
window.__kernelTests = state;
run((r) => {
  state.results.push(r);
  out.textContent += `${r.ok ? "ok    " : "FAIL  "} ${r.name} (${r.ms} ms)\n${r.ok ? "" : r.error + "\n"}`;
}).then(() => {
  state.done = true;
  const failed = state.results.filter((r) => !r.ok).length;
  out.textContent += `\n${state.results.length - failed} pass, ${failed} fail\n`;
});
