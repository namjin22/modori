import { expect, test, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, openTodo } from "./todo-helpers";

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
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
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

test("하루 할 일 상한(50개)에 닿으면 이유를 알리고 적은 글자를 남긴다", async ({ page }) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: Array.from({ length: 50 }, (_, order) => ({
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
  await input.fill("51번째 할 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText("하루에 50개까지");
  await expect(input).toHaveValue("51번째 할 일");
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(50);
});

test("되돌리기도 하루 상한을 넘기지 않고 이유를 알린다", async ({ page }) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: Array.from({ length: 50 }, (_, order) => ({
      userId: user.id,
      categoryId: category.id,
      content: `채운 일 ${order}`,
      date: todayKST(),
      order,
    })),
  });
  await page.reload();

  await openTodo(page, "채운 일 0");
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("status", { name: "알림" })).toContainText("할 일을 지웠어요");

  // 되돌리기 전에 다른 곳(다른 탭)에서 하나를 더 적어 다시 꽉 찼다.
  await prisma.todo.create({
    data: { userId: user.id, categoryId: category.id, content: "사이에 적은 일", date: todayKST(), order: 99 },
  });

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("status", { name: "알림" })).toContainText("하루에 50개까지");
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(50);
});

test("카테고리가 10개면 추가 폼 대신 이유를 보여준다", async ({ page }) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  // 가입할 때 생긴 Today's에 더해 9개를 채운다.
  await prisma.category.createMany({
    data: Array.from({ length: 9 }, (_, index) => ({
      userId: user.id,
      name: `채운 칸 ${index}`,
      color: "#22c55e",
      order: index + 1,
    })),
  });

  await page.goto("/categories");
  await expect(page.getByText("카테고리는 10개까지 만들 수 있어요")).toBeVisible();
  await expect(page.getByLabel("새 카테고리 이름")).toHaveCount(0);
});
