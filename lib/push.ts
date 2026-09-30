import { createSign } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * 모바일 앱 푸시 알림(받은 반응, 새 팔로워). Google FCM(HTTP v1)으로 보낸다.
 *
 * 새 의존성 없이 Node의 crypto로 서비스 계정 서명(JWT)을 만들어 액세스 토큰을 받는다. 서비스 계정 키는 서버 환경 변수
 * FIREBASE_SERVICE_ACCOUNT(JSON 통째로 또는 base64)에만 두고, 없으면 아무것도 보내지 않는다(개발·테스트).
 * 알림을 못 보내도 반응·팔로우 자체는 성공해야 하므로 오류는 삼키지 않고 기록만 남기고 넘긴다.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** 알림을 누르면 앱이 열 화면. 모도리 안의 경로("/feed/reactions")만 쓴다. */
  url: string;
  /** 같은 tag는 기기에서 하나로 묶인다(짧은 시간 안의 같은 알림이 쌓이지 않는다). */
  tag?: string;
};

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** 환경 변수 값(JSON 또는 base64로 감싼 JSON)을 읽는다. 형식이 틀리면 null. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const parsed = JSON.parse(text) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key };
  } catch (error) {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT를 읽지 못했다.", error instanceof Error ? error.name : error);
    return null;
  }
}

/** 액세스 토큰을 받을 때 내미는 서명된 신청서(JWT, RS256). */
export function createAssertion(account: ServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

/** FCM v1 요청 본문. 알림 문구는 그대로 화면에 뜨고, url은 눌렀을 때 앱이 읽는 값이다. */
export function buildFcmBody(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { url: message.url },
      android: {
        priority: "HIGH",
        notification: message.tag ? { tag: message.tag } : {},
      },
    },
  };
}

type Fetch = typeof fetch;

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(account: ServiceAccount, fetchImpl: Fetch, nowMs: number): Promise<string | null> {
  if (cached && cached.expiresAt - 60_000 > nowMs) return cached.token;
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createAssertion(account, Math.floor(nowMs / 1000)),
    }),
  });
  if (!response.ok) {
    console.error("[push] 액세스 토큰을 받지 못했다.", response.status);
    return null;
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cached = { token: json.access_token, expiresAt: nowMs + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** 시험에서 캐시를 비운다. */
export function resetPushCache() {
  cached = null;
}

/**
 * 기기 알림 번호들에 같은 알림을 보낸다. Google이 "더는 없는 번호"(앱을 지운 기기 등)라고 답한 번호를 돌려준다.
 */
export async function sendToTokens(
  tokens: string[],
  message: PushMessage,
  account: ServiceAccount,
  fetchImpl: Fetch = fetch,
  nowMs: number = Date.now(),
): Promise<string[]> {
  if (tokens.length === 0) return [];
  const access = await accessToken(account, fetchImpl, nowMs);
  if (!access) return [];

  const gone: string[] = [];
  for (const token of tokens) {
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildFcmBody(token, message)),
    });
    if (response.ok) continue;
    const text = await response.text();
    // 404 UNREGISTERED: 이 번호는 더 쓸 수 없다. 그 밖의 오류(일시 장애 등)는 번호를 남겨 두고 기록만 한다.
    if (response.status === 404 || text.includes("UNREGISTERED")) gone.push(token);
    else console.error("[push] 알림을 보내지 못했다.", response.status, text.slice(0, 200));
  }
  return gone;
}

/** 사람 한 명의 모든 기기에 알림을 보낸다. 서비스 계정 키가 없으면 조용히 넘어간다. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  const account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!account) return;
  try {
    const rows = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    const gone = await sendToTokens(
      rows.map((row) => row.token),
      message,
      account,
    );
    if (gone.length > 0) await prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
  } catch (error) {
    console.error("[push] 알림을 보내는 중 오류가 났다.", error);
  }
}
