import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const TRAE_COLLECTIONS = {
  topics: "trae_topics",
  matches: "trae_matches",
  evaluations: "trae_evaluations",
  runs: "trae_runs",
  presence: "trae_presence"
};

export class FirestoreUnavailableError extends Error {
  constructor(message = "Firestore is not configured.") {
    super(message);
    this.name = "FirestoreUnavailableError";
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

function serviceAccountFromEnv(): object | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(decoded) as { private_key?: string };
    if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
    return account;
  } catch {
    throw new FirestoreUnavailableError("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or base64 JSON.");
  }
}

export function isFirestoreConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_CONFIG ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID
  );
}

export function getFirestoreDb(): Firestore {
  if (!isFirestoreConfigured()) {
    throw new FirestoreUnavailableError(
      "Firestore credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or run on Google Cloud with application default credentials."
    );
  }

  if (!getApps().length) {
    const serviceAccount = serviceAccountFromEnv();
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
      });
    }
  }

  return getFirestore();
}
