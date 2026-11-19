import { expect, test as base } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 오류 화면(2026-11-19 운영자 요청): 없는 주소는 HTTP 404와 함께 큰 "404"와 안내, 오늘 화면으로 가는 단추를 보인다.
// 앱 안의 500 화면은 일부러 오류를 내는 길이 없어 자동 시험으로 보지 못했다(deploy/error-worker.mjs의 화면은 tests/unit/error-worker.test.ts).
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-errpage-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("없는 주소는 404 상태와 큰 404 번호, 안내, 오늘 화면으로 가는 단추를 보인다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`오${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  const response = await page.goto("/no-such-page-for-error-screen");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "없는 주소예요", exact: true })).toBeVisible();
  await expect(page.getByText("주소가 바뀌었거나 지워진 화면이에요.")).toBeVisible();

  await page.getByRole("link", { name: "오늘 화면으로" }).click();
  await expect(homeReady(page)).toBeVisible();
});
