"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  AccountDoc,
  AvailabilityDoc,
  AvailabilityState,
  GuitarDoc,
  OrderDoc,
  PricesDoc,
} from "@/lib/types";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { ImageCarousel } from "@/components/guitars/ImageCarousel";
import { OptionSelector } from "@/components/guitars/OptionSelector";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function AdminAddGuitarToOrderPage({
  params,
}: {
  params: Promise<{ orderId: string; guitarId: string }>;
}) {
  const { orderId, guitarId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<(OrderDoc & { id: string }) | null>(null);
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(
    null,
  );
  const [guitar, setGuitar] = useState<GuitarDoc | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDoc | null>(
    null,
  );
  const [prices, setPrices] = useState<PricesDoc | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      setError(null);
      try {
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) {
          if (!cancelled) setError("Order not found");
          return;
        }
        const orderData = {
          id: orderSnap.id,
          ...(orderSnap.data() as OrderDoc),
        };
        if (cancelled) return;
        setOrder(orderData);

        const [guitarSnap, availabilitySnap, pricesSnap, accountSnap] =
          await Promise.all([
            getDoc(doc(db, "guitars", guitarId)),
            getDoc(doc(db, "availability", guitarId)),
            getDoc(doc(db, "prices", guitarId)),
            getDoc(doc(db, "accounts", orderData.accountId)),
          ]);
        if (cancelled) return;
        if (!guitarSnap.exists()) {
          setError("Guitar not found");
          setGuitar(null);
          return;
        }
        const g = guitarSnap.data() as GuitarDoc;
        setGuitar(g);
        setDisplayImages(g.images || []);
        setAvailability(
          availabilitySnap.exists()
            ? (availabilitySnap.data() as AvailabilityDoc)
            : {
                state: "PREORDER" as AvailabilityState,
                qtyAvailable: 0,
                qtyAllocated: 0,
              },
        );
        setPrices(pricesSnap.exists() ? (pricesSnap.data() as PricesDoc) : null);
        if (accountSnap.exists()) {
          setAccount({
            id: accountSnap.id,
            ...(accountSnap.data() as AccountDoc),
          });
        } else {
          setAccount(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load product");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guitarId, orderId]);

  useEffect(() => {
    if (!guitar) return;
    let optionImages: string[] | null = null;
    if (guitar.options) {
      for (const option of guitar.options) {
        const selectedValueId = selectedOptions[option.optionId];
        if (selectedValueId) {
          const selectedValue = option.values.find(
            (v) => v.valueId === selectedValueId,
          );
          if (selectedValue?.images && selectedValue.images.length > 0) {
            optionImages = [...selectedValue.images];
            break;
          }
        }
      }
    }
    if (optionImages && optionImages.length > 0) {
      setDisplayImages(optionImages);
    } else {
      setDisplayImages(guitar.images || []);
    }
  }, [selectedOptions, guitar]);

  const effectivePrice = useMemo((): { price: number | null } => {
    if (!prices || !guitar) return { price: null };
    const rrp = getRRPForVariant(
      prices,
      guitar.options ?? null,
      selectedOptions,
      account?.discountPercent ?? 0,
    );
    if (rrp == null) return { price: null };
    const discountPercent = account?.discountPercent ?? 0;
    const price = getDealerPriceFromRRP(rrp, discountPercent);
    return { price };
  }, [prices, guitar, selectedOptions, account?.discountPercent]);

  function buildFinalSku() {
    if (!guitar) return "";
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
  }

  function validateOptions() {
    if (!guitar?.options) return true;
    return guitar.options.every((option) => {
      if (!option.required) return true;
      return selectedOptions[option.optionId] != null;
    });
  }

  async function handleAdd() {
    if (!order || !guitar || effectivePrice.price == null) {
      alert("Price not available");
      return;
    }
    if (!validateOptions()) {
      alert("Select all required options");
      return;
    }
    if (quantity < 1) {
      alert("Quantity must be at least 1.");
      return;
    }

    setAdding(true);
    try {
      const unitPrice = Math.round(effectivePrice.price * 100) / 100;
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      const lineRef = doc(collection(db, "orders", orderId, "lines"));
      const batch = writeBatch(db);
      batch.set(lineRef, {
        guitarId,
        sku: buildFinalSku(),
        name: guitar.name,
        qty: quantity,
        unitPrice,
        lineTotal,
        selectedOptions:
          Object.keys(selectedOptions).length > 0 ? { ...selectedOptions } : null,
        isNewOnOrder: true,
        addedViaOrmsbyApproval: true,
      });
      await batch.commit();

      const orderSnap = await getDoc(doc(db, "orders", orderId));
      const currentSubtotal = orderSnap.exists()
        ? ((orderSnap.data() as OrderDoc).totals?.subtotal ?? 0)
        : order.totals.subtotal;

      await updateDoc(doc(db, "orders", orderId), {
        totals: {
          subtotal: Math.round((currentSubtotal + lineTotal) * 100) / 100,
          currency: order.currency,
        },
        updatedAt: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/orders/${orderId}`);
      }, 900);
    } catch (err) {
      console.error("Error adding guitar to order:", err);
      alert("Failed to add guitar to order.");
    } finally {
      setAdding(false);
    }
  }

  if (fetching) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </main>
      </AdminGuard>
    );
  }

  if (error || !guitar || !availability || !order) {
    return (
      <AdminGuard>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-sm text-red-400">{error || "Not found"}</p>
          <Link
            href={`/admin/orders/${orderId}/add`}
            className="text-accent hover:underline"
          >
            Back to catalog
          </Link>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/admin/orders/${orderId}`}
            className="text-neutral-400 hover:text-white"
          >
            Order
          </Link>
          <span className="text-neutral-600">/</span>
          <Link
            href={`/admin/orders/${orderId}/add`}
            className="text-neutral-400 hover:text-white"
          >
            Add guitar
          </Link>
          <span className="text-neutral-600">/</span>
          <span className="text-white">{guitar.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/admin/orders/${orderId}/add`}
              className="mb-2 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to catalog
            </Link>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              {guitar.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-neutral-500">
              {buildFinalSku()}
            </p>
            <div className="mt-2">
              <AvailabilityBadge
                state={availability.state}
                etaDate={availability.etaDate}
                batchName={availability.batchName}
              />
            </div>
          </div>
          <Link
            href={`/admin/orders/${orderId}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            View order
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <ImageCarousel images={displayImages} name={guitar.name} />
          </section>

          <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500">
                Dealer price (AUD)
              </p>
              <p className="text-3xl font-bold text-accent">
                {effectivePrice.price != null
                  ? new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: "AUD",
                    }).format(effectivePrice.price)
                  : "—"}
              </p>
              {account && (
                <p className="mt-1 text-xs text-neutral-500">
                  Account: {account.name} · discount{" "}
                  {account.discountPercent ?? 0}% off RRP
                </p>
              )}
            </div>

            {guitar.options && guitar.options.length > 0 ? (
              <div className="space-y-4">
                {guitar.options.map((option) => (
                  <OptionSelector
                    key={option.optionId}
                    option={option}
                    value={selectedOptions[option.optionId] || null}
                    onChange={(valueId) =>
                      setSelectedOptions((prev) => ({
                        ...prev,
                        [option.optionId]: valueId,
                      }))
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No options.</p>
            )}

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm text-white">Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-white/10 text-lg"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) setQuantity(v);
                  }}
                  className="w-14 rounded border border-white/10 bg-black/30 py-1 text-center text-sm"
                />
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-white/10 text-lg"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={
                adding ||
                success ||
                effectivePrice.price == null ||
                !validateOptions() ||
                quantity < 1
              }
              onClick={() => void handleAdd()}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-black hover:bg-accent-soft disabled:opacity-40"
            >
              {adding
                ? "Adding…"
                : success
                  ? "Added — returning to order…"
                  : `Add ${quantity} to this order`}
            </button>
          </section>
        </div>
      </main>
    </AdminGuard>
  );
}
