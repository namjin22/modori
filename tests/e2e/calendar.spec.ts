import { expect, test, type Page } from "@playwright/test";

import { formatKST, formatMonthKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const TEST_EMAIL = "e2e-calendar@modori.test";

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill("캘린더테스터");
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

  await page.getByLabel("할 일 내용").fill("캘린더에 남길 할 일");
  await page.getByRole("button", { name: "추가" }).click();

  await expect(
    page.getByRole("link", { name: `${dayNumber}일, 완료 없음` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `${dayNumber}일, 완료 있음` }),
  ).toBeVisible();
  await expect(page.getByText("이번 달 완료 1개")).toBeVisible();
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
