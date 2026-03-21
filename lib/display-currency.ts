import type { AccountDoc } from "@/lib/types";
import type { SessionUser } from "@/lib/auth-context";

/**
 * Saved account currency (Settings / admin) overrides auth token claims until claims refresh.
 */
export function resolveDisplayCurrency(
  account: Pick<AccountDoc, "currency"> | null | undefined,
  user: SessionUser | null | undefined,
): string {
  return account?.currency?.trim() || user?.currency?.trim() || "AUD";
}
