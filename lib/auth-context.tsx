"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { auth, type AppUser } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Role = "ADMIN" | "DISTRIBUTOR" | "DEALER" | null;

export interface SessionUser {
  uid: string;
  email: string | null;
  role: Role;
  accountId: string | null;
  tierId: string | null;
  currency: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: AppUser | null) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // For now, derive role/accountId from custom claims if present.
      // Later we can hydrate from Firestore `users/{uid}`.
      const token = await firebaseUser.getIdTokenResult();
      const role = (token.claims.role as Role) ?? null;
      const accountId = (token.claims.accountId as string | undefined) ?? null;
      const tierId = (token.claims.tierId as string | undefined) ?? null;
      const currency = (token.claims.currency as string | undefined) ?? null;

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role,
        accountId: accountId ?? null,
        tierId: tierId ?? null,
        currency: currency ?? null,
      });
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

