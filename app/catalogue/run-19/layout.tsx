import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicCatalogueOrderBar } from "@/components/catalogue/PublicCatalogueOrderBar";

export const metadata: Metadata = {
  title: "Run 19 Dealer Catalogue | Ormsby Guitars",
  description:
    "Public Run 19 dealer catalogue — configure guitars and submit your order by email at 40% off RRP.",
};

export default function Run19CatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PublicCatalogueOrderBar />
      <div className="h-20" aria-hidden />
    </>
  );
}
