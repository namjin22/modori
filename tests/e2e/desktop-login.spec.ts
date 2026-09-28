import { createHash, randomBytes } from "node:crypto";

import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 데스크톱 앱 로그인(lib/desktop-login.ts)을 앱 없이 따라간다. 앱이 하는 일(verifier 만들기,
// modori:// 받기, 교환 주소 열기)은 테스트가 대신하고, 브라우저 쪽은 사람이 하듯 누른다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-desktop-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** 앱이 연 브라우저에서 로그인(처음이면 가입)을 마치고 앱으로 넘길 코드를 받는다. */
async function codeFromBrowser(page: Page, email: string, nickname: string, challenge: string) {
  await page.goto(`/desktop/login?challenge=${challenge}`);
  // 로그인 전이라 로그인 화면으로 갔다가, 가입을 마치면 이 화면으로 돌아온다.
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  const open = page.getByRole("link", { name: "모도리 앱 열기" });
  await expect(open).toBeVisible();
  const href = (await open.getAttribute("href")) ?? "";
  expect(href).toMatch(/^modori:\/\/login\?code=/);
  return new URL(href).searchParams.get("code") ?? "";
}

test("브라우저에서 받은 코드와 verifier로 앱 창이 로그인된다", async ({ page, browser, email }, testInfo) => {
  const { verifier, challenge } = pkce();
  const code = await codeFromBrowser(page, email, `앱${testInfo.testId.slice(-6)}${RUN_TAG}`, challenge);

  // 앱 창: 쿠키가 하나도 없는 새 창에서 교환 주소를 연다.
  const app = await browser.newContext();
  const appPage = await app.newPage();
  await appPage.goto(`/api/desktop/exchange?code=${encodeURIComponent(code)}&verifier=${verifier}`);
  await expect(homeReady(appPage)).toBeVisible();

  // 같은 코드는 두 번 쓸 수 없다.
  const again = await browser.newContext();
  const againPage = await again.newPage();
  await againPage.goto(`/api/desktop/exchange?code=${encodeURIComponent(code)}&verifier=${verifier}`);
  await expect(againPage.getByRole("alert").filter({ hasText: "앱 로그인 시간이 지났어요" })).toBeVisible();
  await app.close();
  await again.close();
});

test("verifier가 다르면 코드를 가로채도 로그인되지 않는다", async ({ page, browser, email }, testInfo) => {
  const { challenge } = pkce();
  const code = await codeFromBrowser(page, email, `훔침${testInfo.testId.slice(-6)}${RUN_TAG}`, challenge);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`/api/desktop/exchange?code=${encodeURIComponent(code)}&verifier=${pkce().verifier}`);
  await expect(otherPage).toHaveURL(/\/login\?error=DesktopLogin$/);
  await expect(otherPage.getByRole("alert").filter({ hasText: "앱 로그인 시간이 지났어요" })).toBeVisible();
  // 틀린 시도에 코드는 버려진다.
  expect(await prisma.desktopLogin.count({ where: { user: { email } } })).toBe(0);
  await other.close();
});

test("데스크톱 앱 창의 로그인 버튼은 평소 브라우저로 여는 링크다", async ({ browser }) => {
  const desktop = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 ModoriDesktop/1.0.0",
  });
  const page = await desktop.newPage();
  await page.goto("/login");
  // 버튼은 웹과 같지만, 앱이 가로채 평소 브라우저에서 여는 링크다.
  await expect(page.getByRole("link", { name: "Google로 계속하기" })).toHaveAttribute("href", "/desktop/start?provider=google");
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toHaveCount(0);
  await desktop.close();

  // 보통 브라우저는 예전 그대로다.
  const web = await browser.newContext();
  const webPage = await web.newPage();
  await webPage.goto("/login");
  await expect(webPage.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
  await expect(webPage.getByRole("link", { name: "Google로 계속하기" })).toHaveCount(0);
  await web.close();
});

test("마이페이지에 Windows 앱 받기가 있고, 앱 안에서는 숨긴다", async ({ page, browser, email }, testInfo) => {
  const signUp = async (target: Page, nickname: string) => {
    await target.goto("/login");
    await target.getByLabel("테스트 이메일").fill(email);
    await target.getByRole("button", { name: "테스트 로그인" }).click();
    const input = target.getByPlaceholder("닉네임");
    await expect(input.or(homeReady(target)).first()).toBeVisible();
    if (await input.isVisible()) {
      await input.fill(nickname);
      await target.getByLabel("개인정보 수집·이용에 동의해요").check();
      await target.getByRole("button", { name: "시작하기" }).click();
      await expect(homeReady(target)).toBeVisible();
    }
  };
  await signUp(page, `받기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: /Windows 앱 받기/ })).toHaveAttribute(
    "href",
    "https://github.com/namjin22/modori/releases/latest/download/Modori-Setup.exe",
  );

  const desktop = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/150 Safari/537.36 ModoriDesktop/1.0.0",
  });
  const appPage = await desktop.newPage();
  await signUp(appPage, "쓰이지 않음");
  await appPage.goto("/settings");
  await expect(appPage.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(appPage.getByRole("link", { name: /Windows 앱 받기/ })).toHaveCount(0);
  await desktop.close();
});
