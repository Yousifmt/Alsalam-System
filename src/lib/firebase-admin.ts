// src/lib/firebase-admin.ts
import "server-only";
import {
  getApps,
  initializeApp,
  cert,
  getApp,
  App,
  applicationDefault,
} from "firebase-admin/app";
import { getAuth as _getAuth } from "firebase-admin/auth";
import { getFirestore as _getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function readCredsObject() {
  // 1) Full JSON in env (plain or base64)
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    || (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64
        ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, "base64").toString("utf8")
        : "");

  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // 2) Split env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Support both raw multiline and \n-escaped or base64
  let privateKey =
    process.env.FIREBASE_PRIVATE_KEY?.includes("\\n")
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_B64) {
    privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, "base64")
      .toString("utf8");
  }

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  // 3) No explicit creds → let Google ADC handle it (if GOOGLE_APPLICATION_CREDENTIALS is set)
  return null;
}

export function getAdminApp() {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApp();
    return cachedApp;
  }

  const creds = readCredsObject();

  if (creds) {
    cachedApp = initializeApp({ credential: cert(creds as any) });
    return cachedApp;
  }

  // Try Application Default Credentials (works on GCP / if GOOGLE_APPLICATION_CREDENTIALS is set)
  try {
    cachedApp = initializeApp({ credential: applicationDefault() });
    return cachedApp;
  } catch {
    throw new Error("Firebase Admin credentials are missing.");
  }
}

export function getAdminAuth() {
  return _getAuth(getAdminApp());
}
export function getAdminDb() {
  return _getFirestore(getAdminApp());
}

/** Singletons + legacy aliases */
export const adminApp = getAdminApp();
export const adminAuth = _getAuth(adminApp);
export const adminDb = _getFirestore(adminApp);

// legacy aliases some pages import
export const auth = adminAuth;
export const db = adminDb;
