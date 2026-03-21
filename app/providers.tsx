"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { DealerViewProvider } from "@/lib/dealer-view-context";
import { CartProvider } from "@/lib/cart-context";
import { PasswordResetGate } from "@/components/PasswordResetGate";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DealerViewProvider>
        <CartProvider>
          <PasswordResetGate>{children}</PasswordResetGate>
        </CartProvider>
      </DealerViewProvider>
    </AuthProvider>
  );
}



