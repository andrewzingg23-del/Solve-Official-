"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateCost, costDocument, formatCost, type CostInput } from "@/lib/world/cost-model";

const field = "min-w-0 w-full rounded border border-line bg-background p-2 text-sm text-foreground";
export function CostWorksheet({ worldId, canWrite }: { worldId: string; canWrite: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState<CostInput>({ currency: "USD", batchSize: 1, wastePercent: 0, overhead: "0", assumptions: "", items: [{ name: "", quantityPerUnit: 1, unitCost: "" }] });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  let result: ReturnType<typeof calculateCost> | null = null;
  let issue = "";
  try { result = calculateCost(input); } catch (error) { issue = error instanceof Error ? error.message : "Check the worksheet inputs."; }
  function changeItem(index: number, patch: Partial<CostInput["items"][number]>) {
    setInput(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  async function save() {
    if (!result || busy || !canWrite) return;
    setBusy(true); setNotice("");
    const payload = { title: "Component cost estimate", body: costDocument(input), position: { x: 65, y: 50 } };
    const signature = JSON.stringify(payload);
    if (!request.current || request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const res = await fetch(`/api/worlds/${worldId}/artifacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: request.current.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the estimate.");
      setNotice("Estimate and assumptions saved as a shared document."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the estimate. Your inputs are still here."); }
    finally { setBusy(false); }
  }
  return (
    <details className="mb-4 rounded-xl border border-line bg-surface/55 p-4">
      <summary className="cursor-pointer text-sm font-medium">Component cost worksheet</summary>
      <p className="mt-3 text-xs leading-5 text-muted">Estimate from your own component prices. Add quantities, batch size and assumptions; save the result for the group and its AI.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">Currency<select value={input.currency} onChange={e => setInput({ ...input, currency: e.target.value as CostInput["currency"] })} className={field}><option>USD</option><option>EUR</option><option>GBP</option></select></label>
        <label className="text-xs text-muted">Batch size · units<input type="number" min={1} max={1000000} step={1} value={input.batchSize || ""} onChange={e => setInput({ ...input, batchSize: Number(e.target.value) })} className={field} /></label>
        <label className="text-xs text-muted">Material waste · %<input type="number" min={0} max={100} step={1} value={input.wastePercent} onChange={e => setInput({ ...input, wastePercent: Number(e.target.value) })} className={field} /></label>
      </div>
      <ol aria-label="Cost components" className="mt-4 flex flex-col gap-3">
        {input.items.map((item, i) => <li key={i} className="grid min-w-0 gap-2 rounded border border-line p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-xs text-muted">Component {i + 1}<input maxLength={80} value={item.name} onChange={e => changeItem(i, { name: e.target.value })} className={field} /></label>
          <label className="text-xs text-muted">Per unit<input type="number" min={1} max={1000} step={1} value={item.quantityPerUnit || ""} onChange={e => changeItem(i, { quantityPerUnit: Number(e.target.value) })} className={field} /></label>
          <label className="text-xs text-muted">Price · {input.currency}<input inputMode="decimal" placeholder="0.00" value={item.unitCost} onChange={e => changeItem(i, { unitCost: e.target.value })} className={field} /></label>
          <button type="button" aria-label={`Remove component ${i + 1}`} disabled={input.items.length === 1} onClick={() => setInput({ ...input, items: input.items.filter((_, index) => index !== i) })} className="self-end rounded border border-line px-2 py-2 text-xs text-muted disabled:opacity-30">Remove</button>
        </li>)}
      </ol>
      <button type="button" disabled={input.items.length >= 20} onClick={() => setInput({ ...input, items: [...input.items, { name: "", quantityPerUnit: 1, unitCost: "" }] })} className="mt-3 text-xs text-accent underline disabled:opacity-50">Add component</button>
      <div className="mt-4 flex flex-col gap-3">
        <label className="text-xs text-muted">Fixed overhead for the batch · {input.currency}<input inputMode="decimal" value={input.overhead} onChange={e => setInput({ ...input, overhead: e.target.value })} className={field} /></label>
        <label className="text-xs text-muted">Assumptions and excluded costs<textarea rows={3} maxLength={1200} value={input.assumptions} onChange={e => setInput({ ...input, assumptions: e.target.value })} placeholder="Price sources, tax, shipping, labor, tooling…" className={field} /></label>
        {result ? <output aria-live="polite" className="rounded border border-accent/25 bg-accent/5 p-3 text-sm leading-6">Estimated batch: <strong>{formatCost(result.totalMinor, input.currency)}</strong> · per unit: <strong>{formatCost(result.perUnitMinor, input.currency)}</strong></output> : <p className="text-xs leading-5 text-muted">{issue}</p>}
        {canWrite ? <button type="button" onClick={save} disabled={busy || !result} className="self-start rounded border border-accent/50 px-3 py-2 text-sm text-accent disabled:opacity-50">{busy ? "Saving…" : "Save estimate to room"}</button> : null}
        {notice ? <p role="status" className="text-xs text-muted">{notice}</p> : null}
      </div>
    </details>
  );
}
