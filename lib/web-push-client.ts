import { canNotifyHere } from "@/lib/desktop-notify";

/**
 * 컴퓨터 브라우저의 웹 푸시 구독(2026-10-19). 서비스 워커(public/sw.js)를 올리고, 서버 공개 열쇠로 브라우저 푸시 서버에 구독해
 * 그 주소를 서버에 맡긴다(app/api/push/web). 브라우저 안에서만 부른다.
 */
const SW_PATH = "/sw.js";
const API = "/api/push/web";

/** 웹 푸시를 쓸 수 있는 곳인지. 데스크톱 앱(Electron)은 푸시 서버가 없어 창이 열려 있을 때의 알림을 쓴다. */
export function webPushSupported(): boolean {
  return (
    canNotifyHere() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !navigator.userAgent.includes("ModoriDesktop")
  );
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
}

/**
 * 구독하고 서버에 맡긴다. 서버에 열쇠가 없으면(404) false. 이미 구독했으면 그 구독을 다시 맡긴다(같은 주소는 덮어쓴다).
 * 브라우저나 서버가 실패하면 던진다. 부른 쪽이 창이 열려 있을 때의 알림으로 바꾼다.
 */
export async function subscribeWebPush(): Promise<boolean> {
  if (!webPushSupported()) return false;
  const keyResponse = await fetch(API, { cache: "no-store" });
  if (keyResponse.status === 404) return false;
  if (!keyResponse.ok) throw new Error(`웹 푸시 열쇠를 받지 못했다 ${keyResponse.status}`);
  const { publicKey } = (await keyResponse.json()) as { publicKey: string };
  const key = keyBytes(publicKey);

  await navigator.serviceWorker.register(SW_PATH);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // 서버 열쇠가 바뀌었으면 옛 구독으로는 보낼 수 없다.
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error(`웹 푸시 구독을 맡기지 못했다 ${response.status}`);
  return true;
}

/** 이 브라우저의 구독을 끊는다. 서버에서 먼저 지운다(세션이 살아 있을 때만 지울 수 있다). 실패해도 브라우저 쪽은 끊는다. */
export async function unsubscribeWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    const response = await fetch(API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!response.ok) throw new Error(`웹 푸시 구독 삭제 실패 ${response.status}`);
  } catch (error) {
    // 서버에 남아도 브라우저가 끊으면 푸시 서버가 "없는 구독"이라고 답해 서버가 지운다(lib/web-push.ts).
    console.warn("[web-push] 서버에서 구독을 지우지 못했다.", error instanceof Error ? error.message : error);
  }
  await subscription.unsubscribe();
}
