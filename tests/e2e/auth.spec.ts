import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 온보딩은 닉네임이 비어 있을 때만 뜨므로, 매 테스트마다 계정을 지우고 시작한다.
// 실제 사람이 쓰지 않는 도메인을 쓴다.
const TEST_EMAIL = `e2e-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

test.beforeEach(removeTestUser);
test.afterAll(async () => {
  await removeTestUser();
  await prisma.$disconnect();
});

test("로그인하지 않으면 로그인 화면으로 보낸다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "모도리" })).toBeVisible();
});

test("최초 로그인이면 닉네임 온보딩을 거쳐 홈에 도착한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page).toHaveURL("/");
  await expect(homeReady(page)).toBeVisible();
});

test("닉네임이 이미 있으면 온보딩을 건너뛴다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/onboarding");

  await expect(page).toHaveURL("/");
});

test("빈 닉네임은 통과하지 못한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  await page.getByPlaceholder("닉네임").fill("   ");
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page.getByText("닉네임은 1~20자로 적어주세요.")).toBeVisible();
});

test("로그아웃하면 다시 로그인 화면으로 간다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByRole("button", { name: "시작하기" }).click();

  await page.getByRole("link", { name: "설정" }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();

  await expect(page).toHaveURL(/\/login$/);
});
