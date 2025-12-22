"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuitarDoc, PricesDoc, TierDoc, AccountDoc, PromoPrice, QuantityBreak } from "@/lib/types";
import Link from "next/link";
import { ArrowLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { collection, getDocs } from "firebase/firestore";

export default function EditPricingPage({
  params,
}: {
  params: Promise<{ guitarId: string }>;
}) {
  const { guitarId } = use(params);
  const [guitar, setGuitar] = useState<GuitarDoc | null>(null);
  const [prices, setPrices] = useState<PricesDoc | null>(null);
  const [tiers, setTiers] = useState<Array<TierDoc & { id: string }>>([]);
  const [accounts, setAccounts] = useState<Array<AccountDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    currency: string;
    basePrice: string;
    quantityBreaks: Array<{ minQuantity: string; maxQuantity: string; price: string }>;
    tierPrices: Record<string, string>;
    accountOverrides: Record<string, string>;
    promo: {
      price: string;
      validFrom: string;
      validTo: string;
    } | null;
  }>({
    currency: "USD",
    basePrice: "",
    quantityBreaks: [],
    tierPrices: {},
    accountOverrides: {},
    promo: null,
  });

  useEffect(() => {
    fetchData();
  }, [guitarId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [guitarSnap, pricesSnap, tiersSnap, accountsSnap] = await Promise.all([
        getDoc(doc(db, "guitars", guitarId)),
        getDoc(doc(db, "prices", guitarId)),
        getDocs(collection(db, "tiers")),
        getDocs(collection(db, "accounts")),
      ]);

      if (!guitarSnap.exists()) {
        setError("Guitar not found");
        setLoading(false);
        return;
      }

      setGuitar(guitarSnap.data() as GuitarDoc);

      const pricesData = pricesSnap.exists()
        ? (pricesSnap.data() as PricesDoc)
        : null;
      setPrices(pricesData);

      const tiersData = tiersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<TierDoc & { id: string }>;
      setTiers(tiersData);

      const accountsData = accountsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<AccountDoc & { id: string }>;
      setAccounts(accountsData);

      // Initialize form data
      if (pricesData) {
        const tierPrices: Record<string, string> = {};
        if (pricesData.tierPrices) {
          Object.entries(pricesData.tierPrices).forEach(([tierId, price]) => {
            if (price != null) {
              tierPrices[tierId] = price.toString();
            }
          });
        }

        const accountOverrides: Record<string, string> = {};
        if (pricesData.accountOverrides) {
          Object.entries(pricesData.accountOverrides).forEach(([accountId, price]) => {
            if (price != null) {
              accountOverrides[accountId] = price.toString();
            }
          });
        }

        const quantityBreaks = pricesData.quantityBreaks
          ? pricesData.quantityBreaks.map((qb) => ({
              minQuantity: qb.minQuantity.toString(),
              maxQuantity: qb.maxQuantity?.toString() || "",
              price: qb.price.toString(),
            }))
          : [];

        setFormData({
          currency: pricesData.currency || "USD",
          basePrice: pricesData.basePrice?.toString() || "",
          quantityBreaks,
          tierPrices,
          accountOverrides,
          promo: pricesData.promo
            ? {
                price: pricesData.promo.price.toString(),
                validFrom: pricesData.promo.validFrom.split("T")[0],
                validTo: pricesData.promo.validTo.split("T")[0],
              }
            : null,
        });
      } else {
        // Initialize with default values if no price document exists
        setFormData({
          currency: "USD",
          basePrice: "",
          quantityBreaks: [],
          tierPrices: {},
          accountOverrides: {},
          promo: null,
        });
      }
    } catch (err) {
      console.error("Error fetching pricing data:", err);
      setError("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const basePrice = parseFloat(formData.basePrice);
      if (isNaN(basePrice) || basePrice < 0) {
        setError("Base price must be a valid positive number");
        setSaving(false);
        return;
      }

      const tierPrices: Record<string, number> = {};
      Object.entries(formData.tierPrices).forEach(([tierId, priceStr]) => {
        if (priceStr && priceStr.trim()) {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price >= 0) {
            tierPrices[tierId] = price;
          }
        }
      });

      const accountOverrides: Record<string, number> = {};
      Object.entries(formData.accountOverrides).forEach(([accountId, priceStr]) => {
        if (priceStr && priceStr.trim()) {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price >= 0) {
            accountOverrides[accountId] = price;
          }
        }
      });

      // Process quantity breaks
      const quantityBreaks: QuantityBreak[] = [];
      for (const qb of formData.quantityBreaks) {
        const minQty = parseInt(qb.minQuantity, 10);
        const maxQtyStr = qb.maxQuantity?.trim();
        const maxQty = maxQtyStr ? parseInt(maxQtyStr, 10) : undefined;
        const price = parseFloat(qb.price);
        
        if (!isNaN(minQty) && minQty > 0 && !isNaN(price) && price >= 0) {
          if (maxQty != null && (isNaN(maxQty) || maxQty < minQty)) {
            setError(`Invalid quantity range: max must be >= min for break starting at ${minQty}`);
            setSaving(false);
            return;
          }
          
          // Create break object - only include maxQuantity if it's defined
          const breakObj: QuantityBreak = {
            minQuantity: minQty,
            price: price,
          };
          
          // Only add maxQuantity if it's a valid number
          if (maxQty != null && !isNaN(maxQty)) {
            breakObj.maxQuantity = maxQty;
          }
          
          quantityBreaks.push(breakObj);
        }
      }
      
      // Sort quantity breaks by minQuantity
      quantityBreaks.sort((a, b) => a.minQuantity - b.minQuantity);

      let promo: PromoPrice | null = null;
      if (formData.promo && formData.promo.price.trim()) {
        const promoPrice = parseFloat(formData.promo.price);
        if (isNaN(promoPrice) || promoPrice < 0) {
          setError("Promo price must be a valid positive number");
          setSaving(false);
          return;
        }

        const validFrom = new Date(formData.promo.validFrom);
        const validTo = new Date(formData.promo.validTo);
        if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
          setError("Promo dates must be valid");
          setSaving(false);
          return;
        }

        if (validFrom >= validTo) {
          setError("Promo end date must be after start date");
          setSaving(false);
          return;
        }

        promo = {
          price: promoPrice,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
        };
      }

      // Build prices document, only including fields that have values
      const pricesDoc: PricesDoc = {
        guitarId,
        currency: formData.currency,
        basePrice,
      };

      // Only add optional fields if they have values (Firestore doesn't accept undefined)
      if (quantityBreaks.length > 0) {
        pricesDoc.quantityBreaks = quantityBreaks;
      }
      if (Object.keys(tierPrices).length > 0) {
        pricesDoc.tierPrices = tierPrices;
      }
      if (Object.keys(accountOverrides).length > 0) {
        pricesDoc.accountOverrides = accountOverrides;
      }
      if (promo) {
        pricesDoc.promo = promo;
      }

      // Clean up any undefined values recursively (safety check)
      const cleanDoc = JSON.parse(JSON.stringify(pricesDoc));

      await setDoc(doc(db, "prices", guitarId), cleanDoc, { merge: true });

      // Refresh data
      await fetchData();
      alert("Pricing updated successfully!");
    } catch (err) {
      console.error("Error saving pricing:", err);
      setError("Failed to save pricing");
    } finally {
      setSaving(false);
    }
  }

  function updateTierPrice(tierId: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      tierPrices: {
        ...prev.tierPrices,
        [tierId]: value,
      },
    }));
  }

  function updateAccountOverride(accountId: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      accountOverrides: {
        ...prev.accountOverrides,
        [accountId]: value,
      },
    }));
  }

  function togglePromo() {
    setFormData((prev) => ({
      ...prev,
      promo: prev.promo
        ? null
        : {
            price: "",
            validFrom: new Date().toISOString().split("T")[0],
            validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          },
    }));
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading pricing...</p>
        </main>
      </AdminGuard>
    );
  }

  if (error && !guitar) {
    return (
      <AdminGuard>
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <Link
            href="/admin/pricing"
            className="rounded-full border border-neutral-800 px-4 py-2 text-xs uppercase tracking-wide hover:border-accent hover:text-accent-soft"
          >
            Back to pricing
          </Link>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pricing"
            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Edit Pricing
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              {guitar?.name} ({guitar?.sku})
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Pricing Form */}
        <div className="glass-strong rounded-3xl p-8 shadow-xl">
          <div className="space-y-8">
            {/* Base Price */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Base Price <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.basePrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, basePrice: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
                placeholder="0.00"
                required
              />
              <p className="mt-1 text-xs text-neutral-400">
                This is the default price used if no tier or account override is set
              </p>
            </div>

            {/* Quantity-Based Pricing */}
            <div>
              <label className="mb-4 block text-sm font-semibold text-white">
                Quantity-Based Pricing (Optional)
              </label>
              <p className="mb-4 text-xs text-neutral-400">
                Set prices based on order quantity. Higher priority than tier pricing.
              </p>
              <div className="space-y-3">
                {formData.quantityBreaks.map((qb, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-neutral-400">
                          Min Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={qb.minQuantity}
                          onChange={(e) => {
                            const newBreaks = [...formData.quantityBreaks];
                            newBreaks[index].minQuantity = e.target.value;
                            setFormData((prev) => ({ ...prev, quantityBreaks: newBreaks }));
                          }}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-neutral-400">
                          Max Qty (optional)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={qb.maxQuantity}
                          onChange={(e) => {
                            const newBreaks = [...formData.quantityBreaks];
                            newBreaks[index].maxQuantity = e.target.value;
                            setFormData((prev) => ({ ...prev, quantityBreaks: newBreaks }));
                          }}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                          placeholder="∞"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-neutral-400">
                          Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={qb.price}
                          onChange={(e) => {
                            const newBreaks = [...formData.quantityBreaks];
                            newBreaks[index].price = e.target.value;
                            setFormData((prev) => ({ ...prev, quantityBreaks: newBreaks }));
                          }}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newBreaks = formData.quantityBreaks.filter((_, i) => i !== index);
                        setFormData((prev) => ({ ...prev, quantityBreaks: newBreaks }));
                      }}
                      className="rounded-lg border border-red-500/20 p-2 text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10"
                      title="Remove break"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      quantityBreaks: [
                        ...prev.quantityBreaks,
                        { minQuantity: "", maxQuantity: "", price: "" },
                      ],
                    }));
                  }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent hover:bg-accent/10"
                >
                  + Add Quantity Break
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Example: 1-5 units = $100, 6-10 units = $90, 11+ units = $80
              </p>
            </div>

            {/* Tier Prices */}
            {tiers.length > 0 && (
              <div>
                <label className="mb-4 block text-sm font-semibold text-white">
                  Volume-Based Tier Prices (Optional)
                </label>
                <p className="mb-4 text-xs text-neutral-400">
                  Set prices based on order quantity. Tiers are matched by volume thresholds.
                </p>
                <div className="space-y-3">
                  {tiers
                    .sort((a, b) => {
                      // Sort by order if available, otherwise by minQuantity
                      if (a.order != null && b.order != null) {
                        return a.order - b.order;
                      }
                      const aMin = a.minQuantity ?? 0;
                      const bMin = b.minQuantity ?? 0;
                      return aMin - bMin;
                    })
                    .map((tier) => {
                      const volumeRange = tier.minQuantity != null || tier.maxQuantity != null
                        ? tier.maxQuantity != null
                          ? `${tier.minQuantity ?? 1}+ units`
                          : tier.minQuantity
                          ? `${tier.minQuantity}+ units`
                          : `1-${tier.maxQuantity} units`
                        : null;
                      
                      return (
                        <div
                          key={tier.id}
                          className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{tier.name}</p>
                              {volumeRange && (
                                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
                                  {volumeRange}
                                </span>
                              )}
                            </div>
                            {tier.description && (
                              <p className="mt-1 text-xs text-neutral-400">{tier.description}</p>
                            )}
                            {tier.minQuantity != null || tier.maxQuantity != null ? (
                              <p className="mt-1 text-xs text-neutral-500">
                                Min: {tier.minQuantity ?? "1"} | Max: {tier.maxQuantity ?? "∞"}
                              </p>
                            ) : null}
                          </div>
                          <div className="w-32">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.tierPrices[tier.id] || ""}
                              onChange={(e) => updateTierPrice(tier.id, e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                              placeholder="Auto"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Leave empty to use base price for this tier. Prices are matched based on order quantity.
                </p>
              </div>
            )}

            {/* Account Overrides */}
            {accounts.length > 0 && (
              <div>
                <label className="mb-4 block text-sm font-semibold text-white">
                  Account-Specific Overrides (Optional)
                </label>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{account.name}</p>
                        <p className="text-xs text-neutral-400">
                          Tier: {tiers.find((t) => t.id === account.tierId)?.name || account.tierId}
                        </p>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.accountOverrides[account.id] || ""}
                          onChange={(e) => updateAccountOverride(account.id, e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-accent focus:outline-none"
                          placeholder="Auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Leave empty to use tier or base price for this account
                </p>
              </div>
            )}

            {/* Promo Price */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <label className="block text-sm font-semibold text-white">
                  Promotional Pricing (Optional)
                </label>
                <button
                  type="button"
                  onClick={togglePromo}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  {formData.promo ? "Remove Promo" : "Add Promo"}
                </button>
              </div>
              {formData.promo && (
                <div className="space-y-4 rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-white">
                      Promo Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.promo.price}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          promo: prev.promo
                            ? { ...prev.promo, price: e.target.value }
                            : null,
                        }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-white">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.promo.validFrom}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            promo: prev.promo
                              ? { ...prev.promo, validFrom: e.target.value }
                              : null,
                          }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-white">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.promo.validTo}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            promo: prev.promo
                              ? { ...prev.promo, validTo: e.target.value }
                              : null,
                          }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Promo prices take priority over all other pricing when active
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-4 border-t border-white/10 pt-6">
              <Link
                href="/admin/pricing"
                className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/5"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Pricing"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}

