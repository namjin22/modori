import { expect, test as base } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-stale-${testInfo.testId}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

// 세션은 남아 있는데 계정 행이 사라진 경우. 로그인 화면과 탭 화면이 서로를
// 튕겨내며 ERR_TOO_MANY_REDIRECTS로 멈춘 적이 있다.
test("계정이 사라진 세션이면 로그인 화면에 멈춘다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`유령${testInfo.testId.slice(-6)}`);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await prisma.user.deleteMany({ where: { email } });

  for (const path of ["/settings", "/", "/onboarding", "/login"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
  }

  // 다시 로그인하면 새 계정으로 온보딩부터 시작한다.
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await expect(page.getByPlaceholder("닉네임")).toBeVisible();
});
