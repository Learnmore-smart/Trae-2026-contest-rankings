import { setTimeout as sleep } from "node:timers/promises";
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

export function isMissingDataConnectOperationError(error: unknown, operationName: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("operation") &&
    normalized.includes("not found") &&
    message.includes(`"${operationName}"`)
  );
}

/**
 * 判定错误是否为 Data Connect / Cloud SQL 的瞬时错误(超时、连接重置、临时不可用、死锁等)。
 * 复用 isMissingDataConnectOperationError 的消息归一化写法,通过关键词匹配识别可重试错误。
 */
export function isTransientDataConnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const transientKeywords = [
    "sql execution timed out",
    "timeout",
    "timed out",
    "econnreset",
    "econnrefused",
    "epipe",
    "connection",
    "503",
    "unavailable",
    "deadlock",
    "restart"
  ];
  return transientKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * 为 Data Connect / Cloud SQL 调用包装瞬时错误重试。
 * 默认最多重试 3 次,指数退避(500 / 1000 / 2000ms)。
 * 非瞬时错误立即抛出,重试耗尽后抛出最后一个原始错误对象(不包装)。
 */
export async function withSqlRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // 重试耗尽或非瞬时错误:立即抛出原始错误
      if (attempt === maxRetries || !isTransientDataConnectError(error)) {
        throw error;
      }
      const retryNumber = attempt + 1;
      const delayMs = baseDelayMs * 2 ** attempt;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        `[withSqlRetry] 瞬时错误,将进行第 ${retryNumber}/${maxRetries} 次重试(等待 ${delayMs}ms):${errorMessage}`
      );
      await sleep(delayMs);
    }
  }
  // 理论上不可达,保险起见抛出最后一个错误对象
  throw lastError;
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
