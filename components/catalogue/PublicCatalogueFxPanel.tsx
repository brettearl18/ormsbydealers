"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPublicFxRates } from "@/lib/fx-client";
import type { FxRatesDoc } from "@/lib/types";

const DISPLAY_CURRENCIES = ["AUD", "USD", "EUR", "GBP", "CAD"] as const;

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

function audToCurrency(
  amountAud: number,
  currency: string,
  fx: FxRatesDoc,
): number | null {
  const base = fx.base || "AUD";
  if (currency === base || currency === "AUD") return amountAud;
  const rate = fx.rates[currency];
  return rate != null ? amountAud * rate : null;
}

interface Props {
  /** Order subtotal in AUD. Pass 0 to show rates only. */
  amountAud: number;
  /** Tighter layout for the mobile order bar drawer. */
  compact?: boolean;
}

export function PublicCatalogueFxPanel({ amountAud, compact = false }: Props) {
  const [fx, setFx] = useState<FxRatesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("USD");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicFxRates().then((data) => {
      if (!cancelled) {
        setFx(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableCurrencies = useMemo(() => {
    if (!fx) return [...DISPLAY_CURRENCIES];
    const base = fx.base || "AUD";
    return DISPLAY_CURRENCIES.filter(
      (code) => code === base || code === "AUD" || fx.rates[code] != null,
    );
  }, [fx]);

  const converted = useMemo(() => {
    if (!fx || amountAud <= 0) return null;
    return audToCurrency(amountAud, currency, fx);
  }, [fx, amountAud, currency]);

  const asOfLabel = fx?.asOf
    ? new Date(fx.asOf).toLocaleDateString("en-AU", { dateStyle: "medium" })
    : null;

  if (loading) {
    return (
      <p className={`text-neutral-500 ${compact ? "text-[11px]" : "text-xs"}`}>
        Loading exchange rates…
      </p>
    );
  }

  if (!fx?.rates) return null;

  const base = fx.base || "AUD";
  const selectedRate =
    currency === base || currency === "AUD" ? 1 : fx.rates[currency];

  return (
    <div
      className={`space-y-2 ${compact ? "" : "rounded-xl border border-white/10 bg-black/20 p-4"}`}
    >
      {!compact && (
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Currency converter
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={compact ? "catalogue-fx-currency-compact" : "catalogue-fx-currency"}
          className={`text-neutral-500 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          Show in
        </label>
        <select
          id={compact ? "catalogue-fx-currency-compact" : "catalogue-fx-currency"}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={`rounded-lg border border-white/10 bg-black/40 text-white outline-none focus:border-accent ${
            compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
          }`}
        >
          {availableCurrencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {converted != null && (
        <div className="flex items-center justify-between gap-3">
          <span className={`text-neutral-400 ${compact ? "text-xs" : "text-sm"}`}>
            {amountAud > 0 ? "Approx. total" : "Amount"}
          </span>
          <span
            className={`font-semibold text-white ${compact ? "text-sm" : "text-base"}`}
          >
            {formatMoney(converted, currency)}
          </span>
        </div>
      )}

      {selectedRate != null && currency !== base && (
        <p className={`leading-relaxed text-neutral-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {asOfLabel ? `Rates as of ${asOfLabel}: ` : "Rates: "}
          1 {base} = {selectedRate.toFixed(4)} {currency}
          {amountAud <= 0 && (
            <>
              {" "}
              · 1 {base} = {(fx.rates.USD ?? 0).toFixed(4)} USD
              {fx.rates.EUR != null && ` · 1 ${base} = ${fx.rates.EUR.toFixed(4)} EUR`}
            </>
          )}
          . Indicative only; catalogue pricing is in AUD.
        </p>
      )}

      {currency === base && amountAud > 0 && (
        <p className={`text-neutral-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          Order total shown in AUD. Select USD, EUR, GBP, or CAD for an approximate conversion.
        </p>
      )}
    </div>
  );
}
