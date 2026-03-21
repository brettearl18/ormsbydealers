#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const PROJECT_ROOT = process.cwd();
const TEMPLATE_PATH =
  process.env.DEALER_TEMPLATE_PATH ||
  path.join(PROJECT_ROOT, "dealer-logins-template.json");
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(PROJECT_ROOT, "..", "ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json");
const TEMP_PASSWORD = process.env.DEALER_TEMP_PASSWORD || "OrmsbyDealer2026!@#";
const APPLY = process.argv.includes("--apply");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertValidDealer(dealer, index) {
  const row = index + 1;
  const email = normalizeEmail(dealer?.login?.email);
  if (!dealer?.accountId) throw new Error(`dealers[${row}] missing accountId`);
  if (!dealer?.tierId) throw new Error(`dealers[${row}] missing tierId`);
  if (!dealer?.currency) throw new Error(`dealers[${row}] missing currency`);
  if (!email) throw new Error(`dealers[${row}] missing login.email`);
}

async function ensureUser(auth, dealer) {
  const email = normalizeEmail(dealer.login.email);
  const displayName = dealer.dealerName || dealer.accountId;
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, {
      email,
      displayName,
      password: TEMP_PASSWORD,
      disabled: dealer.login.enabled === false,
    });
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err;
    user = await auth.createUser({
      email,
      displayName,
      password: TEMP_PASSWORD,
      disabled: dealer.login.enabled === false,
      emailVerified: false,
    });
  }
  return user;
}

async function run() {
  const template = readJson(TEMPLATE_PATH);
  const dealers = template?.dealers || [];
  if (!Array.isArray(dealers) || dealers.length === 0) {
    throw new Error("Template has no dealers.");
  }

  dealers.forEach(assertValidDealer);

  const serviceAccount = readJson(SERVICE_ACCOUNT_PATH);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  const auth = admin.auth();
  const db = admin.firestore();

  console.log(`\nDealer records: ${dealers.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Template: ${TEMPLATE_PATH}`);
  console.log(`Temp password: ${"*".repeat(Math.min(TEMP_PASSWORD.length, 12))}\n`);

  for (const dealer of dealers) {
    const email = normalizeEmail(dealer.login.email);
    const accountId = dealer.accountId;
    const tierId = dealer.tierId;
    const currency = dealer.currency || "AUD";
    const role = "DEALER";

    if (!APPLY) {
      console.log(`[DRY] ${email} -> ${accountId} (${tierId}, ${currency})`);
      continue;
    }

    const user = await ensureUser(auth, dealer);
    await auth.setCustomUserClaims(user.uid, {
      role,
      accountId,
      tierId,
      currency,
      mustChangePassword: true,
    });

    await db.collection("users").doc(user.uid).set(
      {
        role,
        accountId,
        email,
        name: dealer.dealerName || accountId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    console.log(`[OK] ${email} -> uid=${user.uid}`);
  }

  console.log(
    APPLY
      ? "\nCompleted. Users can sign in with temporary password and are forced to change it."
      : "\nDry run complete. Re-run with --apply to execute.",
  );
}

run().catch((err) => {
  console.error("\nProvisioning failed:", err?.message || err);
  process.exit(1);
});

