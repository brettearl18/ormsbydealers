import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount(): Record<string, unknown> | null {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonEnv) {
    try {
      return JSON.parse(jsonEnv) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    join(
      process.cwd(),
      "..",
      "ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json",
    );

  if (!existsSync(credPath)) return null;
  return JSON.parse(readFileSync(credPath, "utf8")) as Record<string, unknown>;
}

let adminApp: App | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return adminApp;
  }

  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    adminApp = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    });
  } else {
    adminApp = initializeApp();
  }
  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
