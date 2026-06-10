import { getAdminDb } from "@/lib/firebase-admin";
import type { AvailabilityState, GuitarDoc, GuitarOption, PricesDoc } from "@/lib/types";
import { getDealerPriceFromRRP, getRRPForVariant } from "@/lib/pricing";
import {
  PUBLIC_CATALOGUE_DEALER_DISCOUNT,
  PUBLIC_CATALOGUE_RUN,
  type PublicCatalogueGuitar,
} from "@/lib/public-catalogue";

function normalizeRun(run: string | undefined): string {
  return (run ?? "").trim().toLowerCase();
}

export async function loadPublicCatalogueRun19(
  discountPercent = PUBLIC_CATALOGUE_DEALER_DISCOUNT,
): Promise<PublicCatalogueGuitar[]> {
  const db = getAdminDb();
  const snap = await db.collection("guitars").where("status", "==", "ACTIVE").get();
  const guitars: PublicCatalogueGuitar[] = [];

  for (const docSnap of snap.docs) {
    const guitar = docSnap.data() as GuitarDoc;
    const runLabel = (guitar.run || guitar.series || "").trim();
    if (normalizeRun(runLabel) !== normalizeRun(PUBLIC_CATALOGUE_RUN)) continue;

    const [availabilitySnap, pricesSnap] = await Promise.all([
      db.collection("availability").doc(docSnap.id).get(),
      db.collection("prices").doc(docSnap.id).get(),
    ]);

    const availabilityData = availabilitySnap.exists
      ? availabilitySnap.data()
      : null;
    const availability = availabilityData ?? {
      state: "PREORDER" as AvailabilityState,
      qtyAvailable: 0,
      qtyAllocated: 0,
    };

    const prices = pricesSnap.exists ? (pricesSnap.data() as PricesDoc) : null;
    const baseRrp = getRRPForVariant(
      prices,
      (guitar.options ?? null) as GuitarOption[] | null,
      null,
      discountPercent,
    );
    const baseDealerPrice =
      baseRrp != null ? getDealerPriceFromRRP(baseRrp, discountPercent) : null;

    guitars.push({
      id: docSnap.id,
      sku: guitar.sku,
      name: guitar.name,
      series: guitar.series,
      run: runLabel,
      etaDelivery: guitar.etaDelivery ?? "",
      images: guitar.images ?? [],
      specs: guitar.specs,
      options: (guitar.options ?? []) as GuitarOption[],
      availability: {
        state: (availability.state as AvailabilityState) ?? "PREORDER",
        etaDate: (availability.etaDate as string | null | undefined) ?? null,
        batchName: (availability.batchName as string | null | undefined) ?? null,
        qtyAvailable: availability.qtyAvailable as number | undefined,
        qtyAllocated: availability.qtyAllocated as number | undefined,
      },
      pricing: {
        currency: "AUD",
        discountPercent,
        rrp: baseRrp,
        dealerPrice: baseDealerPrice,
      },
    });
  }

  guitars.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return guitars;
}

const FUNCTIONS_REGION = "us-central1";
const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ormsbydistribute";

/** Invoke a callable Cloud Function from the server (no browser CORS). */
export async function callCloudFunction<TPayload, TResult>(
  name: string,
  data: TPayload,
): Promise<TResult> {
  const url = `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });

  const json = (await res.json()) as { result?: TResult; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Function ${name} failed (${res.status})`);
  }
  return json.result as TResult;
}
