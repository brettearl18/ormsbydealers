import { doc, getDoc, type Firestore } from "firebase/firestore";
import type { FxRatesDoc } from "@/lib/types";

/**
 * Loads FX for dealer UI: tries live rates via our API (Frankfurter),
 * then falls back to Firestore `fxRates/latest` if the network fails.
 */
export async function fetchDealerFxRates(db: Firestore): Promise<FxRatesDoc | null> {
  try {
    const res = await fetch("/api/fx/latest", { cache: "no-store" });
    if (!res.ok) throw new Error("fx api failed");
    const data = (await res.json()) as FxRatesDoc & { error?: string };
    if (data.error || !data.rates || typeof data.rates !== "object") {
      throw new Error("invalid fx response");
    }
    return {
      base: data.base,
      rates: data.rates,
      asOf: data.asOf,
    };
  } catch {
    try {
      const snap = await getDoc(doc(db, "fxRates", "latest"));
      return snap.exists() ? (snap.data() as FxRatesDoc) : null;
    } catch {
      return null;
    }
  }
}
