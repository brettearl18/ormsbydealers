"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { httpsCallable } from "firebase/functions";
import { functions, db, auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { AccountDoc } from "@/lib/types";
import Link from "next/link";
import { OrderReviewItem } from "@/components/checkout/OrderReviewItem";
import { PencilIcon, CheckIcon } from "@heroicons/react/24/outline";

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, subtotal, clear } = useCart();
  const router = useRouter();

  const [company, setCompany] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("United States");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountDoc | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [editingShipping, setEditingShipping] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Fetch account information to pre-fill company name
  useEffect(() => {
    async function fetchAccount() {
      if (!user?.accountId) {
        setLoadingAccount(false);
        return;
      }

      try {
        const accountDoc = await getDoc(doc(db, "accounts", user.accountId));
        if (accountDoc.exists()) {
          const accountData = accountDoc.data() as AccountDoc;
          setAccount(accountData);
          // Pre-fill company name from account
          if (accountData.name) {
            setCompany(accountData.name);
          }
        }
      } catch (err) {
        console.error("Error fetching account:", err);
      } finally {
        setLoadingAccount(false);
      }
    }

    if (!authLoading && user?.accountId) {
      fetchAccount();
    } else if (!authLoading) {
      setLoadingAccount(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || loadingAccount) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading checkout…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (items.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-semibold">No items in cart</h1>
          <p className="text-sm text-neutral-400">
            Add guitars to your cart before submitting a purchase order.
          </p>
        </div>
        <Link
          href="/dealer"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
        >
          Back to guitars
        </Link>
      </main>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!agreedToTerms) {
      setError(
        "Please confirm that you have read and agree to the purchase order Terms & Conditions.",
      );
      setSubmitting(false);
      return;
    }

    // Ensure user is authenticated
    if (!user) {
      setError("You must be logged in to submit an order.");
      setSubmitting(false);
      router.push("/login");
      return;
    }

    try {
      // Ensure we have a valid auth token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError("You must be logged in to submit an order.");
        setSubmitting(false);
        router.push("/login");
        return;
      }

      // Get fresh auth token
      await getIdToken(currentUser, true);
      
      const submitOrderFn = httpsCallable(functions, "submitOrder");
      const result = await submitOrderFn({
        cartItems: items.map((item) => ({
          guitarId: item.guitarId,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          selectedOptions: item.selectedOptions, // Include selected options
        })),
        shippingAddress: {
          company: company || undefined,
          line1,
          line2: line2 || undefined,
          city,
          region: region || undefined,
          postalCode: postalCode || undefined,
          country,
        },
        poNumber: poNumber || undefined,
        notes: notes || undefined,
      });

      const orderId = (result.data as any)?.orderId;
      clear();
      router.push(`/orders/confirmation${orderId ? `?orderId=${orderId}` : ""}`);
    } catch (err: any) {
      console.error("Checkout error:", err);
      let errorMessage = "Unable to submit order right now. Please try again.";
      
      if (err.code === "functions/unauthenticated") {
        errorMessage = "You must be logged in to submit an order.";
      } else if (err.code === "functions/invalid-argument") {
        errorMessage = err.message || "Please check your order details and try again.";
      } else if (err.code === "functions/failed-precondition") {
        errorMessage = err.message || "Your account is not properly configured. Please contact support.";
      } else if (err.code === "functions/internal" || err.code === "internal") {
        errorMessage = err.message || "An internal error occurred. Please try again or contact support if the problem persists.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Review your order and enter shipping details
          </p>
        </div>
        <Link
          href="/dealer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
        >
          ← Continue Shopping
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Delivery Details - 1/3 width */}
        <div className="lg:col-span-1">
          <form
            id="checkout-form"
            onSubmit={onSubmit}
            className="space-y-6 rounded-2xl bg-surface/80 p-6 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Delivery Details
              </h2>
              {!editingShipping && (
                <button
                  type="button"
                  onClick={() => setEditingShipping(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                >
                  <PencilIcon className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>

            {!editingShipping ? (
              /* Read-only view */
              <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                {company && (
                  <div>
                    <p className="text-xs text-neutral-400">Company</p>
                    <p className="text-sm font-medium text-white">{company}</p>
                  </div>
                )}
                {line1 && (
                  <div>
                    <p className="text-xs text-neutral-400">Address</p>
                    <p className="text-sm font-medium text-white">{line1}</p>
                    {line2 && (
                      <p className="text-sm font-medium text-white">{line2}</p>
                    )}
                  </div>
                )}
                {(city || region || postalCode) && (
                  <div>
                    <p className="text-xs text-neutral-400">City, State, Postal</p>
                    <p className="text-sm font-medium text-white">
                      {[city, region, postalCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {country && (
                  <div>
                    <p className="text-xs text-neutral-400">Country</p>
                    <p className="text-sm font-medium text-white">{country}</p>
                  </div>
                )}
                {!company && !line1 && (
                  <p className="text-xs text-neutral-500">No delivery details set</p>
                )}
              </div>
            ) : (
              /* Editable form */
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    placeholder="Your company name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-neutral-400">
                    Address line 1 *
                  </label>
                  <input
                    type="text"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    required
                    className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-neutral-400">
                    Address line 2 (optional)
                  </label>
                  <input
                    type="text"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">City *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">
                      State / Region
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">
                      Postal code
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-neutral-400">
                      Country *
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                      className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingShipping(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/20"
                >
                  <CheckIcon className="h-4 w-4" />
                  Save Details
                </button>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold text-white">Terms & Conditions</p>
              <p className="text-xs text-neutral-400">
                This purchase order is an expression of intent only and does not secure or
                reserve stock until required deposits and final payment have been received
                in full by Ormsby Guitars Pty Ltd.
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                A deposit of $200 per guitar is required and will be invoiced separately.
                Final pricing, shipping, taxes and timelines will be confirmed by Ormsby
                on your order confirmation.
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>
                  I have read and agree to Ormsby Guitars’ dealer/distributor purchase
                  order Terms &amp; Conditions, including the cancellation, payment and
                  quality control policies.
                </span>
              </label>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Purchase Order Info
              </h2>

              <div>
                <label className="mb-1 block text-xs text-neutral-400">
                  PO number (optional)
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-neutral-400">
                  Notes for Ormsby (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special instructions or notes..."
                  className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs text-red-400" role="alert">
                  {error}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Detailed Order Review - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Review Your Order
            </h2>
            <p className="text-sm text-neutral-400">
              Please review all items, configurations, and quantities before submitting your purchase order.
            </p>
          </div>

          {/* Order Items with Details */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <OrderReviewItem key={`${item.guitarId}-${JSON.stringify(item.selectedOptions || {})}-${index}`} item={item} index={index} />
            ))}
          </div>

          {/* Order Summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Order Summary
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="font-medium text-white">
                  {user.currency === "USD" ? "$" : user.currency}{" "}
                  {subtotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Deposit Calculation */}
              {items.length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Deposit Required</span>
                    <span className="font-semibold text-accent">
                      {user.currency === "USD" ? "$" : user.currency}{" "}
                      {(items.reduce((sum, item) => sum + item.qty, 0) * 200).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    $200 per guitar deposit required
                  </p>
                </div>
              )}

            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <Link
                href="/dealer"
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
              >
                Continue Shopping
              </Link>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.getElementById('checkout-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black shadow-lg transition-all hover:scale-[1.02] hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {submitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Submitting order…
                  </>
                ) : (
                  "Submit Purchase Order"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

