// A directory workspace for the creation loop: an isolated place a builder writes into, or a
// promotion target. Modules are loaded fresh on every call so a later change is never masked.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Workspace } from "../../lib/ops/creation";

let loads = 0;

export function directoryWorkspace(prefix = "sov-workspace-"): Workspace & { root: string } {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return {
    root,
    async write(files) {
      for (const f of files) {
        mkdirSync(dirname(join(root, f.path)), { recursive: true });
        writeFileSync(join(root, f.path), f.content);
      }
    },
    async read(path) {
      try {
        return readFileSync(join(root, path), "utf8");
      } catch {
        return null;
      }
    },
    async load(path) {
      return import(`${pathToFileURL(join(root, path)).href}?v=${++loads}`);
    },
  };
}
