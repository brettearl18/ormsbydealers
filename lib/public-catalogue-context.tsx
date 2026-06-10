"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  type CatalogueAudience,
  getCatalogueBasePath,
  getCatalogueDiscount,
  getCatalogueAudienceLabel,
} from "@/lib/public-catalogue";

interface CatalogueContextValue {
  audience: CatalogueAudience;
  discountPercent: number;
  basePath: string;
  audienceLabel: string;
}

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueAudienceProvider({
  audience,
  children,
}: {
  audience: CatalogueAudience;
  children: ReactNode;
}) {
  const value: CatalogueContextValue = {
    audience,
    discountPercent: getCatalogueDiscount(audience),
    basePath: getCatalogueBasePath(audience),
    audienceLabel: getCatalogueAudienceLabel(audience),
  };
  return (
    <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>
  );
}

export function useCatalogueAudience(): CatalogueContextValue {
  const ctx = useContext(CatalogueContext);
  if (!ctx) {
    throw new Error("useCatalogueAudience must be used within CatalogueAudienceProvider");
  }
  return ctx;
}
