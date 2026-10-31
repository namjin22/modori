import { expect, test as base } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 설정 페이지(2026-10-31 운영자 요청): 마이페이지에 한꺼번에 있던 화면·알림·친구·시간대 설정을 한 페이지로 모았다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-prefs-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("마이페이지에는 프로필과 설정으로 가는 줄만 있고, 설정에 화면·알림·친구·시간대가 모여 있다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`옵션${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(page.getByRole("link", { name: /프로필 수정/ })).toBeVisible();
  // 설정 항목은 마이페이지에 없다.
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);

  await page.getByRole("link", { name: /^설정/ }).click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await expect(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
  for (const name of ["화면", "알림", "친구", "시간대"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("checkbox", { name: /친구가 할 일을 끝내면 알림/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /친구 추천에 나오기/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /차단한 사용자/ })).toBeVisible();

  // 아래 탭은 마이페이지가 고른 상태로 남고, 되돌아가는 길이 있다.
  await expect(page.getByRole("link", { name: "마이페이지", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "마이페이지로" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
