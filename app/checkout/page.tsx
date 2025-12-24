"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { httpsCallable } from "firebase/functions";
import { functions, db, auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { AccountDoc, AdminSettingsDoc } from "@/lib/types";
import Link from "next/link";
import { OrderReviewItem } from "@/components/checkout/OrderReviewItem";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string>("");
  const [termsTemplate, setTermsTemplate] = useState<string>("");
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);

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

  // Fetch terms template from admin settings
  useEffect(() => {
    async function fetchTerms() {
      setLoadingTerms(true);
      try {
        const settingsRef = doc(db, "adminSettings", "global");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data() as AdminSettingsDoc;
          setTermsTemplate(settingsData.termsTemplate || "");
        }
      } catch (err) {
        console.error("Error fetching terms template:", err);
      } finally {
        setLoadingTerms(false);
      }
    }

    if (!authLoading) {
      fetchTerms();
    }
  }, [authLoading]);

  // Check if content is short enough that no scrolling is needed
  useEffect(() => {
    if (showTermsModal && termsScrollRef.current && !loadingTerms) {
      const checkScroll = () => {
        if (termsScrollRef.current) {
          const isShortContent =
            termsScrollRef.current.scrollHeight <=
            termsScrollRef.current.clientHeight;
          if (isShortContent) {
            setHasScrolledToBottom(true);
          }
        }
      };
      // Check immediately and after a short delay to account for rendering
      checkScroll();
      const timeout = setTimeout(checkScroll, 100);
      return () => clearTimeout(timeout);
    }
  }, [showTermsModal, loadingTerms, termsTemplate]);

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

    if (!termsAccepted) {
      setWarningMessage(
        "You must view and accept the Terms & Conditions before submitting your order. Please click the 'View & Accept Terms & Conditions' button above.",
      );
      setShowWarningModal(true);
      setSubmitting(false);
      // Scroll to terms section
      setTimeout(() => {
        const termsSection = document.getElementById("terms-section");
        if (termsSection) {
          termsSection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    if (!agreedToTerms) {
      setWarningMessage(
        "Please check the agreement checkbox to confirm you have read and agree to the Terms & Conditions.",
      );
      setShowWarningModal(true);
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
        termsAccepted: termsAccepted ? {
          accepted: true,
          acceptedAt: new Date().toISOString(),
        } : undefined,
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
            </div>

            {/* Editable form - always visible */}
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

            </div>

            {/* Terms and Conditions */}
            <div id="terms-section" className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold text-white">Terms & Conditions</p>
              <button
                type="button"
                onClick={() => {
                  setShowTermsModal(true);
                  setHasScrolledToBottom(false); // Reset scroll state when opening modal
                }}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition ${
                  termsAccepted
                    ? "bg-accent/20 text-accent hover:bg-accent/30"
                    : "bg-accent text-black hover:bg-accent-soft"
                }`}
              >
                {termsAccepted ? "View Terms & Conditions" : "View & Accept Terms & Conditions *"}
              </button>
              {!termsAccepted && (
                <p className="text-xs text-amber-400">
                  * You must view and accept the Terms & Conditions to proceed with your order.
                </p>
              )}
              <p className="text-xs text-neutral-400">
                This purchase order is an expression of intent only and does not secure or
                reserve stock until required deposits and final payment have been received
                in full by Ormsby Guitars Pty Ltd.
              </p>
              <p className="text-xs text-neutral-500">
                A deposit of $200 per guitar is required and will be invoiced separately.
                Final pricing, shipping, taxes and timelines will be confirmed by Ormsby
                on your order confirmation.
              </p>
              <label className={`flex items-start gap-2 text-xs ${
                !termsAccepted ? "text-neutral-500" : "text-neutral-300"
              }`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  disabled={!termsAccepted}
                />
                <span>
                  I have read and agree to Ormsby Guitars' dealer/distributor purchase
                  order Terms &amp; Conditions, including the cancellation, payment and
                  quality control policies.
                  {termsAccepted && agreedToTerms && (
                    <span className="ml-1 text-green-400">✓ Accepted</span>
                  )}
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
                  
                  // Check terms acceptance first
                  if (!termsAccepted) {
                    setWarningMessage(
                      "You must view and accept the Terms & Conditions before submitting your order. Please click the 'View & Accept Terms & Conditions' button above.",
                    );
                    setShowWarningModal(true);
                    // Scroll to terms section
                    setTimeout(() => {
                      const termsSection = document.getElementById("terms-section");
                      if (termsSection) {
                        termsSection.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }, 100);
                    return;
                  }
                  
                  if (!agreedToTerms) {
                    setWarningMessage(
                      "Please check the agreement checkbox to confirm you have read and agree to the Terms & Conditions.",
                    );
                    setShowWarningModal(true);
                    return;
                  }
                  
                  const form = document.getElementById('checkout-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                disabled={submitting}
                className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-all ${
                  !termsAccepted || !agreedToTerms
                    ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                    : "bg-accent text-black hover:scale-[1.02] hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30"
                } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100`}
                title={
                  !termsAccepted
                    ? "You must view and accept the Terms & Conditions first"
                    : !agreedToTerms
                    ? "Please check the agreement checkbox"
                    : undefined
                }
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
              {error && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400" role="alert">
                    {error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="glass-strong relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl shadow-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">
                Terms & Conditions
              </h2>
              <button
                type="button"
                onClick={() => {
                  // Only allow closing if terms have been accepted
                  if (termsAccepted) {
                    setShowTermsModal(false);
                  }
                }}
                className={`rounded-lg p-2 transition ${
                  termsAccepted
                    ? "text-neutral-400 hover:bg-white/10 hover:text-white"
                    : "cursor-not-allowed text-neutral-600 opacity-50"
                }`}
                disabled={!termsAccepted}
                title={termsAccepted ? "Close" : "You must accept the terms to proceed"}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div
              ref={termsScrollRef}
              className="flex-1 overflow-y-auto px-6 py-4"
              onScroll={(e) => {
                const target = e.currentTarget;
                const isAtBottom =
                  target.scrollHeight - target.scrollTop <= target.clientHeight + 10; // 10px threshold
                setHasScrolledToBottom(isAtBottom);
              }}
            >
              {loadingTerms ? (
                <p className="text-sm text-neutral-400">Loading terms...</p>
              ) : termsTemplate ? (
                <div className="prose prose-invert max-w-none text-sm text-neutral-300">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {termsTemplate}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  Terms & Conditions are not currently available. Please contact support
                  for details.
                </p>
              )}
            </div>
            <div className="flex-shrink-0 border-t border-white/10 px-6 py-4">
              {!hasScrolledToBottom && (
                <p className="mb-3 text-center text-xs text-amber-400">
                  Please scroll to the bottom of the terms to continue
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (hasScrolledToBottom) {
                    setTermsAccepted(true);
                    setAgreedToTerms(true);
                    setShowTermsModal(false);
                    setHasScrolledToBottom(false); // Reset for next time
                  }
                }}
                disabled={!hasScrolledToBottom}
                className={`w-full rounded-xl px-4 py-2 text-sm font-medium transition ${
                  hasScrolledToBottom
                    ? "bg-accent text-black hover:bg-accent-soft cursor-pointer"
                    : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                }`}
              >
                Accept Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="glass-strong relative flex max-w-md flex-col overflow-hidden rounded-3xl shadow-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">
                Action Required
              </h2>
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-white/10 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <p className="flex-1 text-sm text-neutral-300">
                  {warningMessage}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowWarningModal(false);
                  // If warning is about terms, open terms modal
                  if (warningMessage.includes("View & Accept Terms & Conditions")) {
                    setShowTermsModal(true);
                  }
                }}
                className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-soft"
              >
                {warningMessage.includes("View & Accept Terms & Conditions")
                  ? "View Terms & Conditions"
                  : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

