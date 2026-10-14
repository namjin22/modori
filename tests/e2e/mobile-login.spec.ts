import { createHash } from "node:crypto";

import { expect, test as base, type Browser } from "@playwright/test";

import { issueDesktopCode } from "@/lib/desktop-login";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

const MOBILE_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ModoriMobile/1.0.0";

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
async function appPage(browser: Browser, platform: "android" | "ios" = "android") {
  const context = await browser.newContext({ userAgent: platform === "ios" ? IOS_UA : MOBILE_UA });
  await context.addInitScript((platform) => {
    const w = window as unknown as Record<string, unknown>;
    w.__opened = [];
    w.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      Plugins: {
        Browser: {
          open: async ({ url }: { url: string }) => (w.__opened as string[]).push(url),
          // 링크를 받으면 바로 다른 주소로 넘어가므로 화면이 바뀌어도 남는 곳에 센다.
          close: async () => sessionStorage.setItem("closed", String(Number(sessionStorage.getItem("closed") ?? 0) + 1)),
        },
        App: {
          addListener: async (_event: string, handler: (data: { url: string }) => void) => {
            w.__appUrlOpen = handler;
            return { remove: () => undefined };
          },
          getLaunchUrl: async () => undefined,
        },
      },
    };
  }, platform);
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
  // 가입은 시스템 브라우저에서 이뤄져서, 앱에서 왔다는 표시를 링크에 실어 보낸다(lib/signup-source.ts).
  expect(opened.searchParams.get("from")).toBe("app-android");
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

test("iOS 앱은 가입 경로를 app-ios로 보내고, 돌아오면 앱 위에 떠 있는 로그인 창을 닫는다", async ({ browser, email }, testInfo) => {
  const { context, page } = await appPage(browser, "ios");
  await page.goto("/login");
  await page.getByRole("button", { name: "Google로 계속하기" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length)).toBe(1);
  const opened = new URL(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]));
  expect(opened.searchParams.get("from")).toBe("app-ios");

  const user = await prisma.user.create({
    data: { email, nickname: `아이폰${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  const code = await issueDesktopCode(user.id, opened.searchParams.get("challenge")!);
  await page.evaluate((link) => (window as unknown as { __appUrlOpen: (d: { url: string }) => void }).__appUrlOpen({ url: link }), `modori://login?code=${encodeURIComponent(code)}`);
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem("closed"))).toBe("1");
  await context.close();
});

test("로그인 화면은 폰 앱에서 스크롤 없이 화면에 꽉 차고, Google 버튼에 G 표시가 있다", async ({ browser }) => {
  for (const size of [{ width: 360, height: 640 }, { width: 412, height: 915 }, { width: 320, height: 568 }]) {
    const context = await browser.newContext({ userAgent: MOBILE_UA, viewport: size, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/login");
    const google = page.getByRole("button", { name: "Google로 계속하기" });
    await expect(google).toBeVisible();
    // 버튼 안에 색이 있는 G(svg)가 있다.
    await expect(google.locator("svg")).toHaveCount(1);

    // 문서 전체도, 로그인 화면 안쪽도 보이는 높이를 넘지 않는다(스크롤이 없다).
    const scroll = await page.evaluate(() => {
      const main = document.querySelector("main") as HTMLElement;
      return {
        documentOverflow: document.documentElement.scrollHeight - window.innerHeight,
        mainOverflow: main.scrollHeight - main.clientHeight,
      };
    });
    expect(scroll.documentOverflow).toBeLessThanOrEqual(0);
    expect(scroll.mainOverflow).toBeLessThanOrEqual(0);
    await context.close();
  }
});

test("모바일 앱 로그인은 처음 온 사람도 브라우저에서 가입 화면을 거치지 않고, 앱 안에서 닉네임을 정한다", async ({ browser, email }) => {
  const verifier = Buffer.from("modori-mobile-signup-verifier-0001").toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  // 시스템 브라우저 창: 로그인만 하고, 닉네임 입력 없이 바로 앱으로 돌아가는 링크가 나온다.
  const system = await browser.newContext();
  const systemPage = await system.newPage();
  await systemPage.goto(`/desktop/login?challenge=${challenge}&from=app-android`);
  await systemPage.getByLabel("테스트 이메일").fill(email);
  await systemPage.getByRole("button", { name: "테스트 로그인" }).click();
  const open = systemPage.getByRole("link", { name: "모도리 앱 열기" });
  await expect(open).toBeVisible();
  await expect(systemPage.getByPlaceholder("닉네임")).toHaveCount(0);
  const code = new URL((await open.getAttribute("href")) ?? "").searchParams.get("code") ?? "";
  await system.close();

  // 앱 창: 코드를 바꿔 로그인하면 앱 안에서 닉네임 정하기가 열리고, 가입 경로는 앱의 꼬리표로 센다.
  const app = await browser.newContext({ userAgent: MOBILE_UA });
  const appPage = await app.newPage();
  await appPage.goto(`/api/desktop/exchange?code=${encodeURIComponent(code)}&verifier=${verifier}`);
  await expect(appPage.getByPlaceholder("닉네임")).toBeVisible();
  await appPage.getByPlaceholder("닉네임").fill(`앱안${RUN_TAG}`);
  await appPage.getByLabel("개인정보 수집·이용에 동의해요").check();
  await appPage.getByRole("button", { name: "시작하기" }).click();
  await expect(appPage).toHaveURL(/\/$/);
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).signupSource).toBe("app-android");
  await app.close();
});
