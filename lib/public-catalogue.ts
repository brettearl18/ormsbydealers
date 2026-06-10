import type { AvailabilityState, GuitarOption, GuitarSpecs, PricesDoc } from "@/lib/types";
import { getDealerPriceFromRRP, getRRPForVariant } from "@/lib/pricing";

export const PUBLIC_CATALOGUE_RUN = "Run 19";
export const PUBLIC_CATALOGUE_DEALER_DISCOUNT = 40;
export const PUBLIC_CATALOGUE_DISTRIBUTOR_DISCOUNT = 50;
/** @deprecated use getCatalogueDiscount(audience) */
export const PUBLIC_CATALOGUE_DISCOUNT = PUBLIC_CATALOGUE_DEALER_DISCOUNT;

export type CatalogueAudience = "dealer" | "distributor";

export const PUBLIC_CATALOGUE_CART_EVENT = "public-catalogue-cart-updated";

export function getCatalogueDiscount(audience: CatalogueAudience): number {
  return audience === "distributor"
    ? PUBLIC_CATALOGUE_DISTRIBUTOR_DISCOUNT
    : PUBLIC_CATALOGUE_DEALER_DISCOUNT;
}

export function getCatalogueBasePath(audience: CatalogueAudience): string {
  return audience === "distributor"
    ? "/catalogue/run-19/distributor"
    : "/catalogue/run-19";
}

export function getCatalogueCartKey(audience: CatalogueAudience): string {
  return `ormsby-public-catalogue-run19-${audience}`;
}

export function parseCatalogueAudience(value: string | null | undefined): CatalogueAudience {
  return value === "distributor" ? "distributor" : "dealer";
}

export function catalogueAudienceFromPath(pathname: string): CatalogueAudience {
  return pathname.includes("/catalogue/run-19/distributor")
    ? "distributor"
    : "dealer";
}

export function getCatalogueAudienceLabel(audience: CatalogueAudience): string {
  return audience === "distributor" ? "Distributor" : "Dealer";
}

export interface PublicCatalogueGuitar {
  id: string;
  sku: string;
  name: string;
  series: string;
  run: string;
  etaDelivery?: string;
  images: string[];
  specs: GuitarSpecs;
  options: GuitarOption[];
  availability: {
    state: AvailabilityState;
    etaDate?: string | null;
    batchName?: string | null;
    qtyAvailable?: number;
    qtyAllocated?: number;
  };
  pricing: {
    currency: string;
    discountPercent: number;
    rrp: number | null;
    dealerPrice: number | null;
  };
}

export interface PublicCatalogueCartItem {
  guitarId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  qty: number;
  unitPrice: number;
  selectedOptions: Record<string, string>;
  optionSummary: string;
}

