import { NextResponse } from "next/server";
import { callCloudFunction } from "@/lib/public-catalogue-server";
import type { PublicCatalogueContact } from "@/lib/public-catalogue";

interface SubmitBody {
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  territory?: string;
  poNumber?: string;
  notes?: string;
  shippingAddress?: PublicCatalogueContact["shippingAddress"];
  lines: Array<{
    guitarId: string;
    qty: number;
    selectedOptions: Record<string, string>;
  }>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitBody;
    const result = await callCloudFunction<SubmitBody, { success: boolean }>(
      "submitPublicCatalogueOrder",
      body,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/catalogue/run-19/submit:", err);
    const message =
      err instanceof Error ? err.message : "Failed to submit order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
