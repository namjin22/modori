import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const TEST_EMAIL = "e2e-todo@modori.test";

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill("할일테스터");
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

test("할 일을 추가하면 목록에 보인다", async ({ page }) => {
  await page.getByLabel("할 일 내용").fill("자료구조 과제");
  await page.getByRole("button", { name: "추가" }).click();

  await expect(page.getByText("자료구조 과제")).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("완료 표시를 하면 완료 개수가 올라간다", async ({ page }) => {
  await page.getByLabel("할 일 내용").fill("러닝 3km");
  await page.getByRole("button", { name: "추가" }).click();

  await page.getByRole("button", { name: "완료", exact: true }).click();

  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();
});

test("삭제하면 목록에서 사라진다", async ({ page }) => {
  await page.getByLabel("할 일 내용").fill("지울 할 일");
  await page.getByRole("button", { name: "추가" }).click();

  // 삭제는 확인창을 띄운다. Playwright는 기본적으로 닫아버리므로 수락해준다.
  page.on("dialog", (dialog) => dialog.accept());

  await page.getByText("수정").click();
  await page.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByText("지울 할 일")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없다")).toBeVisible();
});

test("할 일은 날짜별로 따로 쌓인다", async ({ page }) => {
  await page.getByLabel("할 일 내용").fill("오늘의 할 일");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("오늘의 할 일")).toBeVisible();

  await page.getByLabel("다음 날").click();

  await expect(page.getByText("오늘의 할 일")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없다")).toBeVisible();

  await page.getByLabel("이전 날").click();
  await expect(page.getByText("오늘의 할 일")).toBeVisible();
});

test("기본 카테고리가 만들어지고 새 카테고리를 추가할 수 있다", async ({
  page,
}) => {
  await page.getByRole("link", { name: "카테고리", exact: true }).click();

  await expect(page.getByText("공부")).toBeVisible();
  await expect(page.getByText("운동")).toBeVisible();
  await expect(page.getByText("생활")).toBeVisible();

  await page.getByLabel("새 카테고리 이름").fill("동아리");
  await page.getByRole("button", { name: "추가" }).click();

  await expect(page.getByText("동아리")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("카테고리", { exact: true })).toContainText(
    "동아리",
  );
});

test("보관한 카테고리는 할 일 추가 목록에서 빠진다", async ({ page }) => {
  await page.goto("/settings/categories");

  await page
    .locator("li", { hasText: "운동" })
    .getByText("수정")
    .click();
  await page.getByRole("button", { name: "보관하기" }).click();

  await expect(page.getByText("보관함")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("카테고리", { exact: true })).not.toContainText(
    "운동",
  );
});
