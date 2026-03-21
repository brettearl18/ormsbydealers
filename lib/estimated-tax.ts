import type { AccountDoc } from "@/lib/types";

/**
 * Dealer-configured % (e.g. 20 for 20% VAT) applied to subtotal for reference only.
 */
export function computeEstimatedTaxAmount(
  subtotal: number,
  percent: number | null | undefined,
): number {
  if (percent == null || Number.isNaN(percent) || percent <= 0) return 0;
  return subtotal * (percent / 100);
}

/** True when we should show an estimated tax/tariff line in summaries. */
export function hasEstimatedTaxSettings(account: AccountDoc | null | undefined): boolean {
  const p = account?.estimatedTaxPercent;
  return p != null && !Number.isNaN(p) && p > 0;
}

/** Label for the summary row (Settings type, or fallback). */
export function estimatedTaxLabelDisplay(account: AccountDoc | null | undefined): string {
  const raw = account?.estimatedTaxLabel?.trim();
  if (raw) return raw;
  return "Est. tax/tariff";
}
