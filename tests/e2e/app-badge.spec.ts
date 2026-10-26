import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 앱 아이콘(작업표시줄·Dock)의 안 읽은 알림 수(2026-10-26 요청). 브라우저의 아이콘 숫자 기능을 가짜로 바꿔 불린 값을 센다.
const ME = `e2e-badge2-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-badge2-f-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    badgeCalls: (number | "clear")[];
    __hidden: boolean;
  }
}

/** installed: 설치한 앱(독립 창)처럼 보이게 한다. */
async function fakeBadgeApi(page: Page, installed: boolean) {
  await page.addInitScript((standalone) => {
    window.badgeCalls = [];
    window.__hidden = false;
    Object.defineProperty(navigator, "setAppBadge", { value: async (count?: number) => void window.badgeCalls.push(count ?? 0), configurable: true });
    Object.defineProperty(navigator, "clearAppBadge", { value: async () => void window.badgeCalls.push("clear"), configurable: true });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const real = original(query);
      return standalone && query.includes("display-mode: standalone")
        ? ({ ...real, matches: true, media: query, addEventListener: real.addEventListener.bind(real), removeEventListener: real.removeEventListener.bind(real) } as MediaQueryList)
        : real;
    };
    // 창을 내려 둔 것처럼(보이지 않는 것처럼) 한다. 시험이 바꿀 수 있다.
    Object.defineProperty(document, "visibilityState", { get: () => (window.__hidden ? "hidden" : "visible"), configurable: true });
  }, installed);
}

async function signUp(page: Page) {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`아이콘${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  return prisma.user.findUniqueOrThrow({ where: { email: ME } });
}

async function newFollower(meId: string) {
  const friend = await prisma.user.upsert({
    where: { email: FRIEND },
    update: {},
    create: { email: FRIEND, nickname: `뱃${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  await prisma.follow.create({ data: { followerId: friend.id, followingId: meId } });
}

test("설치한 앱에서는 창을 내려 두어도 알림이 오면 아이콘 숫자가 바뀌고, 알림 화면을 열면 지워진다", async ({ page }) => {
  await fakeBadgeApi(page, true);
  const me = await signUp(page);
  await expect.poll(() => page.evaluate(() => window.badgeCalls.at(-1))).toBe("clear");

  // 창을 내려 둔 상태(보이지 않음)에서 알림이 온다. 설치한 앱은 그래도 서버에 묻는다.
  await page.evaluate(() => (window.__hidden = true));
  await newFollower(me.id);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => page.evaluate(() => window.badgeCalls.at(-1))).toBe(1);

  // 알림 화면을 보면 이미 읽는 중이라 지운다.
  await page.evaluate(() => (window.__hidden = false));
  await page.goto("/feed/reactions");
  await expect.poll(() => page.evaluate(() => window.badgeCalls.at(-1))).toBe("clear");
});

test("탭으로 연 웹은 아이콘 숫자를 건드리지 않고, 보이지 않을 때는 서버에 묻지도 않는다", async ({ page }) => {
  await fakeBadgeApi(page, false);
  const me = await signUp(page);
  await page.evaluate(() => (window.__hidden = true));
  await newFollower(me.id);
  let asked = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/notifications/unread")) asked += 1;
  });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1500);
  expect(asked).toBe(0);
  expect(await page.evaluate(() => window.badgeCalls)).toEqual([]);
});
