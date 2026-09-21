import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-edit-${testInfo.testId}@modori.test`;
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

test("할 일 글자를 누르면 바로 고칠 수 있다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `수정${testInfo.testId.slice(-6)}`);

  await addTodo(page, "우유 사기");

  const row = page.getByRole("listitem").filter({ hasText: "우유 사기" });
  const input = row.getByLabel("할 일 내용 수정");

  // 접혀 있을 때는 DOM에 있어도 보이지 않는다.
  await expect(input).toBeHidden();

  await row.getByText("우유 사기").click();
  await expect(input).toBeVisible();

  await input.fill("우유랑 계란 사기");
  await row.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("우유랑 계란 사기")).toBeVisible();
});
