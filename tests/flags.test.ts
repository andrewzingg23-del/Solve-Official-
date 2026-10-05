// Money stays off the default path: unset switches are off, each switch needs the one before it, and
// the /money page and its Server Actions answer 404 while money is off.
import assert from "node:assert/strict";
import { it } from "node:test";
import { externalFinancialActionsEnabled, moneyEnabled, paymentsEnabled } from "../lib/flags";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;
const notFound = (e: unknown) => (e as { digest?: string })?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") ?? false;

it("keeps money, payments and outside financial actions off unless each is switched on in order", () => {
  assert.deepEqual([moneyEnabled(env({})), paymentsEnabled(env({})), externalFinancialActionsEnabled(env({}))], [false, false, false]);
  assert.equal(moneyEnabled(env({ ENABLE_MONEY: "false" })), false);
  assert.equal(moneyEnabled(env({ ENABLE_MONEY: "yes" })), false, "only true or 1 turns it on");
  assert.equal(moneyEnabled(env({ ENABLE_MONEY: "true" })), true);
  assert.equal(paymentsEnabled(env({ ENABLE_PAYMENTS: "true" })), false, "payments need money");
  assert.equal(paymentsEnabled(env({ ENABLE_MONEY: "1", ENABLE_PAYMENTS: "1" })), true);
  assert.equal(externalFinancialActionsEnabled(env({ ENABLE_MONEY: "true", ENABLE_EXTERNAL_FINANCIAL_ACTIONS: "true" })), false, "outside actions need payments");
  assert.equal(externalFinancialActionsEnabled(env({ ENABLE_MONEY: "true", ENABLE_PAYMENTS: "true", ENABLE_EXTERNAL_FINANCIAL_ACTIONS: "true" })), true);
});

it("answers 404 for the money page and its actions while money is off", async () => {
  const saved = process.env.ENABLE_MONEY;
  delete process.env.ENABLE_MONEY;
  try {
    const { default: MoneyPage } = await import("../app/money/page");
    const { proofOfLife, sendBob } = await import("../app/money/actions");
    assert.throws(() => MoneyPage(), notFound);
    await assert.rejects(proofOfLife(), notFound, "a direct POST to the action cannot start a run");
    await assert.rejects(sendBob(), notFound);
  } finally {
    if (saved === undefined) delete process.env.ENABLE_MONEY;
    else process.env.ENABLE_MONEY = saved;
  }
});
