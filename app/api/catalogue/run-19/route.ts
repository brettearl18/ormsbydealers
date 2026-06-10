import { NextResponse } from "next/server";
import { loadPublicCatalogueRun19 } from "@/lib/public-catalogue-server";
import {
  getCatalogueDiscount,
  parseCatalogueAudience,
  PUBLIC_CATALOGUE_RUN,
} from "@/lib/public-catalogue";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const audience = parseCatalogueAudience(searchParams.get("audience"));
    const discountPercent = getCatalogueDiscount(audience);
    const guitars = await loadPublicCatalogueRun19(discountPercent);
    return NextResponse.json(
      {
        run: PUBLIC_CATALOGUE_RUN,
        audience,
        discountPercent,
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
