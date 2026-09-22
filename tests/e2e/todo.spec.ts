import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addCategory, addTodo, FIRST_CATEGORY, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-todo-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`할일${RUN_TAG}`);
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
  await addTodo(page, "자료구조 과제");

  await expect(page.getByText("자료구조 과제")).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("완료 표시를 하면 완료 개수가 올라간다", async ({ page }) => {
  await addTodo(page, "러닝 3km");

  await page.getByRole("button", { name: "완료", exact: true }).click();

  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();
});

test("할 일을 연달아 완료해도 완료 개수가 즉시 맞는다", async ({ page }) => {
  const contents = ["첫 번째 일", "두 번째 일"];
  for (const content of contents) {
    await addTodo(page, content);
    await expect(page.getByRole("listitem").filter({ hasText: content })).toBeVisible();
  }

  // 체크박스는 각 할 일 줄 안에서 찾는다. "완료"라는 이름으로 한꺼번에 붙잡아 두면,
  // 첫 번째를 누르는 순간 이름이 "완료 취소"로 바뀌어 목록에서 빠지고
  // 두 번째 클릭이 엉뚱한 자리를 가리킨다.
  // 서버 응답을 기다리지 않고 바로 다음 것을 누른다. 첫 번째 저장이 끝나기 전에
  // 두 번째를 누르는 상황이 이 테스트가 잡으려는 것이다.
  for (const content of contents) {
    await page
      .getByRole("listitem")
      .filter({ hasText: content })
      .getByRole("button", { name: "완료", exact: true })
      .click();
  }

  await expect(page.getByText("2개 중 2개 완료")).toBeVisible();
});

test("삭제하면 목록에서 사라진다", async ({ page }) => {
  await addTodo(page, "지울 할 일");

  await openTodo(page, "지울 할 일");
  await page.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByText("지울 할 일")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없어요")).toBeVisible();
});

test("할 일은 날짜별로 따로 쌓인다", async ({ page }) => {
  await addTodo(page, "오늘의 할 일");
  await expect(page.getByText("오늘의 할 일")).toBeVisible();

  await page.getByLabel("다음 날").click();

  await expect(page.getByText("오늘의 할 일")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없어요")).toBeVisible();

  await page.getByLabel("이전 날").click();
  await expect(page.getByText("오늘의 할 일")).toBeVisible();
});

test("기본 카테고리가 만들어지고 새 카테고리를 추가할 수 있다", async ({
  page,
}) => {
  await page.getByRole("link", { name: "카테고리", exact: true }).click();
  // 피드 화면에도 카테고리 칩이 있어서, 화면이 넘어간 뒤에 찾아야 한다.
  await expect(page).toHaveURL(/\/categories$/);

  // 처음에는 하나만 만들어진다. 쓰지도 않는 칸으로 화면을 채우지 않는다.
  // 아래 탭도 목록이라 "수정"이 붙은 카테고리 줄만 센다.
  await expect(page.getByText(FIRST_CATEGORY, { exact: true })).toBeVisible();
  await expect(page.locator("li", { hasText: "수정" })).toHaveCount(1);

  await page.getByLabel("새 카테고리 이름").fill("동아리");
  await page.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("동아리")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "동아리에 할 일 쓰기" }),
  ).toBeVisible();
});

test("보관한 카테고리는 할 일 추가 목록에서 빠진다", async ({ page }) => {
  await addCategory(page, "운동");

  await page
    .locator("li", { hasText: "운동" })
    .getByText("수정")
    .click();
  await page.getByRole("button", { name: "보관하기" }).click();

  await expect(page.getByText("보관함")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "운동에 할 일 쓰기" }),
  ).toHaveCount(0);
});
