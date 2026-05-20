"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { fetchDealerFxRates } from "@/lib/fx-client";
import type { FxRatesDoc } from "@/lib/types";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Indicative USD / EUR equivalents below order subtotal (AUD dealer prices).
 */
export function OrderFxEstimates({
  subtotalAud,
}: {
  /** Order subtotal in AUD (dealer line prices). */
  subtotalAud: number;
}) {
  const [fx, setFx] = useState<FxRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDealerFxRates(db).then((data) => {
      if (!cancelled) {
        setFx(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="border-t border-white/10 pt-3 text-xs text-neutral-500">
        Loading indicative US / EU rates…
      </p>
    );
  }

  if (!fx?.rates) return null;

  const base = fx.base || "AUD";
  const usdRate = fx.rates.USD;
  const eurRate = fx.rates.EUR;
  if (usdRate == null && eurRate == null) return null;

  const asOfLabel = fx.asOf
    ? new Date(fx.asOf).toLocaleDateString("en-AU", { dateStyle: "medium" })
    : null;

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      {usdRate != null && (
        <div className="flex justify-between text-sm">
          <span className="text-neutral-400">Approx. USD</span>
          <span className="font-medium text-neutral-200">
            {formatMoney(subtotalAud * usdRate, "USD")}
          </span>
        </div>
      )}
      {eurRate != null && (
        <div className="flex justify-between text-sm">
          <span className="text-neutral-400">Approx. EUR</span>
          <span className="font-medium text-neutral-200">
            {formatMoney(subtotalAud * eurRate, "EUR")}
          </span>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-neutral-500">
        {asOfLabel ? `Rates as of ${asOfLabel}: ` : "Rates: "}
        {usdRate != null && `1 ${base} = ${usdRate.toFixed(4)} USD`}
        {usdRate != null && eurRate != null && " · "}
        {eurRate != null && `1 ${base} = ${eurRate.toFixed(4)} EUR`}
        . Indicative only; dealer pricing is in AUD.
      </p>
    </div>
  );
}
