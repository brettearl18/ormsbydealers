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
  FxRatesDoc,
  AccountDoc,
} from "@/lib/types";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
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
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(null);
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
  const [fxRates, setFxRates] = useState<FxRatesDoc | null>(null);
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<string>("");

  // Allowed currencies for the FX selector
  const ALLOWED_CURRENCIES = ["AUD", "CAD", "GBP", "USD", "EUR"];

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
        const [guitarSnap, availabilitySnap, pricesSnap, accountSnap, fxSnap] =
          await Promise.all([
            getDoc(doc(db, "guitars", guitarId)),
            getDoc(doc(db, "availability", guitarId)),
            getDoc(doc(db, "prices", guitarId)),
            user?.accountId ? getDoc(doc(db, "accounts", user.accountId)) : Promise.resolve(null),
            getDoc(doc(db, "fxRates", "latest")),
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
        setPrices(pricesSnap.exists() ? (pricesSnap.data() as PricesDoc) : null);

        if (accountSnap?.exists()) {
          setAccount({ id: accountSnap.id, ...accountSnap.data() } as AccountDoc & { id: string });
        } else {
          setAccount(null);
        }

        if (fxSnap.exists()) {
          setFxRates(fxSnap.data() as FxRatesDoc);
        }
      } catch (err) {
        setError("Unable to load guitar details");
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    fetchGuitar();
  }, [guitarId, user, authLoading, router]);

  // Dealer price = RRP × (1 - account.discountPercent/100)
  type PriceSource = "BASE" | "PROMO" | "ACCOUNT_OVERRIDE" | "TIER" | null;
  const effectivePrice = useMemo((): { price: number | null; source: PriceSource } => {
    if (!prices || !guitar) return { price: null, source: null };
    const rrp = getRRPForVariant(prices, guitar.options ?? null, selectedOptions);
    if (rrp == null) return { price: null, source: null };
    const discountPercent = account?.discountPercent ?? 0;
    const price = getDealerPriceFromRRP(rrp, discountPercent);
    return { price, source: "BASE" };
  }, [prices, guitar, selectedOptions, account?.discountPercent]);

  // Update display images when options change - prioritize option-specific images
  useEffect(() => {
    if (!guitar) return;
    
    // Look for option images (prioritize color/visual options)
    // If a selected option has images, use those; otherwise fall back to base images
    let optionImages: string[] | null = null;
    
    if (guitar.options) {
      // Check options in order - if we find images, use them
      for (const option of guitar.options) {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.images && selectedValue.images.length > 0) {
            optionImages = [...selectedValue.images];
            break; // Use the first option with images (typically color)
          }
        }
      }
    }
    
    // If we found option-specific images, use those; otherwise use base images
    if (optionImages && optionImages.length > 0) {
      setDisplayImages(optionImages);
    } else {
      setDisplayImages(guitar.images || []);
    }
  }, [selectedOptions, guitar]);

  // Calculate approximate local currency price (dealer price is already RRP × (1 - discount%))
  const approximateLocalUnit = useMemo(() => {
    if (!effectivePrice.price || !fxRates || !user?.currency) return null;
    const rate =
      user.currency === fxRates.base
        ? 1
        : fxRates.rates[user.currency] ?? null;
    if (!rate) return null;
    return effectivePrice.price * rate;
  }, [effectivePrice.price, fxRates, user?.currency]);

  // Display RRP (base RRP + option RRP adjustments) for dealer reference
  const displayRrp = useMemo(() => {
    const baseRrp = prices?.rrp;
    if (baseRrp == null) return null;
    let rrp = baseRrp;
    if (guitar?.options) {
      for (const option of guitar.options) {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find((v) => v.valueId === selectedValueId);
          if (selectedValue?.rrpAdjustment != null) {
            rrp += selectedValue.rrpAdjustment;
          }
        }
      }
    }
    return rrp;
  }, [prices?.rrp, guitar?.options, selectedOptions]);

  // Calculate converted price for selected display currency (dealer price already includes variant RRP + discount)
  const convertedPrice = useMemo(() => {
    if (!fxRates || !selectedDisplayCurrency || !effectivePrice.price) return null;
    const rate =
      selectedDisplayCurrency === fxRates.base
        ? 1
        : fxRates.rates[selectedDisplayCurrency] ?? null;
    if (!rate) return null;
    return effectivePrice.price * rate;
  }, [effectivePrice.price, fxRates, selectedDisplayCurrency]);

  // Initialize selected display currency to user's currency if available
  useEffect(() => {
    if (fxRates && !selectedDisplayCurrency && user?.currency) {
      setSelectedDisplayCurrency(user.currency);
    }
  }, [fxRates, user?.currency]);

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

  // Dealer price is already RRP × (1 - discount%) for selected variant
  const calculateFinalPrice = () => effectivePrice.price ?? null;

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

      {/* Product Header placed near top for better mobile layout */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {guitar.series}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {guitar.name}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-neutral-400">
            SKU:{" "}
            <span className="font-mono font-medium text-white">
              {buildFinalSku()}
            </span>
          </p>
          <AvailabilityBadge
            state={availability!.state}
            etaDate={availability!.etaDate}
            batchName={availability!.batchName}
          />
        </div>
      </div>

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
              {/* Currency Selector */}
              <div className="mb-4 space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  View Price in Currency
                </label>
                <select
                  value={selectedDisplayCurrency || user?.currency || "USD"}
                  onChange={(e) => setSelectedDisplayCurrency(e.target.value)}
                  disabled={!fxRates}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {fxRates ? (
                    ALLOWED_CURRENCIES.filter((currency) => {
                      // Include currency if it's the base currency or available in rates
                      return currency === fxRates.base || fxRates.rates[currency] != null;
                    }).map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))
                  ) : (
                    ALLOWED_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))
                  )}
                </select>
                {fxRates?.asOf ? (
                  <p className="text-xs text-neutral-500">
                    Exchange rates as of {new Date(fxRates.asOf).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Exchange rates loading...
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Dealer Price (AUD)</span>
                <PriceTag
                  price={effectivePrice.price}
                  currency="AUD"
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

              {displayRrp != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">RRP (AUD)</span>
                  <PriceTag price={displayRrp} currency="AUD" note="Recommended retail" />
                </div>
              )}
              
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
                            {new Intl.NumberFormat("en-AU", {
                              style: "currency",
                              currency: "AUD",
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
                              {new Intl.NumberFormat("en-AU", {
                                style: "currency",
                                currency: "AUD",
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
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-semibold text-white">
                    Unit Price (AUD)
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-accent">
                      {new Intl.NumberFormat("en-AU", {
                        style: "currency",
                        currency: "AUD",
                      }).format(calculateFinalPrice() || effectivePrice.price || 0)}
                    </span>
                    {/* Converted Price Estimate */}
                    {convertedPrice &&
                      selectedDisplayCurrency &&
                      selectedDisplayCurrency !== "AUD" && (
                        <span className="mt-1 text-sm text-neutral-400">
                          ≈ {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: selectedDisplayCurrency,
                          }).format(convertedPrice)}{" "}
                          <span className="text-xs text-neutral-500">
                            (estimate in {selectedDisplayCurrency})
                          </span>
                        </span>
                      )}
                  </div>
                </div>
              </div>

              {/* Total Price */}
              {calculateFinalPrice() && (
                <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-white">
                      Total ({quantity} {quantity === 1 ? "item" : "items"}) (AUD)
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-bold text-accent">
                        {new Intl.NumberFormat("en-AU", {
                          style: "currency",
                          currency: "AUD",
                        }).format(calculateFinalPrice()! * quantity)}
                      </span>
                      {/* Converted Total Estimate */}
                      {convertedPrice &&
                        selectedDisplayCurrency &&
                        selectedDisplayCurrency !== "AUD" && (
                          <span className="mt-1 text-sm text-neutral-300">
                            ≈ {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: selectedDisplayCurrency,
                            }).format(convertedPrice * quantity)}{" "}
                            <span className="text-xs text-neutral-400">
                              (estimate in {selectedDisplayCurrency})
                            </span>
                          </span>
                        )}
                    </div>
                  </div>
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

