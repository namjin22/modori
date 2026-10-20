import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 웹 푸시(2026-10-19). 실제 브라우저 푸시 서버 대신 가짜 구독을 돌려주게 해서, 켜기·끄기·로그아웃 때 서버에 맡긴 구독이
// 생기고 지워지는지 본다. 서비스 워커(public/sw.js)는 진짜로 올린다.
const ME = `e2e-webpush-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-webpush-friend-${RUN_TAG}@modori.test`;
const ENDPOINT = `https://push.invalid/modori-test/${RUN_TAG}`;

test.afterAll(async () => {
  await prisma.webPushSubscription.deleteMany({ where: { endpoint: ENDPOINT } });
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    shownTitles: string[];
  }
}

test("웹 푸시로 켜면 구독이 서버에 맡겨지고, 창의 알림은 띄우지 않으며, 끄거나 로그아웃하면 지워진다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await page.addInitScript((endpoint) => {
    window.shownTitles = [];
    class FakeNotification {
      static permission: NotificationPermission = "granted";
      static async requestPermission(): Promise<NotificationPermission> {
        return "granted";
      }
      onclick: (() => void) | null = null;
      constructor(title: string) {
        window.shownTitles.push(title);
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
    document.hasFocus = () => false;

    // 구독은 새로 고쳐도 남아 있어야 해서 sessionStorage에 둔다(브라우저의 진짜 구독처럼).
    const KEY = "fake-push-subscription";
    let serverKey: BufferSource | null = null;
    const make = () => ({
      endpoint,
      options: { applicationServerKey: serverKey },
      toJSON: () => ({ endpoint, keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } }),
      unsubscribe: async () => {
        sessionStorage.removeItem(KEY);
        return true;
      },
    });
    PushManager.prototype.getSubscription = async () =>
      (sessionStorage.getItem(KEY) ? make() : null) as unknown as PushSubscription;
    PushManager.prototype.subscribe = async (options?: PushSubscriptionOptionsInit) => {
      serverKey = (options?.applicationServerKey as BufferSource | undefined) ?? null;
      sessionStorage.setItem(KEY, "1");
      return make() as unknown as PushSubscription;
    };
  }, ENDPOINT);

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`웹푸${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  const mySubscriptions = () => prisma.webPushSubscription.count({ where: { userId: me.id, endpoint: ENDPOINT } });

  await page.goto("/feed/reactions");
  const toggle = page.getByRole("checkbox", { name: /이 기기에서 알림 띄우기/ });
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("창을 닫아도 컴퓨터 알림으로 와요")).toBeVisible();
  await expect.poll(mySubscriptions).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("modori-desktop-notify"))).toBe(`push:${me.id}`);

  // 새로 열어도 켜진 채다.
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect.poll(mySubscriptions).toBe(1);

  // 웹 푸시로 켰으면 창에서는 띄우지 않는다(같은 알림이 두 번 뜬다). 숫자만 묻는다.
  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(homeReady(page)).toBeVisible();
  const friend = await prisma.user.create({ data: { email: FRIEND, nickname: `웹친${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id, createdAt: new Date() } });
  const asked = page.waitForResponse((response) => response.url().includes("/api/notifications/unread"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect((await asked).url()).not.toContain("detail=1");
  await expect(page.getByLabel(/안 읽은 알림/)).toHaveAttribute("aria-label", "안 읽은 알림 1개");
  expect(await page.evaluate(() => window.shownTitles)).toEqual([]);

  // 끄면 서버와 브라우저에서 모두 지운다.
  await page.goto("/feed/reactions");
  await toggle.uncheck();
  await expect.poll(mySubscriptions).toBe(0);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("fake-push-subscription"))).toBeNull();

  // 다시 켜고 로그아웃하면 지운다. 학교 PC에서 다음 사람이 앞사람 알림을 받지 않는다.
  await toggle.check();
  await expect.poll(mySubscriptions).toBe(1);
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.getByRole("dialog", { name: "로그아웃할까요?" }).getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(mySubscriptions).toBe(0);
});

test("웹 푸시 공개 열쇠는 누구나 받지만, 구독은 로그인해야 맡길 수 있다", async ({ request }) => {
  const key = await request.get("/api/push/web");
  expect(key.status()).toBe(200);
  expect((await key.json()).publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);

  const body = { endpoint: ENDPOINT, keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } };
  expect((await request.post("/api/push/web", { data: body })).status()).toBe(401);
});
