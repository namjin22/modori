import { createHash } from "node:crypto";

import { expect, test as base, type Browser } from "@playwright/test";

import { issueDesktopCode } from "@/lib/desktop-login";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

const MOBILE_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-mobile-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * 모바일 앱(Capacitor) 안의 화면을 흉내 낸다. 앱 밖에는 없는 window.Capacitor 다리를 가짜로 심는다:
 * 시스템 로그인 창을 열면 주소만 남기고, modori:// 링크는 시험이 handler로 직접 넘긴다.
 * 실제 기기에서 도는 것은 이 시험이 보지 못한다(docs/platforms.md "모바일 앱").
 */
async function appPage(browser: Browser) {
  const context = await browser.newContext({ userAgent: MOBILE_UA });
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__opened = [];
    w.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Browser: { open: async ({ url }: { url: string }) => (w.__opened as string[]).push(url) },
        App: {
          addListener: async (_event: string, handler: (data: { url: string }) => void) => {
            w.__appUrlOpen = handler;
            return { remove: () => undefined };
          },
          getLaunchUrl: async () => undefined,
        },
      },
    };
  });
  return { context, page: await context.newPage() };
}

test("모바일 앱의 로그인 버튼은 시스템 로그인 창을 열고, 돌아오는 링크로 로그인한다", async ({ browser, email }, testInfo) => {
  const { context, page } = await appPage(browser);
  await page.goto("/login");
  // 웹의 서버 액션 버튼도, 데스크톱의 링크도 아니고 앱용 버튼이다.
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
  await page.getByRole("button", { name: "Google로 계속하기" }).click();

  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length)).toBe(1);
  const opened = new URL(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]));
  expect(opened.pathname).toBe("/desktop/login");
  expect(opened.searchParams.get("provider")).toBe("google");
  const challenge = opened.searchParams.get("challenge")!;
  // 서버에는 verifier의 해시만 가고, verifier는 앱 안에만 남는다.
  const verifier = await page.evaluate(() => localStorage.getItem("modori-login-verifier"));
  expect(verifier).toBeTruthy();
  expect(createHash("sha256").update(verifier!).digest("base64url")).toBe(challenge);

  // 브라우저에서 로그인을 마친 것처럼 코드를 발급받고, 앱이 그 링크로 열린 것으로 한다.
  const user = await prisma.user.create({
    data: { email, nickname: `모바일${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  const code = await issueDesktopCode(user.id, challenge);
  await page.evaluate((link) => (window as unknown as { __appUrlOpen: (d: { url: string }) => void }).__appUrlOpen({ url: link }), `modori://login?code=${encodeURIComponent(code)}`);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation").last().getByRole("link", { name: "마이페이지" })).toBeVisible();
  // 한 번 쓴 verifier는 지운다.
  expect(await page.evaluate(() => localStorage.getItem("modori-login-verifier"))).toBeNull();
  await context.close();
});

test("verifier 없이 온 링크(다른 기기에서 온 것)로는 로그인하지 않는다", async ({ browser, email }) => {
  const { context, page } = await appPage(browser);
  await page.goto("/login");
  const user = await prisma.user.create({ data: { email, nickname: `남의${RUN_TAG}`, privacyAgreedAt: new Date() } });
  const code = await issueDesktopCode(user.id, createHash("sha256").update("other").digest("base64url"));
  await page.evaluate((link) => (window as unknown as { __appUrlOpen: (d: { url: string }) => void }).__appUrlOpen({ url: link }), `modori://login?code=${encodeURIComponent(code)}`);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});

test("모바일 앱에서는 Windows 앱 받기를 숨긴다", async ({ browser, email }, testInfo) => {
  const { context, page } = await appPage(browser);
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`설정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Windows 앱 받기/ })).toHaveCount(0);
  await context.close();
});
