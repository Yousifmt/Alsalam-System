
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount: any;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // Fallback for environments where the full key isn't set as a single JSON string
    serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The `replace` is crucial for keys stored in some environments
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    };
  }
} catch (error) {
  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);
  serviceAccount = {}; // Ensure serviceAccount is an object to avoid further errors
}


// A check to ensure that the necessary properties exist before trying to initialize
const hasCredentials = serviceAccount.privateKey && serviceAccount.clientEmail && serviceAccount.projectId;

let app: App;

if (getApps().length > 0) {
    app = getApps()[0];
} else if (hasCredentials) {
    app = initializeApp({
        credential: cert(serviceAccount),
    });
} else {
    // If no credentials, we can't initialize the admin app.
    // We create a dummy object for auth and db to avoid crashes on import,
    // but server-side operations will fail.
    console.warn("Firebase Admin SDK not initialized. Missing credentials.");
    app = {} as App; // This is not a real app, just a placeholder
}

// Ensure auth and db can be imported without crashing the app, even if not initialized.
export const auth = hasCredentials ? getAuth(app) : ({} as any);
export const db = hasCredentials ? getFirestore(app) : ({} as any);
