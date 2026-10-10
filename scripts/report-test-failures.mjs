// Expose failed TAP diagnostics through the Checks API when downloadable logs
// are unavailable. The Test step preserves npm's status using pipefail.
import { readFileSync } from "node:fs";

const lines = readFileSync(process.argv[2], "utf8").split(/\r?\n/);
const failures = [];
for (let i = 0; i < lines.length; i++) {
  if (!/^\s*not ok\s+\d+/.test(lines[i])) continue;
  const block = [lines[i]];
  for (let j = i + 1; j < lines.length && block.length < 55; j++) {
    if (/^\s*(?:not ok|ok)\s+\d+/.test(lines[j])) break;
    block.push(lines[j]);
    if (/^\s*\.\.\.\s*$/.test(lines[j])) break;
  }
  failures.push(block.join("\n").slice(0, 12000));
}

const escape = (s) => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
const reports = failures.length ? failures.slice(0, 12) : [lines.slice(-45).join("\n").slice(0, 12000)];
for (const [i, report] of reports.entries()) {
  console.log(`::error title=Test failure ${i + 1}::${escape(report)}`);
}
