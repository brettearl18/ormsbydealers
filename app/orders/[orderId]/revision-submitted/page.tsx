"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveAccountId } from "@/lib/dealer-view-context";
import { OrderDoc } from "@/lib/types";

export default function OrderRevisionSubmittedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const effectiveAccountId = useEffectiveAccountId();
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!effectiveAccountId || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "orders", orderId));
        if (cancelled) return;
        if (!snap.exists()) {
          router.replace("/orders");
          return;
        }
        const data = snap.data() as OrderDoc;
        if (data.accountId !== effectiveAccountId) {
          router.replace("/orders");
          return;
        }
        setVerified(true);
      } catch {
        if (!cancelled) router.replace("/orders");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, effectiveAccountId, router]);

  if (authLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (!effectiveAccountId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-neutral-400">No account selected.</p>
        <Link href="/dashboard" className="text-sm text-accent hover:underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!verified) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20">
          <svg
            className="h-10 w-10 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-white">
          Updates sent to Ormsby
        </h1>
        <p className="mb-2 text-sm text-neutral-400">
          Your revised order is saved. It will show as{" "}
          <span className="font-medium text-amber-200/90">Pending approval</span> until Ormsby
          reviews your new line items.
        </p>
        <p className="mb-8 text-xs text-neutral-500">
          Order #{orderId.slice(0, 8).toUpperCase()}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex justify-center rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/15"
          >
            View order
          </Link>
          <Link
            href="/orders"
            className="inline-flex justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft"
          >
            All orders
          </Link>
        </div>
      </div>
    </main>
  );
}
