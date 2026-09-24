import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, addTodo, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-offline-${RUN_TAG}@modori.test`;
const FAILED = "저장하지 못했어요. 연결을 확인하고 다시 해주세요.";

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`연결${RUN_TAG}`);
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

test("연결이 끊긴 채 할 일을 적으면 화면과 적던 글자가 남는다", async ({ page, context }) => {
  await page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` }).click();
  const input = page.getByLabel(`${FIRST_CATEGORY} 할 일`);

  await context.setOffline(true);
  await input.fill("지하철에서 적은 할 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(input).toHaveValue("지하철에서 적은 할 일");

  // 다시 연결되면 그대로 Enter만 누르면 된다.
  await context.setOffline(false);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "지하철에서 적은 할 일", exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
});

test("연결이 끊긴 채 체크하면 체크가 돌아가고 알림이 뜬다", async ({ page, context }) => {
  await addTodo(page, "체크할 일");

  await context.setOffline(true);
  await page.getByRole("button", { name: "완료", exact: true }).click();

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(page.getByRole("button", { name: "완료", exact: true })).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("연결이 끊긴 채 할 일을 고치면 창과 고친 글자가 남는다", async ({ page, context }) => {
  await addTodo(page, "고칠 일");
  await openTodo(page, "고칠 일");
  const input = page.getByLabel("할 일 내용 수정");

  await context.setOffline(true);
  await input.fill("고친 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(input).toHaveValue("고친 일");
});
