import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  AccountDoc,
  AvailabilityDoc,
  GuitarDoc,
  PricesDoc,
  AvailabilityState,
} from "./types";
import { getRRPForVariant, getDealerPriceFromRRP } from "./pricing";

export interface DealerGuitar {
  id: string;
  sku: string;
  name: string;
  series: string;
  heroImage: string | null;
  availability: {
    state: AvailabilityState;
    etaDate?: string | null;
    batchName?: string | null;
  };
  price: {
    value: number | null;
    source: string | null;
  };
  /** RRP (AUD) for display with strikethrough when dealer has discount */
  rrp?: number | null;
  /** Account discount % so cards can show "X% off" */
  discountPercent?: number;
}

export async function fetchDealerGuitars(params: {
  accountId: string;
  tierId?: string;
  currency?: string;
}): Promise<DealerGuitar[]> {
  const accountSnap = await getDoc(doc(db, "accounts", params.accountId));
  const discountPercent = (accountSnap.exists()
    ? (accountSnap.data() as AccountDoc).discountPercent
    : undefined) ?? 0;

  const guitarsRef = collection(db, "guitars");
  const q = query(
    guitarsRef,
    where("status", "==", "ACTIVE"),
    limit(40),
  );

  const snap = await getDocs(q);

  const results: DealerGuitar[] = [];

  for (const docSnap of snap.docs) {
    const guitar = docSnap.data() as GuitarDoc;
    const guitarId = docSnap.id;

    const availabilitySnap = await getDoc(
      doc(db, "availability", guitarId),
    );
    const pricesSnap = await getDoc(
      doc(db, "prices", guitarId),
    );

    const availability = availabilitySnap.exists()
      ? (availabilitySnap.data() as AvailabilityDoc)
      : {
          state: "PREORDER" as AvailabilityState,
          qtyAvailable: 0,
          qtyAllocated: 0,
        };

    const prices = pricesSnap.exists()
      ? (pricesSnap.data() as PricesDoc)
      : null;

    const rrp = getRRPForVariant(prices ?? null, guitar.options ?? null, null);
    const value = rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : null;

    results.push({
      id: guitarId,
      sku: guitar.sku,
      name: guitar.name,
      series: guitar.series,
      heroImage: guitar.images?.[0] ?? null,
      availability: {
        state: availability.state,
        etaDate: availability.etaDate ?? null,
        batchName: availability.batchName ?? null,
      },
      price: {
        value,
        source: discountPercent > 0 ? "DISCOUNT" : "RRP",
      },
      rrp: rrp ?? null,
      discountPercent,
    });
  }

  return results;
}



