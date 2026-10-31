import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 작업표시줄·Dock 아이콘의 알림 숫자는 "이 기기에서 알림 띄우기" 스위치를 따른다(2026-10-28 제보: 알림을 껐는데 아이콘 숫자가 그대로였다).
// 데스크톱 앱이 넘겨받는 window.modoriDesktop.setBadge를 가짜로 두고, 불린 숫자를 센다.
const ME = `e2e-iconbadge-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-iconbadge-friend-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    iconBadgeCalls: number[];
  }
}

test("이 기기에서 알림을 끄면 아이콘 숫자가 없어지고 켜면 다시 뜬다. 탭 아래 숫자는 스위치와 상관없이 그대로다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await page.addInitScript(() => {
    window.iconBadgeCalls = [];
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static async requestPermission(): Promise<NotificationPermission> {
        FakeNotification.permission = "granted";
        return "granted";
      }
      onclick: (() => void) | null = null;
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
    Object.defineProperty(window, "modoriDesktop", {
      value: { focus() {}, setBadge: (count: number) => window.iconBadgeCalls.push(count) },
      configurable: true,
    });
    // 푸시 서버가 없는 브라우저(데스크톱 앱처럼)다. 웹 푸시를 못 켜면 창이 열려 있을 때의 알림으로 켠다.
    PushManager.prototype.subscribe = async () => {
      throw new DOMException("push service not available", "AbortError");
    };
  });

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`아이콘${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  const friend = await prisma.user.create({ data: { email: FRIEND, nickname: `아친${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id } });

  // 기본은 꺼져 있다. 안 읽은 알림이 1개 있어도 아이콘에는 숫자를 띄우지 않는다(탭 아래 숫자는 보인다).
  await page.goto("/feed");
  await expect(page.getByRole("navigation").last().getByLabel(/안 읽은 알림/)).toHaveAttribute("aria-label", "안 읽은 알림 1개");
  expect(await page.evaluate(() => window.iconBadgeCalls.filter((count) => count > 0))).toEqual([]);

  await page.goto("/settings/preferences");
  const toggle = page.getByRole("checkbox", { name: /이 기기에서 알림 띄우기/ });
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.iconBadgeCalls.at(-1))).toBe(1);

  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.iconBadgeCalls.at(-1))).toBe(0);
  await expect(page.getByRole("navigation").last().getByLabel(/안 읽은 알림/)).toHaveAttribute("aria-label", "안 읽은 알림 1개");
});
