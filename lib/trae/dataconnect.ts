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

/**
 * A known-bad FIREBASE_SERVICE_ACCOUNT_KEY has a corrupted PEM footer
 * ("-----END PRVATE Key-----" instead of "-----END PRIVATE KEY-----"), which makes
 * every Data Connect/Firebase Admin call fail with "Failed to parse private key" —
 * silently, since callers catch it and fall back to the local topics-cache.json
 * snapshot instead of surfacing the real error. Repair only that exact typo so a
 * malformed key can't be mistaken for a different, valid one.
 */
function repairPrivateKeyFooterTypo(privateKey: string): string {
  return privateKey.replace("-----END PRVATE Key-----", "-----END PRIVATE KEY-----");
}

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const account = JSON.parse(decoded) as ServiceAccountEnv;
    // Fix the snake_case field first (not just a derived camelCase copy): firebase-admin's
    // cert() accepts the raw downloaded service-account JSON shape and may read private_key
    // directly, so leaving it uncorrected while only patching `privateKey` silently no-ops.
    if (account.private_key) account.private_key = repairPrivateKeyFooterTypo(account.private_key);
    if (account.private_key && !account.privateKey) account.privateKey = account.private_key.replace(/\\n/g, "\n");
    if (account.privateKey) account.privateKey = repairPrivateKeyFooterTypo(account.privateKey.replace(/\\n/g, "\n"));
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
