import { NextResponse } from "next/server";
import { loadPublicCatalogueRun19 } from "@/lib/public-catalogue-server";
import {
  PUBLIC_CATALOGUE_DISCOUNT,
  PUBLIC_CATALOGUE_RUN,
} from "@/lib/public-catalogue";

export async function GET() {
  try {
    const guitars = await loadPublicCatalogueRun19();
    return NextResponse.json(
      {
        run: PUBLIC_CATALOGUE_RUN,
        discountPercent: PUBLIC_CATALOGUE_DISCOUNT,
        currency: "AUD",
        guitars,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/catalogue/run-19:", err);
    return NextResponse.json(
      { error: "Failed to load catalogue." },
      { status: 500 },
    );
  }
}
