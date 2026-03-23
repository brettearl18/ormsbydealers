import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  AccountDoc,
  GuitarDoc,
  OrderDoc,
  OrderLineDoc,
  ShippingAddress,
} from "@/lib/types";
import { resolveLineOptionLabels } from "@/lib/order-line-options";

export type OrderPdfAccount = Pick<
  AccountDoc,
  "name" | "tierId" | "currency" | "contactEmail" | "contactName"
> & { id: string };

export interface GenerateOrderPdfParams {
  order: OrderDoc & { id: string };
  account: OrderPdfAccount | null;
  lines: Array<OrderLineDoc & { id: string }>;
  guitarsMap: Map<string, GuitarDoc>;
  /** "admin" shows full order id in header; dealer uses short ref only in title */
  variant?: "admin" | "dealer";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "AUD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
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
  let text = line.name;
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

function safeFilePart(s: string, max = 48): string {
  return s
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, max);
}

/**
 * Builds a clean B2B order form PDF and triggers download in the browser.
 */
export function downloadOrderPdf(params: GenerateOrderPdfParams): void {
  const { order, account, lines, guitarsMap, variant = "admin" } = params;
  const currency = order.currency || "AUD";
  const shortRef = order.id.slice(0, 8).toUpperCase();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
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
    order.poNumber ? `PO number: ${order.poNumber}` : "",
    order.etaDate ? `ETA: ${new Date(order.etaDate).toLocaleDateString("en-AU")}` : "",
  ].filter(Boolean);

  meta.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Dealer / account", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const dealerLines = [
    account?.name || order.shippingAddress.company || "—",
    account ? `Account ID: ${account.id}` : "",
    account?.contactName ? `Contact: ${account.contactName}` : "",
    account?.contactEmail ? `Email: ${account.contactEmail}` : "",
    account?.tierId ? `Tier: ${account.tierId}` : "",
  ].filter(Boolean);
  dealerLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Ship to", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  formatAddress(order.shippingAddress).forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  y += 6;

  const body = lines.map((line, index) => {
    const guitar = guitarsMap.get(line.guitarId);
    return [
      String(index + 1),
      line.sku,
      lineDescription(line, guitar),
      String(line.qty),
      formatMoney(line.unitPrice, currency),
      formatMoney(line.lineTotal, currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "SKU", "Description", "Qty", "Unit", "Line total"]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [28, 28, 28],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 28 },
      2: { cellWidth: 72 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
    margin: { left: margin, right: margin },
    theme: "striped",
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;
  let footY = finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Subtotal (${currency})`,
    pageW - margin - 50,
    footY,
  );
  doc.text(
    formatMoney(order.totals.subtotal, currency),
    pageW - margin,
    footY,
    { align: "right" },
  );
  footY += 10;

  if (order.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes", margin, footY);
    footY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(order.notes.trim(), pageW - 2 * margin);
    noteLines.forEach((line: string) => {
      if (footY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        footY = margin;
      }
      doc.text(line, margin, footY);
      footY += 4;
    });
    footY += 6;
  }

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const disclaimer =
    `Amounts are as recorded on this order in ${currency}. ` +
    `For queries contact Ormsby Guitars.`;
  const discLines = doc.splitTextToSize(disclaimer, pageW - 2 * margin);
  discLines.forEach((line: string) => {
    if (footY > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      footY = margin;
    }
    doc.text(line, margin, footY);
    footY += 3.5;
  });

  footY += 2;
  doc.text(
    `PDF generated ${new Date().toLocaleString("en-AU")}`,
    margin,
    footY,
  );

  const companyPart = safeFilePart(account?.name || order.shippingAddress.company || "order");
  const filename = `Ormsby_Order_${shortRef}_${companyPart}.pdf`;
  doc.save(filename);
}
