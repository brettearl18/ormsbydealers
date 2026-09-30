import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { doc as firestoreDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getRRPForVariant } from "@/lib/pricing";
import type {
  AccountDoc,
  FxRatesDoc,
  GuitarDoc,
  OrderDoc,
  OrderLineDoc,
  PricesDoc,
  ShippingAddress,
} from "@/lib/types";
import { resolveLineOptionLabels } from "@/lib/order-line-options";

export type OrderPdfAccount = Pick<
  AccountDoc,
  | "name"
  | "tierId"
  | "currency"
  | "contactEmail"
  | "contactName"
  | "territory"
  | "discountPercent"
> & { id: string };

export interface GenerateOrderPdfParams {
  order: OrderDoc & { id: string };
  account: OrderPdfAccount | null;
  lines: Array<OrderLineDoc & { id: string }>;
  guitarsMap: Map<string, GuitarDoc>;
  /** "admin" shows full order id in header; dealer uses short ref only in title */
  variant?: "admin" | "dealer";
}

const AUD = "AUD";
const THUMB_COL = 0;
const IMG_CELL_MM = 18;

/** ASCII-only amounts for jsPDF Helvetica (avoids ≈, €, and other glyphs that render as garbage). */
function formatMoney(amount: number, currency: string): string {
  const code = (currency || AUD).toUpperCase();
  const n = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const [intPart, dec] = n.toFixed(2).split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const num = `${withCommas}.${dec}`;
  switch (code) {
    case "AUD":
      return `${sign}A$${num}`;
    case "USD":
      return `${sign}US$${num}`;
    case "EUR":
      return `${sign}EUR ${num}`;
    case "GBP":
      return `${sign}GBP ${num}`;
    case "CAD":
      return `${sign}CAD ${num}`;
    default:
      return `${sign}${code} ${num}`;
  }
}

function formatAddress(a: ShippingAddress): string[] {
  const lines: string[] = [];
  if (a.company) lines.push(a.company);
  lines.push(a.line1);
  if (a.line2) lines.push(a.line2);
  const cityLine = [a.city, a.region, a.postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (a.country) lines.push(a.country);
  return lines;
}

function lineDescription(
  line: OrderLineDoc,
  guitar: GuitarDoc | undefined,
): string {
  let text = `${line.sku}\n${line.name}`;
  if (line.selectedOptions && Object.keys(line.selectedOptions).length > 0) {
    const parts = Object.entries(line.selectedOptions).map(([oid, vid]) => {
      const { optionLabel, valueLabel } = resolveLineOptionLabels(
        guitar,
        oid,
        vid,
      );
      return `${optionLabel}: ${valueLabel}`;
    });
    text += "\n" + parts.join("\n");
  }
  return text;
}

function getLineImageUrl(
  line: OrderLineDoc,
  guitar: GuitarDoc | undefined,
): string | null {
  if (!guitar) return null;
  if (line.selectedOptions && guitar.options) {
    for (const option of guitar.options) {
      const selectedValueId = line.selectedOptions[option.optionId];
      if (selectedValueId) {
        const selectedValue = option.values.find(
          (v) => v.valueId === selectedValueId,
        );
        if (selectedValue?.images && selectedValue.images.length > 0) {
          return selectedValue.images[0];
        }
      }
    }
  }
  return guitar.images?.[0] ?? null;
}

/** Raster image as JPEG data URL for jsPDF (handles webp via canvas). */
function rasterizeToJpegDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const max = 240;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > max || h > max) {
          const scale = max / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return rasterizeToJpegDataUrl(url);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return rasterizeToJpegDataUrl(url);
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        resolve(typeof result === "string" ? result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return rasterizeToJpegDataUrl(url);
    if (dataUrl.includes("image/webp")) return rasterizeToJpegDataUrl(dataUrl);
    return dataUrl;
  } catch {
    return rasterizeToJpegDataUrl(url);
  }
}

