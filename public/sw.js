// 모도리 서비스 워커. 웹 푸시(창을 닫아도 오는 알림)만 맡는다(2026-10-19, lib/web-push.ts).
// 네트워크 요청(fetch)은 가로채지 않는다. 화면을 미리 담아 두지 않으니 배포하면 바로 새 화면이 뜬다.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** 알림을 눌렀을 때 열 주소. 모도리 안의 경로만 연다(lib/push-client.ts의 safePushPath와 같은 규칙). */
function safePath(value) {
  if (typeof value !== "string") return "/feed/reactions";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/feed/reactions";
  return value;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.warn("[sw] 알림 내용을 읽지 못했다.", error && error.name);
  }
  const title = typeof data.title === "string" && data.title ? data.title : "모도리";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      // 같은 tag는 하나로 묶인다(앱 푸시와 같은 값).
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/icons/icon-192.png",
      data: { url: safePath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      // 열려 있는 모도리 창이 있으면 그 창을 앞으로 가져와 옮긴다. 없으면 새 창을 연다.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        try {
          await open.navigate(target);
          return;
        } catch (error) {
          // 이 워커가 맡지 않은 창은 옮길 수 없다. 새 창으로 연다.
          console.warn("[sw] 열린 창을 옮기지 못했다.", error && error.name);
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