export interface PublicCatalogueContact {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  territory: string;
  poNumber: string;
  notes: string;
  shippingAddress: {
    company: string;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
}

export function emptyPublicCatalogueContact(): PublicCatalogueContact {
  return {
    company: "",
    contactName: "",
    email: "",
    phone: "",
    territory: "",
    poNumber: "",
    notes: "",
    shippingAddress: {
      company: "",
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
    },
  };
}

export function readPublicCatalogueCart(audience: CatalogueAudience): PublicCatalogueCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(getCatalogueCartKey(audience));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublicCatalogueCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePublicCatalogueCart(
  audience: CatalogueAudience,
  items: PublicCatalogueCartItem[],
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(getCatalogueCartKey(audience), JSON.stringify(items));
}

export function cartItemKey(item: Pick<PublicCatalogueCartItem, "guitarId" | "selectedOptions">) {
  return `${item.guitarId}:${JSON.stringify(item.selectedOptions)}`;
}

export function buildOptionSummary(
  options: GuitarOption[] | undefined,
  selectedOptions: Record<string, string>,
): string {
  if (!options?.length) return "";
  return options
    .map((opt) => {
      const valueId = selectedOptions[opt.optionId];
      if (!valueId) return null;
      const val = opt.values.find((v) => v.valueId === valueId);
      return val ? `${opt.label}: ${val.label}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export function findCatalogueOption(
  options: GuitarOption[] | undefined,
  kind: "colour" | "strings",
): GuitarOption | undefined {
  if (!options?.length) return undefined;
  const byId = options.find((o) => o.optionId.toLowerCase() === kind);
  if (byId) return byId;
  return options.find((o) =>
    o.label.toLowerCase().includes(kind === "colour" ? "colour" : "string"),
  );
}

export interface PublicCatalogueColourVariant {
  cardKey: string;
  guitarId: string;
  guitarName: string;
  colourOptionId: string;
  colourValueId: string;
  colourLabel: string;
  displayName: string;
  series: string;
  baseSku: string;
  sku: string;
  heroImage: string | null;
  options: GuitarOption[];
  availability: PublicCatalogueGuitar["availability"];
  rrp: number | null;
  dealerPrice: number | null;
  discountPercent: number;
  currency: string;
  configureHref: string;
  specs: PublicCatalogueGuitar["specs"];
}

export function notifyPublicCatalogueCartUpdated(audience: CatalogueAudience) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PUBLIC_CATALOGUE_CART_EVENT, { detail: { audience } }),
  );
}

export function addToPublicCatalogueCart(
  audience: CatalogueAudience,
  item: PublicCatalogueCartItem,
): void {
  const key = cartItemKey(item);
  const existing = readPublicCatalogueCart(audience);
  const idx = existing.findIndex((e) => cartItemKey(e) === key);
  if (idx >= 0) {
    existing[idx] = {
      ...existing[idx],
      qty: Math.min(99, existing[idx].qty + item.qty),
    };
  } else {
    existing.push(item);
  }
  writePublicCatalogueCart(audience, existing);
  notifyPublicCatalogueCartUpdated(audience);
}

export function expandGuitarsByColour(
  guitars: PublicCatalogueGuitar[],
  basePath: string,
): PublicCatalogueColourVariant[] {
  const variants: PublicCatalogueColourVariant[] = [];

  for (const guitar of guitars) {
    const discountPercent = guitar.pricing.discountPercent;
    const colourOption = findCatalogueOption(guitar.options, "colour");
    const pricesDoc: PricesDoc | null =
      guitar.pricing.rrp != null
        ? {
            guitarId: guitar.id,
            currency: guitar.pricing.currency,
            basePrice: guitar.pricing.dealerPrice ?? 0,
            rrp: guitar.pricing.rrp,
          }
        : null;

    if (!colourOption?.values.length) {
      variants.push({
        cardKey: guitar.id,
        guitarId: guitar.id,
        guitarName: guitar.name,
        colourOptionId: "",
        colourValueId: "",
        colourLabel: "",
        displayName: guitar.name,
        series: guitar.series,
        baseSku: guitar.sku,
        sku: guitar.sku,
        heroImage: guitar.images?.[0] ?? null,
        options: guitar.options ?? [],
        availability: guitar.availability,
        rrp: guitar.pricing.rrp,
        dealerPrice: guitar.pricing.dealerPrice,
        discountPercent,
        currency: guitar.pricing.currency,
        configureHref: `${basePath}/guitars/${guitar.id}`,
        specs: guitar.specs ?? {},
      });
      continue;
    }

    for (const colour of colourOption.values) {
      const selectedOptions = { [colourOption.optionId]: colour.valueId };
      const rrp = pricesDoc
        ? getRRPForVariant(
            pricesDoc,
            guitar.options,
            selectedOptions,
            discountPercent,
          )
        : guitar.pricing.rrp;
      const dealerPrice =
        rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : null;
      const sku = buildVariantSku(guitar.sku, guitar.options, selectedOptions);
      const heroImage = colour.images?.[0] ?? guitar.images?.[0] ?? null;

      variants.push({
        cardKey: `${guitar.id}-${colour.valueId}`,
        guitarId: guitar.id,
        guitarName: guitar.name,
        colourOptionId: colourOption.optionId,
        colourValueId: colour.valueId,
        colourLabel: colour.label,
        displayName: `${guitar.name.replace(/\s*\(Run \d+\)\s*/i, "").trim() || guitar.name} — ${colour.label}`,
        series: guitar.series,
        baseSku: guitar.sku,
        sku,
        heroImage,
        options: guitar.options ?? [],
        availability: guitar.availability,
        rrp,
        dealerPrice,
        discountPercent,
        currency: guitar.pricing.currency,
        configureHref: `${basePath}/guitars/${guitar.id}?colour=${encodeURIComponent(colour.valueId)}`,
        specs: guitar.specs ?? {},
      });
    }
  }

  return variants.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );
}

export function buildVariantSku(
  baseSku: string,
  options: GuitarOption[] | undefined,
  selectedOptions: Record<string, string>,
): string {
  let sku = baseSku;
  if (!options?.length) return sku;
  for (const opt of options) {
    const valueId = selectedOptions[opt.optionId];
    if (!valueId) continue;
    const val = opt.values.find((v) => v.valueId === valueId);
    if (val?.skuSuffix) sku += val.skuSuffix;
  }
  return sku;
}