async function fetchFxForPdf(): Promise<FxRatesDoc | null> {
  try {
    const res = await fetch("/api/fx/latest", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FxRatesDoc & { error?: string };
    if (data.error || !data.rates) return null;
    return { base: data.base || AUD, rates: data.rates, asOf: data.asOf };
  } catch {
    return null;
  }
}

async function fetchPricesForGuitars(
  guitarIds: string[],
): Promise<Map<string, PricesDoc | null>> {
  const map = new Map<string, PricesDoc | null>();
  await Promise.all(
    guitarIds.map(async (guitarId) => {
      try {
        const snap = await getDoc(firestoreDoc(db, "prices", guitarId));
        map.set(guitarId, snap.exists() ? (snap.data() as PricesDoc) : null);
      } catch {
        map.set(guitarId, null);
      }
    }),
  );
  return map;
}

function formatPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function imageFormatFromDataUrl(dataUrl: string): "JPEG" | "PNG" {
  if (dataUrl.includes("image/png")) return "PNG";
  return "JPEG";
}

/** AUD dealer price plus optional USD / EUR approx (matches Order Summary on screen). */
function dualPriceLine(audAmount: number, fx: FxRatesDoc | null): string {
  const parts = [formatMoney(audAmount, AUD)];
  const usdRate = fx?.rates.USD;
  const eurRate = fx?.rates.EUR;
  if (usdRate != null) {
    parts.push(`${formatMoney(audAmount * usdRate, "USD")} (approx)`);
  }
  if (eurRate != null) {
    parts.push(`${formatMoney(audAmount * eurRate, "EUR")} (approx)`);
  }
  return parts.join("\n");
}

function hasUsdEurApprox(fx: FxRatesDoc | null): boolean {
  return fx?.rates.USD != null || fx?.rates.EUR != null;
}

function formatFxAsOf(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { dateStyle: "long" });
  } catch {
    return iso;
  }
}

function safeFilePart(s: string, max = 48): string {
  return s
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, max);
}

function buildFxDisclaimer(
  territory: string | undefined,
  fx: FxRatesDoc | null,
): string {
  const territoryPart = territory?.trim()
    ? `Territory: ${territory.trim()}. `
    : "";
  const base = fx?.base || AUD;
  const usdRate = fx?.rates.USD;
  const eurRate = fx?.rates.EUR;

  if (!hasUsdEurApprox(fx)) {
    return (
      `${territoryPart}Dealer prices on this order are in Australian dollars (AUD). ` +
      `For queries contact Ormsby Guitars.`
    );
  }

  const asOf = fx?.asOf ? formatFxAsOf(fx.asOf) : "the rate date shown above";
  const rateParts: string[] = [];
  if (usdRate != null) rateParts.push(`1 ${base} = ${usdRate.toFixed(4)} USD`);
  if (eurRate != null) rateParts.push(`1 ${base} = ${eurRate.toFixed(4)} EUR`);

  return (
    `${territoryPart}Approximate USD and EUR amounts use exchange rates on ${asOf} ` +
    `(${rateParts.join("; ")}, indicative only). ` +
    `They are for US and EU territory reference and planning only; confirmed pricing and invoicing follow your Ormsby dealer terms in AUD unless otherwise agreed. ` +
    `Rates can change before payment.`
  );
}

function formatFxRatesHeader(fx: FxRatesDoc): string {
  const base = fx.base || AUD;
  const parts: string[] = [];
  if (fx.rates.USD != null) {
    parts.push(`1 ${base} = ${fx.rates.USD.toFixed(4)} USD`);
  }
  if (fx.rates.EUR != null) {
    parts.push(`1 ${base} = ${fx.rates.EUR.toFixed(4)} EUR`);
  }
  return parts.join(" · ");
}

/**
 * Builds a clean B2B order form PDF and triggers download in the browser.
 */
