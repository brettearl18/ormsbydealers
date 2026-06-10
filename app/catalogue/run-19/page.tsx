import type { Metadata } from "next";
import { PublicRun19CatalogueView } from "@/components/catalogue/PublicRun19CatalogueView";

export const metadata: Metadata = {
  title: "Run 19 Dealer Catalogue (40% off) | Ormsby Guitars",
  description:
    "Public Run 19 dealer catalogue — 40% off RRP. Quick order and submit by email.",
};

export default function PublicRun19DealerCataloguePage() {
  return <PublicRun19CatalogueView />;
}
