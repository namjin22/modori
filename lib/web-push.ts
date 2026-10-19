import { sendNotification, WebPushError, type PushSubscription } from "web-push";

import type { PushMessage } from "@/lib/push";

/**
 * 컴퓨터 브라우저 웹 푸시(2026-10-19). 창을 닫아도 알림이 온다. 알림 내용은 그 브라우저만 풀 수 있게 잠가 보내서(RFC 8291)
 * 가운데의 브라우저 회사 푸시 서버(Chrome은 Google, Firefox는 Mozilla, Edge는 Microsoft, Safari는 Apple)는 내용을 볼 수 없다.
 *
 * 서버 열쇠(VAPID)는 VM의 .env에만 둔다. 없으면 아무것도 보내지 않고, 켜는 쪽은 창이 열려 있을 때의 알림으로 남는다.
 */
export type VapidConfig = { subject: string; publicKey: string; privateKey: string };

// 푸시 서버가 문제가 있을 때 연락할 곳. 개인 메일 대신 사이트 주소를 쓴다(표준이 둘 다 허용한다).
const VAPID_SUBJECT = "https://modori.site";
// 하루 안에 브라우저가 켜지지 않으면 버린다. 어제 반응을 오늘 밤에 알리면 헷갈린다.
const TTL_SECONDS = 24 * 60 * 60;

export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { subject: VAPID_SUBJECT, publicKey, privateKey };
}

export type WebSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

type Send = typeof sendNotification;

/**
 * 구독들에 같은 알림을 보낸다. 푸시 서버가 "없는 구독"(404·410: 알림을 끄거나 브라우저 데이터를 지움)이라고 답한 주소를 돌려준다.
 * 그 밖의 오류(일시 장애)는 구독을 남겨 두고 기록만 한다.
 */
export async function sendToWebSubscriptions(
  rows: WebSubscriptionRow[],
  message: PushMessage,
  vapid: VapidConfig,
  send: Send = sendNotification,
): Promise<string[]> {
  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.tag });
  const gone: string[] = [];
  for (const row of rows) {
    const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await send(subscription, payload, { vapidDetails: vapid, TTL: TTL_SECONDS, urgency: "normal", timeout: 10_000 });
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        gone.push(row.endpoint);
      } else {
        const status = error instanceof WebPushError ? error.statusCode : error instanceof Error ? error.name : error;
        console.error("[web-push] 알림을 보내지 못했다.", status);
      }
    }
  }
  return gone;
}

/** 브라우저가 보낸 구독을 검사한다. 푸시 서버 주소는 https만, 열쇠는 base64url 꼴만 받는다. */
export function readSubscription(value: unknown): WebSubscriptionRow | null {
  const { endpoint, keys } = (value ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1024) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    console.warn("[web-push] 구독 주소를 읽지 못했다.", error instanceof Error ? error.name : error);
    return null;
  }
  if (url.protocol !== "https:") return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
  if (typeof p256dh !== "string" || p256dh.length < 80 || p256dh.length > 100 || !base64url.test(p256dh)) return null;
  if (typeof auth !== "string" || auth.length < 16 || auth.length > 32 || !base64url.test(auth)) return null;
  return { endpoint, p256dh, auth };
}
