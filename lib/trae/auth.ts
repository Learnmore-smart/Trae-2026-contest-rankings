import { timingSafeEqual } from "node:crypto";
import { getTraeConfig } from "./config.ts";

export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return headers.get("x-trae-admin-token") ?? headers.get("x-trae-cron-secret");
}

function constantEqual(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidAdminToken(token: string | null): boolean {
  return constantEqual(token, getTraeConfig().adminToken);
}

export function isValidCronSecret(token: string | null): boolean {
  return constantEqual(token, getTraeConfig().cronSecret);
}
