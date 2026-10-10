import { KernelError, type Kernel } from "../kernel/client";

export const ACCOUNT_CHANGED = "Your sign-in changed. Your draft is still here. Reopen this page in the account you want to use and review it before saving.";
export function sameDisplayedAccount(expected: unknown, current: string | null | undefined): boolean {
  return typeof expected === "string" && expected.length > 0 && expected === current;
}
export async function requireDisplayedActor(kernel: Kernel, expected: unknown): Promise<void> {
  if (!sameDisplayedAccount(expected, (await kernel.whoami()).actor_id)) throw new KernelError("conflict", ACCOUNT_CHANGED, "");
}
