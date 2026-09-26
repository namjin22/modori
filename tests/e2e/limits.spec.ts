import { expect, test, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-limits-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`상한${RUN_TAG}`);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.beforeEach(async ({ page }) => {
  await removeTestUser();
  await signInAndOnboard(page);
});

test.afterAll(async () => {
  await removeTestUser();
  await prisma.$disconnect();
});

test("하루 할 일 상한에 닿으면 이유를 알리고 적은 글자를 남긴다", async ({ page }) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: Array.from({ length: 100 }, (_, order) => ({
      userId: user.id,
      categoryId: category.id,
      content: `채운 일 ${order}`,
      date: todayKST(),
      order,
    })),
  });
  await page.reload();

  await page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` }).click();
  const input = page.getByLabel(`${FIRST_CATEGORY} 할 일`);
  await input.fill("101번째 할 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText("하루에 100개까지");
  await expect(input).toHaveValue("101번째 할 일");
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(100);
});
