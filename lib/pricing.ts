import { PricesDoc, TierDoc } from "./types";

interface EffectivePriceInput {
  prices: PricesDoc | null;
  accountId: string;
  tierId: string;
  now: Date;
  quantity?: number; // Quantity for volume-based tier pricing
  tiers?: Array<TierDoc & { id: string }>; // All tiers for volume-based matching
}

export interface EffectivePriceResult {
  price: number | null;
  source: "PROMO" | "ACCOUNT_OVERRIDE" | "TIER" | "BASE" | null;
  tierId?: string; // Which tier was used (for volume-based)
}

export function computeEffectivePrice({
  prices,
  accountId,
  tierId,
  now,
  quantity = 1,
  tiers = [],
}: EffectivePriceInput): EffectivePriceResult {
  if (!prices) {
    return { price: null, source: null };
  }

  const ts = now.toISOString();

  // Promo price within validity window
  if (prices.promo) {
    if (ts >= prices.promo.validFrom && ts <= prices.promo.validTo) {
      return { price: prices.promo.price, source: "PROMO" };
    }
  }

  // Account-specific override
  if (prices.accountOverrides && prices.accountOverrides[accountId] != null) {
    return {
      price: prices.accountOverrides[accountId]!,
      source: "ACCOUNT_OVERRIDE",
    };
  }

  // Quantity-based pricing breaks (takes precedence over tier pricing)
  if (prices.quantityBreaks && prices.quantityBreaks.length > 0 && quantity > 0) {
    // Sort breaks by minQuantity (descending) to find the best match
    const sortedBreaks = [...prices.quantityBreaks].sort((a, b) => b.minQuantity - a.minQuantity);
    
    for (const break_ of sortedBreaks) {
      const matchesMin = quantity >= break_.minQuantity;
      const matchesMax = break_.maxQuantity == null || quantity <= break_.maxQuantity;
      
      if (matchesMin && matchesMax) {
        return {
          price: break_.price,
          source: "TIER", // Using TIER source for quantity breaks
        };
      }
    }
  }

  // Volume-based tier price (if tiers and quantity provided)
  if (tiers.length > 0 && quantity > 0 && prices.tierPrices) {
    // Sort tiers by order (ascending) or by minQuantity (descending for best match)
    const sortedTiers = [...tiers]
      .filter((tier) => {
        // Check if tier has volume thresholds
        const hasVolume = tier.minQuantity != null || tier.maxQuantity != null;
        // Check if quantity matches this tier's range
        const matchesMin = tier.minQuantity == null || quantity >= tier.minQuantity;
        const matchesMax = tier.maxQuantity == null || quantity <= tier.maxQuantity;
        return hasVolume && matchesMin && matchesMax;
      })
      .sort((a, b) => {
        // Sort by order if available, otherwise by minQuantity (higher quantity = better tier)
        if (a.order != null && b.order != null) {
          return a.order - b.order;
        }
        const aMin = a.minQuantity ?? 0;
        const bMin = b.minQuantity ?? 0;
        return bMin - aMin; // Descending - higher thresholds first
      });

    // Find the first matching tier with a price
    for (const tier of sortedTiers) {
      if (prices.tierPrices[tier.id] != null) {
        return {
          price: prices.tierPrices[tier.id]!,
          source: "TIER",
          tierId: tier.id,
        };
      }
    }
  }

  // Fallback to account's tier price (non-volume-based)
  if (prices.tierPrices && prices.tierPrices[tierId] != null) {
    return {
      price: prices.tierPrices[tierId]!,
      source: "TIER",
      tierId: tierId,
    };
  }

  return { price: prices.basePrice, source: "BASE" };
}


