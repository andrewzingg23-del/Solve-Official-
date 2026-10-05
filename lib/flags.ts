// Money stays built, tested and documented, but stays off the default path until the founder turns it
// on (master spec §2: "feature-gate it. Do not delete it and do not put it in the Build 1 user path").
// Unset means off. The /money page is prerendered, so switching it on takes a redeploy. Each switch also needs the one before it: payments need money, and actions that move
// value outside solve need payments.
const on = (value: string | undefined) => value === "true" || value === "1";

export function moneyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return on(env.ENABLE_MONEY);
}

export function paymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return moneyEnabled(env) && on(env.ENABLE_PAYMENTS);
}

export function externalFinancialActionsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return paymentsEnabled(env) && on(env.ENABLE_EXTERNAL_FINANCIAL_ACTIONS);
}
