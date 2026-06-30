import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import { connectorConfig } from "@trae-contest/dataconnect-generated";

export class DataConnectUnavailableError extends Error {
  constructor(message = "Firebase Data Connect is not configured.") {
    super(message);
    this.name = "DataConnectUnavailableError";
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

type ServiceAccountEnv = ServiceAccount & {
  private_key?: string;
  privateKey?: string;
};

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(decoded) as ServiceAccountEnv;
    if (account.private_key && !account.privateKey) account.privateKey = account.private_key.replace(/\\n/g, "\n");
    if (account.privateKey) account.privateKey = account.privateKey.replace(/\\n/g, "\n");
    return account;
  } catch {
    throw new DataConnectUnavailableError("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or base64 JSON.");
  }
}

export function isDataConnectConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_CONFIG ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID
  );
}

function ensureFirebaseApp(): void {
  if (!isDataConnectConfigured()) {
    throw new DataConnectUnavailableError(
      "Firebase Data Connect credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or run on Google Cloud with application default credentials."
    );
  }

  if (getApps().length) return;

  const serviceAccount = serviceAccountFromEnv();
  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount)
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  });
}

let dataConnectInstance: DataConnect | null = null;

export function getDataConnectDb(): DataConnect {
  ensureFirebaseApp();
  if (!dataConnectInstance) {
    dataConnectInstance = getDataConnect(connectorConfig);
  }
  return dataConnectInstance;
}
