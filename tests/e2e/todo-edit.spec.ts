import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-edit-${testInfo.testId}-${RUN_TAG}@modori.test`;
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
  await signInAndOnboard(page, email, `수정${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await addTodo(page, "우유 사기");

  // 창이 열리기 전에는 고치는 칸이 보이지 않는다.
  await expect(page.getByLabel("할 일 내용 수정")).toBeHidden();

  await openTodo(page, "우유 사기");

  const input = page.getByLabel("할 일 내용 수정");
  await input.fill("우유랑 계란 사기");
  // 저장 버튼은 없다. Enter로 저장한다.
  await input.press("Enter");

  await expect(page.getByText("우유랑 계란 사기")).toBeVisible();
});

test("할 일 창을 열면 입력칸에 커서가 글 끝에 있어 바로 이어 쓸 수 있다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `커서${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "우유 사기");

  await openTodo(page, "우유 사기");
  const input = page.getByLabel("할 일 내용 수정");
  await expect(input).toBeFocused();

  // 칸을 누르지 않고 바로 친다.
  await page.keyboard.type(" 두 개");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "우유 사기 두 개", exact: true })).toBeVisible();
});
