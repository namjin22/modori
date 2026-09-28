import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-dori-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("그날 할 일을 다 끝내면 도리가 축하한다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `도리${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const banner = page.getByText("할 일을 다 끝냈어요");
  await addTodo(page, "물 마시기");
  await expect(page.getByRole("listitem").filter({ hasText: "물 마시기" })).toBeVisible();
  await expect(banner).toBeHidden();

  // 진행률 옆 도리는 시작 전 인사 표정이다.
  const progressRow = page.getByText("1개 중 0개 완료").locator("xpath=..");
  await expect(progressRow.locator("svg")).toHaveCount(1);

  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(banner).toBeVisible();
  // 축하 배너에 도리가 있으니 진행률 옆 도리는 빠진다(둘이 같이 있으면 어색하다).
  await expect(page.getByText("1개 중 1개 완료").locator("xpath=..").locator("svg")).toHaveCount(0);

  // 하나라도 남으면 사라진다.
  await page.getByRole("button", { name: "완료 취소" }).click();
  await expect(banner).toBeHidden();
});
