"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, use, useMemo } from "react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  GuitarDoc,
  AvailabilityDoc,
  PricesDoc,
  AvailabilityState,
  GuitarOption,
} from "@/lib/types";
import { computeEffectivePrice } from "@/lib/pricing";
import { TierDoc } from "@/lib/types";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { PriceTag } from "@/components/guitars/PriceTag";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import { ImageCarousel } from "@/components/guitars/ImageCarousel";
import { SpecTable } from "@/components/guitars/SpecTable";
import { OptionSelector } from "@/components/guitars/OptionSelector";

export default function GuitarDetailPage({
  params,
}: {
  params: Promise<{ guitarId: string }>;
}) {
  const { guitarId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [guitar, setGuitar] = useState<GuitarDoc | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDoc | null>(
    null,
  );
  const [prices, setPrices] = useState<PricesDoc | null>(null);
  const [tiers, setTiers] = useState<Array<TierDoc & { id: string }>>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  // Fetch guitar data
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.accountId || !user.tierId || !user.currency) {
      router.push("/dealer");
      return;
    }

    async function fetchGuitar() {
      setFetching(true);
      setError(null);
      try {
        const [guitarSnap, availabilitySnap, pricesSnap, tiersSnap] = await Promise.all([
          getDoc(doc(db, "guitars", guitarId)),
          getDoc(doc(db, "availability", guitarId)),
          getDoc(doc(db, "prices", guitarId)),
          getDocs(collection(db, "tiers")),
        ]);

        if (!guitarSnap.exists()) {
          setError("Guitar not found");
          setFetching(false);
          return;
        }

        const guitarData = guitarSnap.data() as GuitarDoc;
        setGuitar(guitarData);
        setDisplayImages(guitarData.images || []);
        
        setAvailability(
          availabilitySnap.exists()
            ? (availabilitySnap.data() as AvailabilityDoc)
            : {
                state: "IN_STOCK" as AvailabilityState,
                qtyAvailable: 0,
                qtyAllocated: 0,
              },
        );
        setPrices(
          pricesSnap.exists() ? (pricesSnap.data() as PricesDoc) : null,
        );

        const tiersData = tiersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<TierDoc & { id: string }>;
        setTiers(tiersData);
      } catch (err) {
        setError("Unable to load guitar details");
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    fetchGuitar();
  }, [guitarId, user, authLoading, router]);

  // Calculate effective price with volume-based tier pricing (recalculates when quantity changes)
  // Must be before any conditional returns to follow Rules of Hooks
  const effectivePrice = useMemo(() => {
    if (!user?.accountId || !user?.tierId || !prices) {
      return { price: null, source: null };
    }
    return computeEffectivePrice({
      prices,
      accountId: user.accountId,
      tierId: user.tierId,
      now: new Date(),
      quantity: quantity, // Pass quantity for volume-based tier pricing
      tiers: tiers, // Pass tiers for volume matching
    });
  }, [prices, user?.accountId, user?.tierId, quantity, tiers]);

  // Update display images when options change - combine base images with option images
  useEffect(() => {
    if (!guitar) return;
    
    const allImages: string[] = [];
    
    // Collect option images from selected options
    if (guitar.options) {
      guitar.options.forEach((option) => {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.images && selectedValue.images.length > 0) {
            allImages.push(...selectedValue.images);
          }
        }
      });
    }
    
    // Add base images (avoid duplicates)
    const baseImages = guitar.images || [];
    baseImages.forEach((img) => {
      if (!allImages.includes(img)) {
        allImages.push(img);
      }
    });
    
    // If we have option images, show them first, then base images
    // Otherwise, just show base images
    setDisplayImages(allImages.length > 0 ? allImages : baseImages);
  }, [selectedOptions, guitar]);

  if (authLoading || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading guitar details…</p>
      </main>
    );
  }

  if (error || !guitar) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error || "Guitar not found"}</p>
        <Link
          href="/dealer"
          className="rounded-full border border-neutral-800 px-4 py-2 text-xs uppercase tracking-wide hover:border-accent hover:text-accent-soft"
        >
          Back to guitars
        </Link>
      </main>
    );
  }

  if (!user || !user.accountId || !user.tierId || !user.currency) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">User account information incomplete</p>
        <Link
          href="/dealer"
          className="rounded-full border border-neutral-800 px-4 py-2 text-xs uppercase tracking-wide hover:border-accent hover:text-accent-soft"
        >
          Back to guitars
        </Link>
      </main>
    );
  }

  // Calculate final price with option adjustments
  const calculateFinalPrice = () => {
    if (!effectivePrice.price) return null;
    let finalPrice = effectivePrice.price;
    
    if (guitar.options) {
      guitar.options.forEach((option) => {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.priceAdjustment) {
            finalPrice += selectedValue.priceAdjustment;
          }
        }
      });
    }
    
    return finalPrice;
  };

  // Build final SKU with option suffixes
  const buildFinalSku = () => {
    let finalSku = guitar.sku;
    
    if (guitar.options) {
      guitar.options.forEach((option) => {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.skuSuffix) {
            finalSku += selectedValue.skuSuffix;
          }
        }
      });
    }
    
    return finalSku;
  };

  const handleOptionChange = (optionId: string, valueId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionId]: valueId,
    }));
  };

  const validateOptions = () => {
    if (!guitar.options) return true;
    return guitar.options.every((option) => {
      if (!option.required) return true;
      return selectedOptions[option.optionId] != null;
    });
  };

  const onAddToCart = () => {
    if (effectivePrice.price == null) {
      alert("Price not available for this product");
      return;
    }
    if (!validateOptions()) {
      alert("Please select all required options");
      return;
    }

    const finalPrice = calculateFinalPrice();
    if (finalPrice == null) {
      alert("Unable to calculate price");
      return;
    }

    setAddingToCart(true);

    // Get image from selected option or use base image
    let imageUrl = guitar.images?.[0] ?? null;
    if (guitar.options) {
      for (const option of guitar.options) {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.images && selectedValue.images.length > 0) {
            imageUrl = selectedValue.images[0];
            break;
          }
        }
      }
    }

    addItem(
      {
        guitarId: guitarId,
        sku: buildFinalSku(),
        name: guitar.name,
        imageUrl,
        unitPrice: finalPrice,
        priceSource: effectivePrice.source,
        selectedOptions: { ...selectedOptions },
      },
      quantity,
    );

    // Show success message
    setAddingToCart(false);
    setCartSuccess(true);
    setTimeout(() => setCartSuccess(false), 3000);
  };

  return (
    <main className="flex flex-1 flex-col gap-8">
      <Link
        href="/dealer"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-accent-soft"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to guitars
      </Link>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Image Carousel */}
        <div className="space-y-6">
          <ImageCarousel images={displayImages} name={guitar.name} />
          
          {/* Specifications */}
          {guitar.specs && (
            <SpecTable
              specs={guitar.specs}
            />
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-6">
          {/* Product Header */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              {guitar.series}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              {guitar.name}
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-sm text-neutral-400">
                SKU: <span className="font-mono font-medium text-white">{buildFinalSku()}</span>
              </p>
              <AvailabilityBadge
                state={availability!.state}
                etaDate={availability!.etaDate}
                batchName={availability!.batchName}
              />
            </div>
          </div>

          {/* Options Selector */}
          <div className="space-y-6 rounded-2xl border border-white/10 bg-surface/80 p-6 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {guitar.options && guitar.options.length > 0
                ? "Select Options"
                : "Product Configuration"}
            </h2>
            
            {guitar.options && guitar.options.length > 0 ? (
              <div className="space-y-6">
                {guitar.options.map((option) => (
                  <OptionSelector
                    key={option.optionId}
                    option={option}
                    value={selectedOptions[option.optionId] || null}
                    onChange={(valueId) =>
                      handleOptionChange(option.optionId, valueId)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                No additional options available for this product.
              </p>
            )}

            {/* Selected Options Summary */}
            {guitar.options &&
              guitar.options.length > 0 &&
              Object.keys(selectedOptions).length > 0 && (
                <div className="mt-6 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Selected Configuration
                  </h3>
                  <div className="space-y-2">
                    {guitar.options.map((option) => {
                      const selectedValueId = selectedOptions[option.optionId];
                      if (!selectedValueId) return null;
                      const selectedValue = option.values.find(
                        (v) => v.valueId === selectedValueId,
                      );
                      if (!selectedValue) return null;
                      return (
                        <div
                          key={option.optionId}
                          className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2"
                        >
                          <span className="text-sm text-neutral-400">{option.label}:</span>
                          <span className="text-sm font-semibold text-white">
                            {selectedValue.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>

          {/* Quantity & Pricing */}
          <div className="space-y-6 rounded-2xl border border-white/10 bg-surface/80 p-6 shadow-soft">
            {/* Quantity Selector */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-white">
                Quantity
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white/10 bg-white/5 text-xl font-medium text-white transition hover:border-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) {
                      setQuantity(val);
                    }
                  }}
                  className="flex-1 rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-center text-lg font-semibold text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white/10 bg-white/5 text-xl font-medium text-white transition hover:border-accent hover:bg-accent/20"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-3 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Base Price</span>
                <PriceTag
                  price={effectivePrice.price}
                  currency={user.currency}
                  note={
                    effectivePrice.source === "PROMO"
                      ? "Promo price"
                      : effectivePrice.source === "ACCOUNT_OVERRIDE"
                      ? "Account-specific price"
                      : effectivePrice.source === "TIER"
                      ? `Tier ${user.tierId} price`
                      : null
                  }
                />
              </div>
              
              {/* Option price adjustments */}
              {guitar.options &&
                guitar.options.some((option) => {
                  const selectedValueId = selectedOptions[option.optionId];
                  if (selectedValueId) {
                    const selectedValue = option.values.find(
                      (v) => v.valueId === selectedValueId,
                    );
                    return selectedValue?.priceAdjustment != null;
                  }
                  return false;
                }) && (
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    {guitar.options.map((option) => {
                      const selectedValueId = selectedOptions[option.optionId];
                      if (!selectedValueId) return null;
                      const selectedValue = option.values.find(
                        (v) => v.valueId === selectedValueId,
                      );
                      if (!selectedValue?.priceAdjustment) return null;
                      return (
                        <div
                          key={option.optionId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-neutral-400">
                            {option.label}: {selectedValue.label}
                          </span>
                          <span
                            className={
                              selectedValue.priceAdjustment > 0
                                ? "font-medium text-green-400"
                                : "font-medium text-red-400"
                            }
                          >
                            {selectedValue.priceAdjustment > 0 ? "+" : ""}
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: user.currency || "USD",
                            }).format(selectedValue.priceAdjustment)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              
              {/* Volume Pricing Structure */}
              {prices?.quantityBreaks && prices.quantityBreaks.length > 0 && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Volume Pricing
                  </p>
                  <div className="space-y-1.5 rounded-lg border border-white/5 bg-black/20 p-3">
                    {prices.quantityBreaks
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((break_, index) => {
                        const isCurrentBreak =
                          quantity >= break_.minQuantity &&
                          (break_.maxQuantity == null || quantity <= break_.maxQuantity);
                        const rangeLabel =
                          break_.maxQuantity != null
                            ? `${break_.minQuantity}-${break_.maxQuantity} units`
                            : `${break_.minQuantity}+ units`;
                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between rounded px-2 py-1.5 text-xs transition ${
                              isCurrentBreak
                                ? "bg-accent/20 text-white"
                                : "text-neutral-400"
                            }`}
                          >
                            <span className="font-medium">{rangeLabel}</span>
                            <span
                              className={
                                isCurrentBreak
                                  ? "font-bold text-accent"
                                  : "font-semibold"
                              }
                            >
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: user.currency || "USD",
                              }).format(break_.price)}
                              {isCurrentBreak && (
                                <span className="ml-1.5 text-[10px]">(current)</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Unit Price */}
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <span className="text-base font-semibold text-white">
                  Unit Price
                </span>
                <span className="text-2xl font-bold text-accent">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: user.currency || "USD",
                  }).format(calculateFinalPrice() || effectivePrice.price || 0)}
                </span>
              </div>

              {/* Total Price */}
              {calculateFinalPrice() && (
                <div className="flex items-baseline justify-between rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
                  <span className="text-sm font-semibold text-white">
                    Total ({quantity} {quantity === 1 ? "item" : "items"})
                  </span>
                  <span className="text-xl font-bold text-accent">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: user.currency || "USD",
                    }).format(calculateFinalPrice()! * quantity)}
                  </span>
                </div>
              )}
            </div>
          </div>


          {/* Add to Cart Button */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={
                effectivePrice.price == null ||
                !validateOptions() ||
                addingToCart ||
                quantity < 1
              }
              onClick={onAddToCart}
              className="w-full rounded-full bg-accent px-6 py-4 text-base font-semibold text-black shadow-lg transition-all hover:scale-[1.02] hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-neutral-800 disabled:text-neutral-400 disabled:shadow-none"
            >
              {addingToCart ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Adding...
                </span>
              ) : (
                `Add ${quantity} to cart`
              )}
            </button>

            {/* Success Message */}
            {cartSuccess && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
                <p className="text-sm font-medium text-green-400">
                  ✓ Added {quantity} {quantity === 1 ? "item" : "items"} to cart!
                </p>
              </div>
            )}

            {/* Disabled State Message */}
            {effectivePrice.price == null && (
              <p className="text-center text-xs text-red-400">
                Price not available for this product
              </p>
            )}
            {effectivePrice.price != null &&
              !validateOptions() &&
              guitar.options &&
              guitar.options.some((o) => o.required) && (
                <p className="text-center text-xs text-yellow-400">
                  Please select all required options
                </p>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}

