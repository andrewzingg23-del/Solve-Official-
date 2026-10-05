// The homeowner's first solar numbers: sized from their bill, priced the installer's way, with 2026's
// rules (no federal credit assumed). Pure math; no network.
import assert from "node:assert/strict";
import { it } from "node:test";
import { economics, estimateSolar, FLORIDA_DEFAULTS } from "../../lib/solar/estimate";

it("sizes a system from the bill and gives the money honestly", () => {
  const e = estimateSolar({ monthlyBill: 224 }); // 224 / 0.16 = 1,400 kWh a month
  assert.equal(e.annualUseKwh, 16800);
  assert.equal(e.panels, 30); // 16,800 / 1,400 / 0.41 = 29.3, rounded up
  assert.equal(e.systemKw, 12.3);
  assert.equal(e.annualProductionKwh, 17220);
  assert.equal(e.grossCost, 35670);
  assert.equal(e.netCost, 35670, "no federal credit in 2026");
  assert.equal(e.firstYearSavings, 2688, "only the use the system covers is savings");
  assert.ok(e.paybackYears && e.paybackYears > 10 && e.paybackYears < 13);
  assert.ok(e.lifetimeSavings > 0);
});

it("uses the bill's own rate when the homeowner knows their kWh, and keeps inputs in range", () => {
  const e = estimateSolar({ monthlyBill: 300, monthlyKwh: 1500 });
  assert.equal(e.rate, 0.2);
  assert.equal(e.annualUseKwh, 18000);
  const silly = estimateSolar({ monthlyBill: 1e9, offset: 9 });
  assert.equal(silly.annualUseKwh, (2000 / 0.16) * 12, "bills are capped");
  assert.ok(silly.covers <= 1.11);
  assert.equal(estimateSolar({ monthlyBill: 1 }).panels >= 4, true, "never fewer than four panels");
});

it("takes an incentive only when it's entered, and re-prices a real design's production", () => {
  assert.equal(estimateSolar({ monthlyBill: 224, incentives: 5000 }).netCost, 30670);
  const design = economics({ ...FLORIDA_DEFAULTS, rate: 0.16, annualUseKwh: 16800, systemKw: 10.25, panels: 25, annualProductionKwh: 15000 });
  assert.equal(design.firstYearSavings, 2400);
  assert.equal(design.grossCost, 29730);
});

it("sends a design request to Aurora, falls back to name and address if Aurora rejects contact fields, and reads the design back", async () => {
  const { auroraFromEnv, createProject, latestDesign, proposalToken, readProposalToken } = await import("../../lib/solar/aurora");
  assert.equal(auroraFromEnv({} as unknown as NodeJS.ProcessEnv), null, "not connected without a key");
  assert.equal(auroraFromEnv({ AURORA_API_KEY: "k", AURORA_TENANT_ID: "t-1234", AURORA_API_BASE: "https://evil.example.com" } as unknown as NodeJS.ProcessEnv), null, "only Aurora's own hosts");
  const a = auroraFromEnv({ AURORA_API_KEY: "k", AURORA_TENANT_ID: "t-1234" } as unknown as NodeJS.ProcessEnv)!;
  assert.equal(a.base, "https://api.aurorasolar.com");

  const seen: { url: string; body: string | null; auth: string }[] = [];
  let first = true;
  const fake = async (url: string, init: RequestInit) => {
    seen.push({ url, body: (init.body as string) ?? null, auth: (init.headers as Record<string, string>).authorization });
    if (url.endsWith("/projects") && first) { first = false; return new Response("{}", { status: 422 }); }
    if (url.endsWith("/projects")) return new Response(JSON.stringify({ project: { id: "proj-1" } }));
    if (url.endsWith("/projects/proj-1/designs")) return new Response(JSON.stringify({ designs: [{ id: "d-1" }, { id: "d-2" }] }));
    if (url.endsWith("/designs/d-2/summary")) return new Response(JSON.stringify({ design: { system_size_stc: 10250, energy_production: { annual: 14980.4 }, bill_of_materials: [{ component_type: "modules", quantity: 25 }, { component_type: "inverters", quantity: 1 }] } }));
    return new Response("{}", { status: 404 });
  };
  const id = await createProject(a, { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", phone: "555-0100", address: "1 Ocean Dr, Miami, FL" }, fake);
  assert.equal(id, "proj-1");
  assert.equal(seen[0].url, "https://api.aurorasolar.com/tenants/t-1234/projects");
  assert.equal(seen[0].auth, "Bearer k");
  assert.match(seen[0].body!, /"customer_email":"ana@example.com"/);
  assert.match(seen[1].body!, /"name":"Ana Ruiz · ana@example.com · 555-0100","location":\{"property_address":"1 Ocean Dr, Miami, FL"\}/);
  assert.deepEqual(await latestDesign(a, "proj-1", fake), { designId: "d-2", systemKw: 10.25, annualKwh: 14980, panels: 25 });

  const token = proposalToken("secret", { projectId: "proj-1", monthlyBill: 224, monthlyKwh: null });
  assert.deepEqual(readProposalToken("secret", token), { projectId: "proj-1", monthlyBill: 224, monthlyKwh: null });
  assert.equal(readProposalToken("other", token), null, "signed");
  assert.equal(readProposalToken("secret", token.replace(/^./, "x")), null, "can't be edited");
});
