import { expect, test } from "@playwright/test";

// 서비스 워커(public/sw.js)가 받은 웹 푸시를 알림으로 띄우는지 본다. 브라우저 푸시 서버 대신 Chrome 개발자 도구 기능으로
// 푸시 하나를 서비스 워커에 바로 넣는다.
// 기본 headless 셸은 알림 권한을 줘도 늘 거절해서, 이 파일만 알림이 되는 새 headless(전체 Chromium)로 돈다.
test.use({ channel: "chromium" });

test("웹 푸시를 받으면 알림을 띄우고, 모도리 밖 주소는 열지 않는다", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["notifications"], { origin: baseURL });
  await page.goto("/login");

  const cdp = await context.newCDPSession(page);
  const registered = new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const ours = registrations.find((registration) => registration.scopeURL.startsWith(baseURL ?? "") && !registration.isDeleted);
      if (ours) resolve(ours.registrationId);
    });
  });
  await cdp.send("ServiceWorker.enable");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const registrationId = await registered;

  const deliver = (data: object) =>
    cdp.send("ServiceWorker.deliverPushMessage", { origin: new URL(baseURL ?? "").origin, registrationId, data: JSON.stringify(data) });
  const shown = () =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return (await registration.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url }));
    });

  await deliver({ title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요", url: "/feed/reactions", tag: "reaction:t1" });
  await expect.poll(shown).toEqual([
    { title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요", tag: "reaction:t1", url: "/feed/reactions" },
  ]);

  // 밖으로 나가는 주소가 오면 알림 화면을 연다.
  await deliver({ title: "새 팔로워", body: "누군가 나를 팔로우했어요", url: "https://evil.example/", tag: "follow:x" });
  await expect.poll(async () => (await shown()).find((n) => n.tag === "follow:x")?.url).toBe("/feed/reactions");
});
