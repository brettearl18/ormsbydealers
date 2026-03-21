"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Give Firebase time to restore session from persistence before treating null as signed out
const AUTH_RESTORE_DELAY_MS = 800;

async function sessionUserFromFirebaseUser(firebaseUser: AppUser): Promise<SessionUser> {
  const token = await firebaseUser.getIdTokenResult();
  const role = (token.claims.role as Role) ?? null;
  const accountId = (token.claims.accountId as string | undefined) ?? null;
  const tierId = (token.claims.tierId as string | undefined) ?? null;
  const currency = (token.claims.currency as string | undefined) ?? null;
  const mustChangePassword = Boolean(token.claims.mustChangePassword);
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role,
    accountId: accountId ?? null,
    tierId: tierId ?? null,
    currency: currency ?? null,
    mustChangePassword,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const nullTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: AppUser | null) => {
      if (nullTimeoutRef.current) {
        clearTimeout(nullTimeoutRef.current);
        nullTimeoutRef.current = null;
      }

      if (!firebaseUser) {
        setUser(null);
        nullTimeoutRef.current = setTimeout(async () => {
          nullTimeoutRef.current = null;
          // Re-check in case persistence restored the session after the first null
          const current = auth.currentUser;
          if (current) {
            const session = await sessionUserFromFirebaseUser(current);
            setUser(session);
          }
          setLoading(false);
        }, AUTH_RESTORE_DELAY_MS);
        return;
      }

      const session = await sessionUserFromFirebaseUser(firebaseUser);
      setUser(session);
      setLoading(false);
    });

    return () => {
      unsub();
      if (nullTimeoutRef.current) {
        clearTimeout(nullTimeoutRef.current);
      }
    };
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

