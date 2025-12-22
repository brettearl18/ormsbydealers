"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { EffectivePriceResult } from "./pricing";

export interface CartItem {
  guitarId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  qty: number;
  unitPrice: number;
  priceSource: EffectivePriceResult["source"];
  selectedOptions?: Record<string, string>; // optionId -> valueId
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (guitarId: string, qty: number, selectedOptions?: Record<string, string>) => void;
  removeItem: (guitarId: string, selectedOptions?: Record<string, string>) => void;
  clear: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = "ormsby-dealer-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartItem[];
      setItems(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value: CartContextValue = useMemo(
    () => ({
      items,
      addItem: (item, qty = 1) => {
        setItems((prev) => {
          // Check if item with same guitarId and same options already exists
          const existing = prev.find((i) => {
            if (i.guitarId !== item.guitarId) return false;
            const itemOptions = JSON.stringify(item.selectedOptions || {});
            const existingOptions = JSON.stringify(i.selectedOptions || {});
            return itemOptions === existingOptions;
          });
          
          if (existing) {
            return prev.map((i) =>
              i.guitarId === item.guitarId &&
              JSON.stringify(i.selectedOptions || {}) ===
                JSON.stringify(item.selectedOptions || {})
                ? { ...i, qty: i.qty + qty }
                : i,
            );
          }
          return [...prev, { ...item, qty }];
        });
      },
      updateQty: (guitarId, qty, selectedOptions) => {
        setItems((prev) =>
          prev
            .map((i) => {
              const itemOptions = JSON.stringify(i.selectedOptions || {});
              const targetOptions = JSON.stringify(selectedOptions || {});
              return i.guitarId === guitarId && itemOptions === targetOptions
                ? { ...i, qty }
                : i;
            })
            .filter((i) => i.qty > 0),
        );
      },
      removeItem: (guitarId, selectedOptions) => {
        setItems((prev) =>
          prev.filter((i) => {
            const itemOptions = JSON.stringify(i.selectedOptions || {});
            const targetOptions = JSON.stringify(selectedOptions || {});
            return !(i.guitarId === guitarId && itemOptions === targetOptions);
          }),
        );
      },
      clear: () => setItems([]),
      subtotal: items.reduce(
        (sum, item) => sum + item.unitPrice * item.qty,
        0,
      ),
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}


