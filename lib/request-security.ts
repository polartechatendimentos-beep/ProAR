import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;

export function safeSecretEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return Boolean(secret) && safeSecretEquals(authorization, `Bearer ${secret}`);
}

function clientKey(request: Request, namespace: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${namespace}:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

export function enforceRateLimit(
  request: Request,
  namespace: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): NextResponse | null {
  const now = Date.now();
  const key = clientKey(request, namespace);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { success: false, error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  current.count += 1;
  return null;
}
