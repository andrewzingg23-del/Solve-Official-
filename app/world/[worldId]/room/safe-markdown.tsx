import React, { type ReactNode } from "react";

// A deliberately small Markdown subset. React escapes every text node; raw
// HTML, images and arbitrary URL schemes never become active DOM content.
function inline(text: string): ReactNode[] {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
  const result: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    result.push(text.slice(start, match.index));
    const token = match[0];
    const key = match.index;
    if (token.startsWith("`")) result.push(<code key={key} className="rounded bg-background/70 px-1 font-mono">{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) result.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) result.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const safe = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(link[2]) && !/[\u0000-\u0020\\]/.test(link[2]);
      result.push(safe ? <a key={key} href={link[2]} rel="noreferrer noopener" className="text-accent underline">{link[1]}</a> : <span key={key}>{link[1]}</span>);
    }
    start = match.index! + token.length;
  }
  result.push(text.slice(start));
  return result;
}

export function SafeMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const key = i;
    if (!lines[i].trim()) { i++; continue; }
    if (/^\s*```/.test(lines[i])) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre key={key} className="max-w-full whitespace-pre-wrap break-words rounded-md bg-background/70 p-3 font-mono text-xs"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(lines[i]);
    if (heading) { blocks.push(<h3 key={key} className="font-semibold">{inline(heading[1])}</h3>); i++; continue; }
    const list = /^\s*(?:([-*+])|\d+[.)])\s+(.+)$/.exec(lines[i]);
    if (list) {
      const ordered = !list[1];
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const item = /^\s*(?:([-*+])|\d+[.)])\s+(.+)$/.exec(lines[i]);
        if (!item || !item[1] !== ordered) break;
        items.push(<li key={i}>{inline(item[2])}</li>); i++;
      }
      blocks.push(ordered ? <ol key={key} className="list-decimal space-y-1 pl-5">{items}</ol> : <ul key={key} className="list-disc space-y-1 pl-5">{items}</ul>);
      continue;
    }
    const paragraph: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^\s*(?:```|#{1,6}\s|[-*+]\s|\d+[.)]\s)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={key} className="whitespace-pre-wrap">{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="min-w-0 space-y-3 break-words text-sm leading-6 [overflow-wrap:anywhere]">{blocks}</div>;
}
