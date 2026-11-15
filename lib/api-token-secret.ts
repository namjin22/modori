import { createHash, randomBytes } from "node:crypto";

import { API_TOKEN_PREFIX } from "@/lib/api-token";

/** 서버에서만 쓴다(node:crypto). 상수와 머리글 읽기는 lib/api-token.ts. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 새 토큰. token은 한 번만 보이고, hash를 저장한다. hint는 목록에서 어느 것인지 알아볼 앞 8자다(이것만으로는 알 수 없다). */
export function generateApiToken(): { token: string; hash: string; hint: string } {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashApiToken(token), hint: token.slice(0, API_TOKEN_PREFIX.length + 4) };
}
