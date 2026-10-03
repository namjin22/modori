import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-checkorder-${RUN_TAG}@modori.test`;

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`순서${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.beforeEach(async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await signInAndOnboard(page);
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

test("체크한 할 일은 서버 응답을 기다리지 않고 바로 끝낸 일 쪽으로 내려간다", async ({ page }) => {
  await addTodo(page, "먼저 쓴 일");
  await addTodo(page, "나중에 쓴 일");
  const rows = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^(완료|완료 취소)$/ }) });
  await expect(rows.first()).toContainText("먼저 쓴 일");

  // 서버가 느린 폰 네트워크를 흉내 낸다. 응답이 오기 전에 줄이 내려가 있어야 한다.
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await rows.first().getByRole("button", { name: "완료", exact: true }).click();

  await expect(rows.first()).toContainText("나중에 쓴 일", { timeout: 1000 });
  await expect(rows.last()).toContainText("먼저 쓴 일");

  // 응답이 온 뒤에도 같은 자리다.
  await page.unroute("**/*");
  await expect(page.getByText("2개 중 1개 완료")).toBeVisible();
  await expect(rows.first()).toContainText("나중에 쓴 일");
  await expect(rows.last()).toContainText("먼저 쓴 일");
});
