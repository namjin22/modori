import { expect, test as base, type Page } from "@playwright/test";

import { formatMonthKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { addTodo, homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-stats-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("기록 화면이 이번 달 성취를 보여준다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `기록${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await addTodo(page, "수학 과제");
  await addTodo(page, "영어 단어");
  await page
    .getByRole("listitem")
    .filter({ hasText: "수학 과제" })
    .getByRole("button", { name: "완료", exact: true })
    .click();
  await expect(page.getByText("2개 중 1개 완료")).toBeVisible();

  await page.getByRole("link", { name: "기록", exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);

  // 둘 중 하나를 끝냈으니 50%, 오늘 하나라도 했으니 이어온 날은 1일이다.
  await expect(page.getByText("1개", { exact: true })).toBeVisible();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await expect(page.getByText("1일", { exact: true })).toBeVisible();

  // 카테고리 막대는 읽어주는 이름으로 값을 확인한다.
  await expect(
    page.getByRole("img", { name: /2개 중 1개 완료/ }),
  ).toBeVisible();
});

test("적어둔 것이 없는 달은 비어 있다고 알려준다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `빈달${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/stats");
  await page.getByRole("link", { name: "이전 달" }).click();

  await expect(page.getByText("이 달에는 적어둔 할 일이 없어요")).toBeVisible();
  // 지난 달에서는 다음 달로 돌아갈 수 있다.
  await page.getByRole("link", { name: "다음 달" }).click();
  await expect(page).toHaveURL(
    new RegExp(`month=${formatMonthKST(todayKST())}$`),
  );
});

test("주소의 달이 엉터리여도 화면은 열린다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `엉터${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/stats?month=이런달은없다");

  await expect(page.getByRole("heading", { name: "기록" })).toBeVisible();
});
