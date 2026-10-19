import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 웹·데스크톱 창의 컴퓨터 알림(2026-10-19 요청). 브라우저 알림 창 대신 가짜 Notification으로 띄운 것을 센다.
const ME = `e2e-dnotify-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-dnotify-friend-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    shownNotifications: { title: string; body?: string; tag?: string }[];
  }
}

test("알림 화면에서 켜 두고 그 화면에 창을 둔 채 다른 일을 하면, 새 팔로워가 컴퓨터 알림으로 한 번 뜬다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await page.addInitScript(() => {
    window.shownNotifications = [];
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static async requestPermission(): Promise<NotificationPermission> {
        FakeNotification.permission = "granted";
        return "granted";
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        window.shownNotifications.push({ title, body: options?.body, tag: options?.tag });
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
    // 사용자가 다른 창을 보고 있는 것으로 둔다. 보고 있는 창에는 띄우지 않는다.
    document.hasFocus = () => false;
  });

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`컴알${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/feed/reactions");
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  const toggle = page.getByRole("checkbox", { name: /이 기기에서 알림 띄우기/ });
  // 켜자마자 한 번 물어 기준 시각을 잡는다. 그 뒤에 생긴 일만 띄운다.
  const baseline = page.waitForResponse((response) => response.url().includes("/api/notifications/unread?detail=1"));
  await toggle.check();
  await expect(toggle).toBeChecked();
  await baseline;
  // 다른 계정이 같은 브라우저로 로그인하면 꺼진 것으로 보도록 계정 id를 같이 적는다.
  expect(await page.evaluate(() => localStorage.getItem("modori-desktop-notify"))).toBe(`on:${me.id}`);

  // 알림 화면에 창을 둔 채 다른 일을 하는 동안 새 팔로워가 생긴다(이 화면에서도 물어야 한다).
  // 시각은 서버와 같은 컴퓨터의 시계로 적는다(시험 DB는 다른 곳에 있어 시계가 조금 다를 수 있다).
  const friendName = `컴친${RUN_TAG}`;
  const friend = await prisma.user.create({ data: { email: FRIEND, nickname: friendName, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id, createdAt: new Date() } });

  // 1분을 기다리지 않고, 창으로 돌아올 때 묻는 길로 바로 묻게 한다.
  const ask = () => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await ask();
  await expect.poll(() => page.evaluate(() => window.shownNotifications)).toEqual([
    { title: "새 팔로워", body: `${friendName}님이 나를 팔로우했어요`, tag: `follow:${friend.id}` },
  ]);

  // 다시 물어도 같은 알림을 또 띄우지 않는다.
  const again = page.waitForResponse((response) => response.url().includes("/api/notifications/unread?detail=1"));
  await ask();
  await again;
  expect(await page.evaluate(() => window.shownNotifications.length)).toBe(1);
});
