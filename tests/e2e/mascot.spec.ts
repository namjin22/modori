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

  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(banner).toBeVisible();

  // 하나라도 남으면 사라진다.
  await page.getByRole("button", { name: "완료 취소" }).click();
  await expect(banner).toBeHidden();
});