export async function downloadOrderPdf(
  params: GenerateOrderPdfParams,
): Promise<void> {
  const { order, account, lines, guitarsMap, variant = "admin" } = params;
  const displayCurrency = (
    account?.currency ||
    order.currency ||
    AUD
  ).toUpperCase();
  const territory = account?.territory?.trim();
  const shortRef = order.id.slice(0, 8).toUpperCase();

  const [fx, pricesMap, lineImages] = await Promise.all([
    fetchFxForPdf(),
    fetchPricesForGuitars([...new Set(lines.map((l) => l.guitarId))]),
    (async () => {
      const map = new Map<string, string | null>();
      await Promise.all(
        lines.map(async (line) => {
          const guitar = guitarsMap.get(line.guitarId);
          const url = getLineImageUrl(line, guitar);
          if (!url) {
            map.set(line.id, null);
            return;
          }
          map.set(line.id, await loadImageAsDataUrl(url));
        }),
      );
      return map;
    })(),
  ]);

  const usdRate = fx?.rates.USD ?? null;
  const eurRate = fx?.rates.EUR ?? null;
  const showUsdEurApprox = hasUsdEurApprox(fx);

  const accountDiscount = account?.discountPercent ?? 0;
  const lineRrps = lines.map((line) => {
    const guitar = guitarsMap.get(line.guitarId);
    const rrp = getRRPForVariant(
      pricesMap.get(line.guitarId) ?? null,
      guitar?.options ?? null,
      line.selectedOptions ?? null,
      accountDiscount,
    );
    return rrp != null && rrp > 0 ? rrp : null;
  });
  const allLinesHaveRrp = lines.length > 0 && lineRrps.every((r) => r != null);
  const rrpTotal = allLinesHaveRrp
    ? lines.reduce((sum, line, i) => sum + (lineRrps[i] as number) * line.qty, 0)
    : null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ORMSBY GUITARS", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Dealer order form", pageW - margin, 10, { align: "right" });
  doc.text("ormsbyguitars.com", pageW - margin, 16, { align: "right" });

  doc.setTextColor(30, 30, 30);
  y = 30;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ORDER SUMMARY", margin, y);
  y += 8;

  const colRightX = pageW / 2 + 6;
  const colLeftW = colRightX - margin - 4;
  const colRightW = pageW - margin - colRightX;

  const drawWrappedLines = (
    lines: string[],
    x: number,
    startY: number,
    maxWidth: number,
    lineGap = 4.5,
  ): number => {
    let cy = startY;
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, maxWidth);
      wrapped.forEach((segment: string) => {
        doc.text(segment, x, cy);
        cy += lineGap;
      });
    });
    return cy;
  };

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const meta: string[] = [
    `Order ref: ${shortRef}`,
    variant === "admin" ? `Full ID: ${order.id}` : "",
    `Status: ${order.status}`,
    `Date: ${
      order.createdAt
        ? new Date(order.createdAt).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "—"
    }`,
    territory ? `Territory: ${territory}` : "",
    `Display currency: ${displayCurrency}`,
    order.poNumber ? `PO number: ${order.poNumber}` : "",
    order.etaDate
      ? `ETA: ${new Date(order.etaDate).toLocaleDateString("en-AU")}`
      : "",
  ].filter(Boolean);

  const blockTopY = y;
  let yLeft = drawWrappedLines(meta, margin, blockTopY, colLeftW);

  if (fx && showUsdEurApprox) {
    yLeft += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    yLeft = drawWrappedLines(
      [
        `Indicative FX (${formatFxAsOf(fx.asOf)}): ${formatFxRatesHeader(fx)}`,
      ],
      margin,
      yLeft,
      colLeftW,
      3.8,
    );
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  }

  doc.setFont("helvetica", "bold");
  doc.text("Dealer / account", colRightX, blockTopY);
  doc.setFont("helvetica", "normal");
  const dealerLines = [
    account?.name || order.shippingAddress.company || "—",
    account ? `Account ID: ${account.id}` : "",
    account?.contactName ? `Contact: ${account.contactName}` : "",
    account?.contactEmail ? `Email: ${account.contactEmail}` : "",
    account?.tierId ? `Tier: ${account.tierId}` : "",
    accountDiscount > 0 ? `Dealer discount: ${formatPercent(accountDiscount)} off RRP` : "",
  ].filter(Boolean);
  const yRight = drawWrappedLines(
    dealerLines,
    colRightX,
    blockTopY + 5,
    colRightW,
  );

  y = Math.max(yLeft, yRight) + 6;

  doc.setFont("helvetica", "bold");
  doc.text("Ship to", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  formatAddress(order.shippingAddress).forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  y += 6;

  const unitHeader = showUsdEurApprox
    ? `Dealer unit (${AUD} / USD / EUR approx)`
    : `Dealer unit (${AUD})`;
  const totalHeader = showUsdEurApprox
    ? `Line total (${AUD} / USD / EUR approx)`
    : `Line total (${AUD})`;

  const body = lines.map((line, index) => {
    const guitar = guitarsMap.get(line.guitarId);
    const rrp = lineRrps[index];
    const discountPct =
      rrp != null ? Math.max(0, (1 - line.unitPrice / rrp) * 100) : null;
    return [
      "",
      String(index + 1),
      lineDescription(line, guitar),
      String(line.qty),
      rrp != null ? formatMoney(rrp, AUD) : "-",
      discountPct != null ? formatPercent(discountPct) : "-",
      dualPriceLine(line.unitPrice, fx),
      dualPriceLine(line.lineTotal, fx),
    ];
  });

  const rowHasImage = lines.map((line) => Boolean(lineImages.get(line.id)));

  autoTable(doc, {
    startY: y,
    head: [["", "#", "Description", "Qty", `RRP (${AUD})`, "Disc.", unitHeader, totalHeader]],
    body,
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [28, 28, 28],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      [THUMB_COL]: { cellWidth: IMG_CELL_MM },
      1: { cellWidth: 7, halign: "center" },
      2: { cellWidth: 44 },
      3: { cellWidth: 9, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 13, halign: "center" },
      6: { cellWidth: 34, halign: "right" },
      7: { cellWidth: 34, halign: "right" },
    },
    margin: { left: margin, right: margin },
    theme: "striped",
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rowIdx = data.row.index;
      if (data.column.index === THUMB_COL && rowHasImage[rowIdx]) {
        data.cell.styles.minCellHeight = IMG_CELL_MM;
      }
      if ((data.column.index === 6 || data.column.index === 7) && showUsdEurApprox) {
        const linesCount =
          1 + (usdRate != null ? 1 : 0) + (eurRate != null ? 1 : 0);
        data.cell.styles.minCellHeight = Math.max(
          data.cell.styles.minCellHeight ?? 0,
          linesCount * 4.5 + 4,
        );
        data.cell.styles.fontSize = 6.5;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== THUMB_COL) return;
      const line = lines[data.row.index];
      if (!line) return;
      const dataUrl = lineImages.get(line.id);
      if (!dataUrl) return;
      const pad = 1.5;
      const w = data.cell.width - pad * 2;
      const h = data.cell.height - pad * 2;
      try {
        doc.addImage(
          dataUrl,
          imageFormatFromDataUrl(dataUrl),
          data.cell.x + pad,
          data.cell.y + pad,
          w,
          h,
          undefined,
          "FAST",
        );
      } catch {
        /* skip broken image */
      }
    },
  });

  const pageH = doc.internal.pageSize.getHeight();
  const bottomSafe = 22;
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;
  let footY = finalY + 10;

  const ensureFootRoom = (neededMm: number) => {
    if (footY + neededMm > pageH - bottomSafe) {
      doc.addPage();
      footY = margin;
      doc.setTextColor(30, 30, 30);
    }
  };

  const subtotalLineMm = 6.5;
  const totalsLineCount =
    1 +
    (rrpTotal != null ? 2 : 0) +
    (usdRate != null ? 1 : 0) +
    (eurRate != null ? 1 : 0);
  const totalsBlockMm = 8 + totalsLineCount * subtotalLineMm;

  let footerTailMm = 12;
  if (order.notes?.trim()) {
    const noteLines = doc.splitTextToSize(
      order.notes.trim(),
      pageW - 2 * margin,
    );
    footerTailMm += 5 + noteLines.length * 4 + 6;
  }
  const disclaimer = buildFxDisclaimer(territory, fx);
  const discLines = doc.splitTextToSize(disclaimer, pageW - 2 * margin);
  footerTailMm += discLines.length * 3.5 + 8;

  ensureFootRoom(totalsBlockMm + footerTailMm);

  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.line(margin, footY - 3, pageW - margin, footY - 3);
  footY += 4;

  const subtotalAud = order.totals.subtotal;

  if (rrpTotal != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`RRP total (${AUD})`, pageW - margin - 58, footY);
    doc.text(formatMoney(rrpTotal, AUD), pageW - margin, footY, { align: "right" });
    footY += subtotalLineMm;

    const discountAmount = Math.max(0, rrpTotal - subtotalAud);
    const discountPctTotal = rrpTotal > 0 ? (discountAmount / rrpTotal) * 100 : 0;
    doc.text(
      `Less dealer discount (${formatPercent(discountPctTotal)})`,
      pageW - margin - 58,
      footY,
    );
    doc.text(`-${formatMoney(discountAmount, AUD)}`, pageW - margin, footY, {
      align: "right",
    });
    footY += subtotalLineMm;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`Subtotal (${AUD})`, pageW - margin - 58, footY);
  doc.text(formatMoney(subtotalAud, AUD), pageW - margin, footY, {
    align: "right",
  });
  footY += subtotalLineMm;

  if (usdRate != null) {
    ensureFootRoom(subtotalLineMm * 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Approx. subtotal (USD)", pageW - margin - 58, footY);
    doc.text(formatMoney(subtotalAud * usdRate, "USD"), pageW - margin, footY, {
      align: "right",
    });
    footY += subtotalLineMm;
  }
  if (eurRate != null) {
    ensureFootRoom(subtotalLineMm + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Approx. subtotal (EUR)", pageW - margin - 58, footY);
    doc.text(formatMoney(subtotalAud * eurRate, "EUR"), pageW - margin, footY, {
      align: "right",
    });
    footY += subtotalLineMm + 2;
  }

  if (order.notes?.trim()) {
    ensureFootRoom(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes", margin, footY);
    footY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(
      order.notes.trim(),
      pageW - 2 * margin,
    );
    noteLines.forEach((line: string) => {
      ensureFootRoom(5);
      doc.text(line, margin, footY);
      footY += 4;
    });
    footY += 6;
  }

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  discLines.forEach((line: string) => {
    ensureFootRoom(5);
    doc.text(line, margin, footY);
    footY += 3.5;
  });

  footY += 2;
  doc.text(
    `PDF generated ${new Date().toLocaleString("en-AU")}`,
    margin,
    footY,
  );

  const companyPart = safeFilePart(
    account?.name || order.shippingAddress.company || "order",
  );
  const filename = `Ormsby_Order_${shortRef}_${companyPart}.pdf`;
  doc.save(filename);
}
