// src/lib/firebaseAdmin.ts
import "server-only";
import { getApps, initializeApp, cert, getApp, App } from "firebase-admin/app";
import { getAuth as _getAuth } from "firebase-admin/auth";
import { getFirestore as _getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function readCreds() {
  // Prefer a single JSON secret if you have it
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
  // Fallback to discrete vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function getAdminApp() {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApp();
    return cachedApp;
  }
  const creds = readCreds();
  if (!creds) {
    // Defer failure until actually used
    throw new Error("Firebase Admin credentials are missing.");
  }
  cachedApp = initializeApp({ credential: cert(creds as any) });
  return cachedApp;
}

export function getAdminAuth() {
  return _getAuth(getAdminApp());
}

export function getAdminDb() {
  return _getFirestore(getAdminApp());
}
