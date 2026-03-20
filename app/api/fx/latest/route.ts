import { NextResponse } from "next/server";

const FRANKFURTER =
  "https://api.frankfurter.dev/v1/latest?base=AUD&symbols=USD,EUR,GBP,CAD";

/**
 * Dealer-facing FX: live Frankfurter rates (AUD → USD, EUR, GBP, CAD).
 * Cached briefly on the server so we don’t hammer Frankfurter on every navigation.
 */
export async function GET() {
  try {
    const res = await fetch(FRANKFURTER, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream Frankfurter error", status: res.status },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };
    const now = new Date();
    let asOf: string;
    if (json.date) {
      const apiDate = new Date(`${json.date}T12:00:00.000Z`);
      asOf = apiDate > now ? now.toISOString() : apiDate.toISOString();
    } else {
      asOf = now.toISOString();
    }
    const body = {
      base: json.base,
      rates: json.rates,
      asOf,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 },
    );
  }
}
