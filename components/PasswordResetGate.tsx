"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";

const ALLOWED_WHEN_PENDING = new Set(["/update-password"]);

export function PasswordResetGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.mustChangePassword && !ALLOWED_WHEN_PENDING.has(pathname)) {
      router.replace("/update-password");
      return;
    }
    if (!user.mustChangePassword && pathname === "/update-password") {
      router.replace(user.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }, [loading, user, pathname, router]);

  if (loading) return <>{children}</>;
  if (!user) return <>{children}</>;
  if (user.mustChangePassword && !ALLOWED_WHEN_PENDING.has(pathname)) {
    return null;
  }
  return <>{children}</>;
}

