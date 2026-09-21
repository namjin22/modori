import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-account-${testInfo.testId}@modori.test`;
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

test("닉네임을 그대로 적어야 계정이 지워진다", async ({ page, email }, testInfo) => {
  const nickname = `탈퇴${testInfo.testId.slice(-6)}`;
  await signInAndOnboard(page, email, nickname);

  await addTodo(page, "지워질 할 일");
  await expect(page.getByText("지워질 할 일")).toBeVisible();

  const before = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(await prisma.todo.count({ where: { userId: before.id } })).toBeGreaterThan(0);
  expect(await prisma.category.count({ where: { userId: before.id } })).toBeGreaterThan(0);

  await page.goto("/settings");
  await page.getByRole("link", { name: "계정 지우기" }).click();
  await expect(page.getByRole("heading", { name: "계정 지우기" })).toBeVisible();

  // 무엇이 사라지는지 숫자로 알려줘야 한다.
  await expect(page.getByText("할 일")).toBeVisible();

  // 닉네임이 다르면 지우지 않는다.
  await page.getByRole("textbox").fill("아무거나");
  await page.getByRole("button", { name: "계정 지우기" }).click();
  await expect(
    page.getByText("닉네임이 달라요. 지금 쓰는 닉네임을 그대로 입력해주세요."),
  ).toBeVisible();
  expect(await prisma.user.count({ where: { email } })).toBe(1);

  // 그대로 적으면 지워지고 로그인 화면으로 나간다.
  await page.getByRole("textbox").fill(nickname);
  await page.getByRole("button", { name: "계정 지우기" }).click();
  await expect(page).toHaveURL(/\/login$/);

  expect(await prisma.user.count({ where: { email } })).toBe(0);

  // 딸린 기록도 같이 사라져야 한다. 사용자만 지우고 남으면 주인 없는 데이터가 된다.
  expect(await prisma.todo.count({ where: { userId: before.id } })).toBe(0);
  expect(await prisma.category.count({ where: { userId: before.id } })).toBe(0);
});
