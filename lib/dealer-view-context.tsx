"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "ormsby_admin_dealer_view";

export type DealerViewState = {
  accountId: string;
  accountName: string;
};

type DealerViewContextValue = {
  dealerView: DealerViewState | null;
  /** Admin-only: start preview for an account (persisted in sessionStorage). */
  setDealerView: (v: DealerViewState | null) => void;
  exitDealerView: () => void;
  /** Logged-in admin viewing a dealer account (read-only intent). */
  isAdminDealerPreview: boolean;
};

const DealerViewContext = createContext<DealerViewContextValue | null>(null);

function readStoredDealerView(): DealerViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accountId?: string; accountName?: string };
    if (!parsed?.accountId) return null;
    return {
      accountId: parsed.accountId,
      accountName: (parsed.accountName || "").trim() || parsed.accountId,
    };
  } catch {
    return null;
  }
}

export function DealerViewProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [dealerView, setDealerViewState] = useState<DealerViewState | null>(null);

  // Restore from session when user becomes admin
  useEffect(() => {
    if (loading) return;
    if (user?.role !== "ADMIN") {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      setDealerViewState(null);
      return;
    }
    setDealerViewState(readStoredDealerView());
  }, [user?.role, loading]);

  const setDealerView = useCallback((v: DealerViewState | null) => {
    if (typeof window !== "undefined") {
      if (v) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setDealerViewState(v);
  }, []);

  const exitDealerView = useCallback(() => {
    setDealerView(null);
  }, [setDealerView]);

  const isAdminDealerPreview = user?.role === "ADMIN" && !!dealerView;

  const value = useMemo(
    () => ({
      dealerView,
      setDealerView,
      exitDealerView,
      isAdminDealerPreview,
    }),
    [dealerView, setDealerView, exitDealerView, isAdminDealerPreview],
  );

  return (
    <DealerViewContext.Provider value={value}>{children}</DealerViewContext.Provider>
  );
}

export function useDealerView() {
  const ctx = useContext(DealerViewContext);
  if (!ctx) {
    throw new Error("useDealerView must be used within DealerViewProvider");
  }
  return ctx;
}

/** Account to use for dealer-scoped Firestore queries (admin preview or real dealer). */
export function useEffectiveAccountId(): string | null {
  const { user } = useAuth();
  const { dealerView, isAdminDealerPreview } = useDealerView();
  if (isAdminDealerPreview && dealerView?.accountId) return dealerView.accountId;
  return user?.accountId ?? null;
}
