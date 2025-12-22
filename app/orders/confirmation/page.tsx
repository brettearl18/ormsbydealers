"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc } from "@/lib/types";

export default function OrderConfirmationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId || !user) return;
      
      setLoadingOrder(true);
      try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as OrderDoc;
          // Only show order if it belongs to the user's account
          if (orderData.accountId === user.accountId) {
            setOrder(orderData);
          }
        }
      } catch (err) {
        console.error("Error fetching order:", err);
      } finally {
        setLoadingOrder(false);
      }
    }

    if (orderId && user?.accountId) {
      fetchOrder();
    }
  }, [orderId, user?.accountId]);

  if (authLoading || loadingOrder) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
          <svg
            className="h-10 w-10 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        
        <h1 className="mb-3 text-4xl font-semibold">Order Submitted Successfully!</h1>
        <p className="mb-6 text-base text-neutral-400">
          Your purchase order has been received. Ormsby will review and confirm your order shortly.
        </p>

        {orderId && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <p className="mb-2 text-sm font-semibold text-neutral-400">Order ID</p>
            <p className="text-lg font-mono text-white">{orderId}</p>
          </div>
        )}

        {/* Next Steps */}
        <div className="mb-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
          <h2 className="text-lg font-semibold text-white">What happens next?</h2>
          <div className="space-y-3 text-sm text-neutral-300">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <span className="text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-white">Order Review</p>
                <p className="text-neutral-400">Ormsby will review your purchase order and confirm availability.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <span className="text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-white">Invoice Sent</p>
                <p className="text-neutral-400">You'll receive a separate invoice from Ormsby Guitars with final pricing, shipping, and taxes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <span className="text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-white">Deposit Required</p>
                <p className="text-neutral-400">A deposit of $200 per guitar is required. Payment details will be included in your invoice.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/orders"
            className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
          >
            View All Orders
          </Link>
          <Link
            href="/dealer"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black shadow-lg transition-all hover:scale-105 hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

