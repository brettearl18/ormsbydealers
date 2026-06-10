import type { AvailabilityState, GuitarOption, GuitarSpecs } from "@/lib/types";

export const PUBLIC_CATALOGUE_RUN = "Run 19";
export const PUBLIC_CATALOGUE_DISCOUNT = 40;
export const PUBLIC_CATALOGUE_CART_KEY = "ormsby-public-catalogue-run19";

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

export function readPublicCatalogueCart(): PublicCatalogueCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PUBLIC_CATALOGUE_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublicCatalogueCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePublicCatalogueCart(items: PublicCatalogueCartItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PUBLIC_CATALOGUE_CART_KEY, JSON.stringify(items));
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
