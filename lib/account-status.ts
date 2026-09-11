import type { AccountDoc } from "@/lib/types";

export type AccountLifecycleStatus = "ACTIVE" | "ARCHIVED";

export function getAccountLifecycleStatus(
  account: Pick<AccountDoc, "status"> | null | undefined,
): AccountLifecycleStatus {
  return account?.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
}

export function isAccountArchived(
  account: Pick<AccountDoc, "status"> | null | undefined,
): boolean {
  return getAccountLifecycleStatus(account) === "ARCHIVED";
}
