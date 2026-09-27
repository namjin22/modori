import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-return-${RUN_TAG}@modori.test`;

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

async function mockLogin(page: import("@playwright/test").Page) {
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
}

test("로그인 전에 연 화면으로, 처음 가입해도 닉네임을 정한 뒤 돌아간다", async ({ page }) => {
  await page.goto("/stats?month=2026-01");
  await expect(page).toHaveURL(/\/login\?next=/);

  await mockLogin(page);
  await expect(page).toHaveURL(/\/onboarding\?next=/);
  await page.getByPlaceholder("닉네임").fill(`복귀${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page).toHaveURL(/\/stats\?month=2026-01$/);
  await expect(page.getByText("2026년 1월")).toBeVisible();
});

test("이미 가입한 사람은 로그인하면 바로 그 화면으로 간다", async ({ page, context }) => {
  await page.goto("/login");
  await mockLogin(page);
  await page.getByPlaceholder("닉네임").fill(`복귀${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  await context.clearCookies();

  await page.goto("/routines");
  await expect(page).toHaveURL(/\/login\?next=%2Froutines$/);
  await mockLogin(page);
  await expect(page).toHaveURL(/\/routines$/);
});

test("다른 사이트로 보내는 next는 무시하고 홈으로 간다", async ({ page }) => {
  await page.goto("/login");
  await mockLogin(page);
  await page.getByPlaceholder("닉네임").fill(`복귀${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/login?next=//evil.example/steal");
  await mockLogin(page);
  await expect(homeReady(page)).toBeVisible();
  expect(new URL(page.url()).host).toBe("localhost:3101");
});
