import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "v1";
const TOKEN_PATTERN = /^v1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

function signature(nonce: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`modori:database-session:${PREFIX}:${nonce}`).digest();
}

export function generateSignedSessionToken(secret: string): string {
  const nonce = randomBytes(32).toString("base64url");
  return `${PREFIX}.${nonce}.${signature(nonce, secret).toString("base64url")}`;
}

export function isSignedSessionToken(token: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;
  const actual = Buffer.from(match[2], "base64url");
  return actual.length === 32 && actual.toString("base64url") === match[2] &&
    timingSafeEqual(actual, signature(match[1], secret));
}
