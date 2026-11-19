import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 작업표시줄·Dock 아이콘의 알림 숫자는 "친구가 할 일을 끝내면 알림" 스위치(이 컴퓨터의 알림도 같이 켜고 끈다, 2026-11-17)를 따른다(2026-10-28 제보: 알림을 껐는데 아이콘 숫자가 그대로였다).
// 데스크톱 앱이 넘겨받는 window.modoriDesktop.setBadge를 가짜로 두고, 불린 숫자를 센다.
const ME = `e2e-iconbadge-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-iconbadge-friend-${RUN_TAG}@modori.test`;
const SECOND = `e2e-iconbadge-second-${RUN_TAG}@modori.test`;
const THIRD = `e2e-iconbadge-third-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND, SECOND, THIRD] } } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    iconBadgeCalls: number[];
  }
}

test("이 기기에서 알림을 끄면 아이콘 숫자가 없어지고 켜면 다시 뜬다. 탭 아래 숫자는 스위치와 상관없이 그대로다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND, SECOND, THIRD] } } });
  await page.addInitScript(() => {
    window.iconBadgeCalls = [];
    // 진짜 브라우저는 알림 허락을 페이지를 새로 열어도 기억한다. 스위치가 알림 화면에 있어 켠 뒤 다른 화면을 새로 열어 보므로, 허락 값을 세션 저장소에 둔다.
    class FakeNotification {
      static get permission(): NotificationPermission {
        return (sessionStorage.getItem("fake-notification-permission") as NotificationPermission | null) ?? "default";
      }
      static async requestPermission(): Promise<NotificationPermission> {
        sessionStorage.setItem("fake-notification-permission", "granted");
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

  // 스위치는 소셜의 알림 화면에 있다(설정에서는 뺐다, 2026-11-16 요청). 그 화면을 열면 알림을 읽은 것으로 쳐서 안 읽은 알림이 0이 되므로,
  // 켠 뒤와 끈 뒤에 새 팔로워를 하나씩 더해 "안 읽은 알림 1개"를 만들고 홈 쪽 탭에서 아이콘 숫자를 본다.
  await page.goto("/feed/reactions");
  const toggle = page.getByRole("checkbox", { name: /친구가 할 일을 끝내면 알림/ });
  await toggle.check();
  await expect(toggle).toBeChecked();
  // 스위치를 켜면 앱이 이 기기 설정(localStorage)과 서버 설정을 비동기로 적고 화면을 다시 그린다. 끝나기 전에 아래에서 DB에 행을 만들고 이동하면
  // 설정이 사라지거나 새 팔로우가 읽은 것으로 쳐진다. 시험 DB가 같은 머신에 있는 CI(2026-11-19)에서 순서가 뒤집혀 드러났다(예전에는 느린 DB가 시간을 벌어 줬다).
  await expect.poll(() => page.evaluate(() => localStorage.getItem("modori-desktop-notify"))).toMatch(/^(on|push):/);
  await page.waitForLoadState("networkidle");
  const second = await prisma.user.create({ data: { email: SECOND, nickname: `아둘${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: second.id, followingId: me.id } });
  await page.goto("/feed");
  await expect(page.getByRole("navigation").last().getByLabel(/안 읽은 알림/)).toHaveAttribute("aria-label", "안 읽은 알림 1개");
  await expect.poll(() => page.evaluate(() => window.iconBadgeCalls.at(-1))).toBe(1);

  await page.goto("/feed/reactions");
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  // 끈 뒤에도 같다: 이 기기 설정이 지워지고 서버 설정이 꺼질 때까지 기다린다.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("modori-desktop-notify"))).toBeNull();
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).notifyFriendDone).toBe(false);
  await page.waitForLoadState("networkidle");
  const third = await prisma.user.create({ data: { email: THIRD, nickname: `아셋${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: third.id, followingId: me.id } });
  await page.goto("/feed");
  await expect.poll(() => page.evaluate(() => window.iconBadgeCalls.at(-1))).toBe(0);
  await expect(page.getByRole("navigation").last().getByLabel(/안 읽은 알림/)).toHaveAttribute("aria-label", "안 읽은 알림 1개");
});
