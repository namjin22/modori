import { connect, constants } from "node:http2";

import { createPrivateKey, sign } from "node:crypto";

import type { PushMessage } from "@/lib/push";

/**
 * iOS 앱 푸시 알림. Apple 푸시 서버(APNs)에 직접 보낸다. Android가 쓰는 FCM은 iOS 앱이 주는 번호(APNs 기기 번호)를 받지 못한다.
 * 새 의존성 없이 Node의 http2와 crypto만 쓴다. 키는 Apple 로그인 키(.p8)에서 "Apple Push Notifications service"도 켜 두면 같은 키를 쓴다
 * (APPLE_TEAM_ID·APPLE_KEY_ID·APPLE_PRIVATE_KEY). 다른 키를 쓰고 싶으면 APNS_KEY_ID·APNS_PRIVATE_KEY로 덮는다. 없으면 보내지 않는다.
 */

// 앱 번들 ID. 알림이 어느 앱의 것인지 알리는 값(apns-topic).
export const APNS_TOPIC = "site.modori.app";
const APNS_HOST = "https://api.push.apple.com";
// APNs는 서명 토큰을 20분~60분 사이에 한 번만 새로 만들게 한다(너무 자주 바꾸면 TooManyProviderTokenUpdates). 40분 쓴다.
const TOKEN_LIFETIME_MS = 40 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export type ApnsConfig = { teamId: string; keyId: string; privateKey: string };

export function apnsConfigFromEnv(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const teamId = env.APPLE_TEAM_ID;
  const keyId = env.APNS_KEY_ID || env.APPLE_KEY_ID;
  const privateKey = env.APNS_PRIVATE_KEY || env.APPLE_PRIVATE_KEY;
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** APNs에 내미는 서명된 토큰(JWT, ES256). 클레임은 iss(팀 ID)와 iat뿐이다. */
export function createApnsToken(config: ApnsConfig, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const key = createPrivateKey(config.privateKey.replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${base64url(signature)}`;
}

let cached: { token: string; expiresAt: number } | null = null;

function providerToken(config: ApnsConfig, nowMs: number): string {
  if (cached && cached.expiresAt > nowMs) return cached.token;
  cached = { token: createApnsToken(config, Math.floor(nowMs / 1000)), expiresAt: nowMs + TOKEN_LIFETIME_MS };
  return cached.token;
}

/** 시험에서 캐시를 비운다. */
export function resetApnsCache() {
  cached = null;
}

/** APNs 요청 본문. 알림 문구는 그대로 화면에 뜨고, url은 눌렀을 때 앱이 읽는 값이다. */
export function buildApnsPayload(message: PushMessage) {
  return {
    aps: { alert: { title: message.title, body: message.body }, sound: "default" },
    url: message.url,
  };
}

/** 요청 머리. 같은 collapse-id는 기기에서 하나로 묶인다(최대 64바이트). */
export function buildApnsHeaders(deviceToken: string, authToken: string, message: PushMessage): Record<string, string> {
  const headers: Record<string, string> = {
    ":method": "POST",
    ":path": `/3/device/${deviceToken}`,
    authorization: `bearer ${authToken}`,
    "apns-topic": APNS_TOPIC,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
  if (message.tag) headers["apns-collapse-id"] = message.tag.slice(0, 64);
  return headers;
}

/** 이 응답이면 그 번호는 더 쓸 수 없다(앱을 지웠거나 번호가 틀림). */
export function isGoneResponse(status: number, reason: string | undefined): boolean {
  return status === 410 || (status === 400 && (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic"));
}

export type ApnsSend = (headers: Record<string, string>, body: string) => Promise<{ status: number; reason?: string }>;

/** 하나의 http2 연결로 여러 번호에 보내는 실제 전송. 시험에서는 바꿔 끼운다. */
async function withSession<T>(run: (send: ApnsSend) => Promise<T>): Promise<T> {
  const session = connect(APNS_HOST);
  const failed = new Promise<never>((_, reject) => session.once("error", reject));
  const send: ApnsSend = (headers, body) =>
    new Promise((resolve, reject) => {
      const request = session.request(headers);
      let status = 0;
      let text = "";
      const timer = setTimeout(() => {
        request.close(constants.NGHTTP2_CANCEL);
        reject(new Error("APNs 응답 시간 초과"));
      }, REQUEST_TIMEOUT_MS);
      request.setEncoding("utf8");
      request.on("response", (response) => {
        status = Number(response[":status"] ?? 0);
      });
      request.on("data", (chunk: string) => {
        text += chunk;
      });
      request.on("end", () => {
        clearTimeout(timer);
        let reason: string | undefined;
        try {
          reason = text ? (JSON.parse(text) as { reason?: string }).reason : undefined;
        } catch (error) {
          console.warn("[apns] 응답을 읽지 못했다.", error instanceof Error ? error.name : error);
        }
        resolve({ status, reason });
      });
      request.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      request.end(body);
    });
  try {
    return await Promise.race([run(send), failed]);
  } finally {
    session.close();
  }
}

/**
 * iOS 기기 번호들에 같은 알림을 보낸다. Apple이 "더는 없는 번호"라고 답한 번호를 돌려준다(호출한 쪽이 지운다).
 * 그 밖의 오류는 번호를 남겨 두고 기록만 한다.
 */
export async function sendToApns(
  tokens: string[],
  message: PushMessage,
  config: ApnsConfig,
  open: <T>(run: (send: ApnsSend) => Promise<T>) => Promise<T> = withSession,
  nowMs: number = Date.now(),
): Promise<string[]> {
  if (tokens.length === 0) return [];
  const auth = providerToken(config, nowMs);
  const body = JSON.stringify(buildApnsPayload(message));
  return open(async (send) => {
    const gone: string[] = [];
    for (const token of tokens) {
      const { status, reason } = await send(buildApnsHeaders(token, auth, message), body);
      if (status === 200) continue;
      if (isGoneResponse(status, reason)) gone.push(token);
      else console.error("[apns] 알림을 보내지 못했다.", status, reason);
    }
    return gone;
  });
}
