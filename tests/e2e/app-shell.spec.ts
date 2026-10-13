import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 아이폰 친구의 피드백(2026-10-13)으로 바뀐 앱 동작: 당겨서 새로고침, 글 적는 동안 하단 탭 숨김, 앱은 휴대폰 시간대를 따름,
// 로그아웃은 일반 폼 POST로 로그인 화면을 통째로 새로 연다.
const EMAIL = `e2e-appshell-${RUN_TAG}@modori.test`;
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ModoriMobile/1.0.0";

async function signUp(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`앱틀${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test.describe("모바일 앱", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: APP_UA, timezoneId: "America/Toronto" });

  test("화면 맨 위에서 아래로 당기면 새로고침하고, 길게 누른 뒤 끄는 것은 새로고침이 아니다", async ({ page }) => {
    await signUp(page);
    await page.waitForTimeout(500);

    const drag = async (holdMs: number) => {
      await page.evaluate(() => {
        (window as unknown as { __before?: boolean }).__before = true;
        window.scrollTo(0, 0);
      });
      const client = await page.context().newCDPSession(page);
      const start = { x: 195, y: 300 };
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      if (holdMs) await page.waitForTimeout(holdMs);
      for (let step = 1; step <= 10; step += 1) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 300 + step * 25 }] });
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await client.detach();
    };
    const reloaded = () => page.evaluate(() => !(window as unknown as { __before?: boolean }).__before);

    // 길게 누른 뒤(0.5초) 끌면 새로고침이 아니다(할 일·일정을 집는 동작).
    await drag(500);
    await page.waitForTimeout(1000);
    expect(await reloaded()).toBe(false);

    // 누르자마자 당기면 새로고침한다.
    await drag(0);
    await expect.poll(reloaded, { timeout: 10_000 }).toBe(true);
    await expect(homeReady(page)).toBeVisible();
  });

  test("글을 적는 동안에는 하단 탭을 숨긴다(자판 위로 따라 올라오지 않게)", async ({ page }) => {
    await signUp(page);
    const nav = page.locator("[data-bottom-nav]");
    await expect(nav).toBeVisible();
    await page.getByRole("button", { name: /에 할 일 쓰기$/ }).first().click();
    await expect(page.getByLabel(/ 할 일$/).first()).toBeFocused();
    await expect(nav).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(nav).toBeVisible();
  });

  test("앱은 묻지 않고 휴대폰의 시간대를 따르고, 마이페이지에는 고르는 칸 대신 지금 값만 보인다", async ({ page }) => {
    await signUp(page);
    await prisma.user.update({ where: { email: EMAIL }, data: { timezone: "Asia/Seoul" } });
    await page.goto("/");
    // 안내 카드 없이 저절로 맞춘다.
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).timezone).toBe("America/Toronto");
    await expect(page.getByRole("region", { name: "시간대 안내" })).toHaveCount(0);

    await page.goto("/settings");
    await expect(page.getByText("앱에서는 휴대폰의 시간대를 자동으로 따라요.")).toBeVisible();
    await expect(page.getByLabel("시간대", { exact: true })).toHaveCount(0);
  });
});

test("로그아웃은 다른 사이트에서 보낸 요청을 받지 않는다", async ({ request }) => {
  const response = await request.post("/api/logout", { headers: { "sec-fetch-site": "cross-site" }, maxRedirects: 0 });
  expect(response.status()).toBe(403);
});

test.describe("안드로이드 앱", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0",
  });

  test("뒤로 가기는 떠 있는 창부터 닫고, 창이 없으면 뒤 화면으로 간다. 상태 막대 여백 표시가 붙는다", async ({ page, context }) => {
    // 앱 밖에는 없는 Capacitor 다리를 흉내 낸다. 뒤로 가기 리스너만 받아 둔다.
    await context.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const handlers: Record<string, (data: unknown) => void> = {};
      w.__handlers = handlers;
      w.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => "android",
        Plugins: {
          App: {
            addListener: async (event: string, handler: (data: unknown) => void) => {
              handlers[event] = handler;
              return { remove: () => undefined };
            },
            getLaunchUrl: async () => undefined,
            exitApp: async () => undefined,
          },
        },
      };
    });
    await signUp(page);
    expect(await page.evaluate(() => document.documentElement.dataset.app)).toBe("android");

    const back = (canGoBack: boolean) =>
      page.evaluate((value) => (window as unknown as { __handlers: Record<string, (d: unknown) => void> }).__handlers.backButton({ canGoBack: value }), canGoBack);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page.getByRole("dialog", { name: "로그아웃할까요?" })).toBeVisible();

    // 창이 떠 있으면 창만 닫고 화면은 그대로다.
    await back(true);
    await expect(page.getByRole("dialog", { name: "로그아웃할까요?" })).toBeHidden();
    await expect(page).toHaveURL(/\/settings$/);

    // 창이 없으면 뒤 화면(홈)으로 간다.
    await back(true);
    await expect(page).toHaveURL(/\/$/);
  });
});
