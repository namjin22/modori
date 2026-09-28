import { expect, test, type Page } from "@playwright/test";

import { formatKST, formatMonthKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-calendar-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`캘린더${RUN_TAG}`);
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

test("완료한 할 일이 있는 날에 표시가 생긴다", async ({ page }) => {
  const dayNumber = todayKST().getUTCDate();

  await addTodo(page, "캘린더에 남길 할 일");

  await expect(
    page.getByRole("link", { name: `${dayNumber}일, 완료 없음` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${dayNumber}일, 완료 있음` }),
  ).toBeVisible();
  await expect(page.getByText("이번 달 완료 1개")).toBeVisible();
});

test("할 일을 끝낼 때마다 그날 표시가 카테고리 색으로 한 칸씩 찬다", async ({ page }) => {
  const today = todayKST();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });

  await addTodo(page, "첫째 일");
  await addTodo(page, "둘째 일");

  const monthCell = page.getByRole("link", { name: new RegExp(`^${today.getUTCDate()}일, 완료`) });
  const weekCell = page.getByRole("link", {
    name: `${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`,
  });
  const filled = (cell: typeof monthCell) => cell.locator(`svg rect[fill="${category.color}"]`);

  // 할 일은 있지만 아직 아무것도 끝내지 않았다. 모양만 있고 비어 있다.
  await expect(monthCell.locator("svg")).toHaveCount(1);
  await expect(filled(monthCell)).toHaveCount(0);

  await page.getByRole("button", { name: "완료", exact: true }).first().click();
  await expect(filled(monthCell)).toHaveCount(1);

  await page.getByRole("button", { name: "완료", exact: true }).first().click();
  await expect(filled(monthCell)).toHaveCount(2);

  // 폰에서는 달력 대신 주간 줄이 보인다. 거기서도 같이 찬다.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(filled(weekCell)).toHaveCount(2);
});

test("이전 달과 다음 달로 넘어간다", async ({ page }) => {
  await page.goto("/");

  const thisMonth = formatMonthKST(todayKST()).split("-");
  const heading = `${Number(thisMonth[0])}년 ${Number(thisMonth[1])}월`;
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();

  await page.getByLabel("다음 달").click();
  await expect(page.getByRole("heading", { name: heading })).toBeHidden();

  await page.getByLabel("이전 달").click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
});

test("날짜를 누르면 그 날의 할 일 화면으로 간다", async ({ page }) => {
  const today = todayKST();

  await page.goto("/");
  await page
    .getByRole("link", { name: `${today.getUTCDate()}일, 완료 없음` })
    .click();

  await expect(page).toHaveURL(`/?date=${formatKST(today)}`);
});
