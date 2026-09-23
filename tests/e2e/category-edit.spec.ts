import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { FIRST_CATEGORY, homeReady, openCategory } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-catedit-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("색을 고르면 저장 버튼 없이 바로 저장된다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `색저${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/categories");
  await openCategory(page, FIRST_CATEGORY);
  // 새 카테고리 폼에도 같은 견본이 있다. 떠 있는 창 안에서 고른다.
  await page.getByRole("dialog").getByLabel("초록").check();
  await expect(page.getByText("저장했어요")).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({
    where: { userId: user.id },
  });
  expect(category.color).toBe("#22c55e");
});

test("이름을 비운 채 색을 바꾸면 저장하지 않고 이유를 알려준다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `빈이${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/categories");
  await openCategory(page, FIRST_CATEGORY);
  await page.getByLabel("카테고리 이름", { exact: true }).fill("");
  await page.getByRole("dialog").getByLabel("빨강").check();

  // "저장했어요"라고 하면서 실제로는 아무것도 바뀌지 않던 것을 막는다.
  await expect(page.getByText("이름을 적어주세요")).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({
    where: { userId: user.id },
  });
  expect(category.name).toBe(FIRST_CATEGORY);
  expect(category.color).not.toBe("#ef4444");
});
