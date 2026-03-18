/**
 * Reads dealer-order-template.json (runs/dealers/lineItems) and outputs
 * purchase-orders-by-company.json: one PO per dealer per run in portal order format.
 *
 * Usage: node scripts/buildPurchaseOrdersFromOrdersJson.mjs
 * Input: dealer-order-template.json (with runs[].dealers[].lineItems)
 * Output: purchase-orders-by-company.json
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = join(__dirname, "../dealer-order-template.json");
const outputPath = join(__dirname, "../purchase-orders-by-company.json");

// Run + model -> { guitarId, baseSku, name }
const MODEL_MAP = {
  "Run 19": {
    Genesis: { guitarId: "r19-genesis", baseSku: "R19-GENESIS", name: "Genesis (Run 19)" },
    SX: { guitarId: "r19-sx", baseSku: "R19-SX", name: "SX (Run 19)" },
    DC: { guitarId: "r19-dc", baseSku: "R19-DC", name: "DC (Run 19)" },
  },
  "Run 20": {},
  "Run 21": {
    ONE: { guitarId: "r21-the-one", baseSku: "R21-THE-ONE", name: "The One (Run 21)" },
    "SC Goliath": { guitarId: "r21-sc-goliath", baseSku: "R21-SC-GOLIATH", name: "Single Cut Goliath (Run 21)" },
    "Metal V": { guitarId: "r21-metal-v", baseSku: "R21-METAL-V", name: "Metal V (Run 21)" },
  },
  "TX Shark": {
    "TX Shark": { guitarId: "tx-shark", baseSku: "TX-SHARK", name: "TX Shark" },
  },
};

// Colour label (normalized) -> valueId for each run (some colours only exist on certain models)
const COLOUR_TO_VALUE_ID = {
  black: "black",
  cream: "cream",
  opaline: "opaline",
  seafoam: "seafoam",
  natural: "natural-flame",
  "natural flame": "natural-flame",
  raspberry: "raspberry",
  splice: "splice",
  "maya blue": "maya-blue",
  "dahlia black": "dahlia-black",
  "desert camo": "desert-camo",
  "blood camo": "blood-camo",
  "max black": "max-black",
  acid: "acid",
  magenta: "magenta",
  hazard: "hazard",
  "violent crumble": "violent-crumble",
  "deep sea": "deep-sea",
  hydra: "hydra",
  amber: "amber",
  viper: "viper",
  "white/black": "white-black",
  "black satin": "black-satin",
  "violet mist": "violet-mist",
  "violet myst": "violet-mist",
  "black limba": "black-limba",
  "poison berry": "poison-berry",
  "candy floss": "candy-floss",
  "riff tide": "riff-tide",
};

function normalizeColour(s) {
  if (!s || typeof s !== "string") return "";
  const key = s.trim().toLowerCase().replace(/\s+/g, " ");
  return COLOUR_TO_VALUE_ID[key] || key.replace(/\s+/g, "-").toLowerCase();
}

function stringsToValueId(n) {
  const s = String(n).trim();
  if (s === "6" || s === "7" || s === "8") return s;
  return "7";
}

function buildSku(baseSku, colourValueId, stringsValueId) {
  const parts = [baseSku];
  if (colourValueId) parts.push(colourValueId.toUpperCase().replace(/-/g, ""));
  if (stringsValueId) parts.push(stringsValueId);
  return parts.join("-");
}

function lineItemToCartItem(run, item) {
  const runMap = MODEL_MAP[run];
  if (!runMap) return null;
  const modelStr = String(item.model || "").trim();
  const guitar = runMap[modelStr] || Object.entries(runMap).find(([k]) => modelStr.toLowerCase() === k.toLowerCase())?.[1];
  if (!guitar) return null;

  const colourValueId = normalizeColour(item.colour);
  const stringsValueId = stringsToValueId(item.strings);
  const sku = buildSku(guitar.baseSku, colourValueId, stringsValueId);
  const name = `${guitar.name} – ${item.colour} – ${item.strings}-String`;

  return {
    guitarId: guitar.guitarId,
    sku,
    name,
    qty: Math.max(1, Number(item.qty) || 1),
    unitPrice: 0,
    selectedOptions: { colour: colourValueId, strings: stringsValueId },
  };
}

function main() {
  const raw = readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  const runs = data.runs || [];
  const purchaseOrders = [];

  for (const runBlock of runs) {
    const run = runBlock.run;
    const dealers = runBlock.dealers || [];
    if (runBlock.dataStatus === "totals_only" && !dealers.some((d) => (d.lineItems || []).length > 0)) {
      for (const d of dealers) {
        purchaseOrders.push({
          dealer: d.dealer,
          run,
          dataStatus: "totals_only",
          totalUnits: d.totalUnits || 0,
          poNumber: "",
          notes: "",
          shippingAddress: { company: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "" },
          cartItems: [],
          termsAccepted: { accepted: false, acceptedAt: "" },
        });
      }
      continue;
    }

    for (const d of dealers) {
      const lineItems = d.lineItems || [];
      const cartItems = [];
      for (const item of lineItems) {
        const cartItem = lineItemToCartItem(run, item);
        if (cartItem) cartItems.push(cartItem);
      }

      purchaseOrders.push({
        dealer: d.dealer,
        run,
        dataStatus: runBlock.dataStatus || "complete",
        totalUnits: d.totalUnits ?? cartItems.reduce((sum, c) => sum + c.qty, 0),
        poNumber: "",
        notes: "",
        shippingAddress: { company: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "" },
        cartItems,
        termsAccepted: { accepted: false, acceptedAt: "" },
      });
    }
  }

  const out = {
    _comment: "One purchase order per company per run. Fill shippingAddress, poNumber, notes; set unitPrice per line or in admin.",
    generatedAt: new Date().toISOString().slice(0, 10),
    purchaseOrders,
  };
  writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", purchaseOrders.length, "purchase orders to", outputPath);
}

main();
