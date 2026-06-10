import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Run 19 Distributor Catalogue (50% off) | Ormsby Guitars",
  description:
    "Public Run 19 distributor catalogue — 50% off RRP. Quick order and submit by email.",
};

export default function Run19DistributorMetaLayout({ children }: { children: ReactNode }) {
  return children;
}
