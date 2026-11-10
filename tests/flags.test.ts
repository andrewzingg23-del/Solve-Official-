// Money stays off the default path: unset switches are off, and each switch needs the one before it.
// (The /money page these once guarded was removed with the rest of the retired product, 2026-11-10;
// the proxy refuses /money outright.)
import assert from "node:assert/strict";
import { it } from "node:test";
import { externalFinancialActionsEnabled, moneyEnabled, paymentsEnabled } from "../lib/flags";

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

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
