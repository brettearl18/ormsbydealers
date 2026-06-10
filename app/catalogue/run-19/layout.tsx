"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PublicCatalogueOrderBar } from "@/components/catalogue/PublicCatalogueOrderBar";
import { CatalogueAudienceProvider } from "@/lib/public-catalogue-context";
import { catalogueAudienceFromPath } from "@/lib/public-catalogue";

export default function Run19CatalogueLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const audience = catalogueAudienceFromPath(pathname);

  return (
    <CatalogueAudienceProvider audience={audience}>
      {children}
      <PublicCatalogueOrderBar />
      <div className="h-20" aria-hidden />
    </CatalogueAudienceProvider>
  );
}
