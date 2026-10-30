import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 화면 언어(2026-10-30 운영자 요청): 한국어가 기본이고 영어·일본어를 고른다. 로그인 화면과 마이페이지에서 바꾸고, 계정에도 저장한다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-locale-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

const localeCookie = async (page: Page) => (await page.context().cookies()).find((cookie) => cookie.name === "locale")?.value;

async function chooseLanguage(page: Page, name: string) {
  await page.locator("[data-language-select]").getByRole("button", { name, exact: true }).click();
}

test("로그인 화면에서 영어·일본어로 바꾸면 글자와 html lang이 바뀌고 기기에 기억된다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();

  await chooseLanguage(page, "English");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await localeCookie(page)).toBe("en");

  await chooseLanguage(page, "日本語");
  await expect(page.getByRole("button", { name: "Googleで続ける" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");

  // 새로 열어도 기억하고, 한국어로 돌아갈 길도 같은 이름으로 늘 보인다.
  await page.reload();
  await expect(page.getByRole("button", { name: "Googleで続ける" })).toBeVisible();
  await chooseLanguage(page, "한국어");
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
});

test("로그인 전에 고른 영어로 가입하면 가입 화면도 영어이고, 계정에 영어와 영어 이름의 기본 카테고리가 남는다", async ({ page, email }) => {
  await page.goto("/login");
  await chooseLanguage(page, "English");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await page.getByPlaceholder("Nickname").fill(`영어${RUN_TAG}`);
  await page.getByLabel("I agree to the collection and use of my personal information").check();
  await page.getByRole("button", { name: "Get started" }).click();

  // 홈은 영어로 그려지고 아래 탭도 영어다.
  await expect(page.getByRole("link", { name: "Feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My page" })).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { categories: true } });
  expect(user.locale).toBe("en");
  expect(user.categories.map((category) => category.name)).toEqual(["Today"]);
});

test("마이페이지에서 언어를 바꾸면 계정에 저장되고 화면이 바뀐다", async ({ page, email }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`언어${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByRole("link", { name: "마이페이지" })).toBeVisible();
  const saved = async () => (await prisma.user.findUniqueOrThrow({ where: { email } })).locale;
  expect(await saved()).toBe("ko");

  await page.goto("/settings");
  await chooseLanguage(page, "日本語");
  await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
  await expect.poll(saved).toBe("ja");
  await expect(page.getByRole("link", { name: "フィード" })).toBeVisible();

  // 날짜도 일본어로 적힌다(오늘 화면의 제목: 10月30日 金曜日 꼴).
  await page.getByRole("link", { name: "フィード" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/\d+月\d+日 .曜日/);

  await page.goto("/settings");
  await chooseLanguage(page, "English");
  await expect(page.getByRole("heading", { name: "My page" })).toBeVisible();
  await expect.poll(saved).toBe("en");
});

test("다른 기기처럼 쿠키가 없으면 계정에 저장된 언어로 맞춰진다", async ({ page, email }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`기기${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByRole("link", { name: "마이페이지" })).toBeVisible();

  // 계정만 일본어로 두고, 이 기기에 고른 적이 없는 상태(쿠키 없음)를 만든다.
  await prisma.user.update({ where: { email }, data: { locale: "ja" } });
  await page.context().clearCookies({ name: "locale" });
  await page.reload();
  await expect(page.getByRole("link", { name: "マイページ" })).toBeVisible({ timeout: 15_000 });
  expect(await localeCookie(page)).toBe("ja");
});

test("방침과 약관은 한국어 원본이고, 영어 화면에는 그 사실만 알린다", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("note")).toHaveCount(0);

  await page.goto("/login");
  await chooseLanguage(page, "English");
  // 바꾼 언어가 쿠키에 적힌 뒤(화면이 바뀐 뒤)에 옮겨야 한다.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("note")).toContainText("Korean");
  await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible();
});
