import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

// 테스트마다 계정을 따로 쓴다. 같은 이메일을 공유하면 병렬 실행에서
// 서로의 계정을 지워버린다.
const test = base.extend<{ email: string }>({
  // 인자 이름을 use로 두면 eslint가 React 훅으로 오해한다.
  email: async ({}, provide, testInfo) => {
    const email = `e2e-routine-${testInfo.testId}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill("루틴테스터");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

async function createDailyRoutine(page: Page, content: string) {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByLabel("루틴 내용").fill(content);
  await page.getByRole("radio", { name: "매일" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: content }),
  ).toBeVisible();
}

test.beforeEach(async ({ page, email }) => {
  await signInAndOnboard(page, email);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("매일 루틴은 오늘 화면을 열면 할 일로 만들어진다", async ({ page }) => {
  await createDailyRoutine(page, "아침 스트레칭");

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");

  await expect(page.getByText("아침 스트레칭")).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("미래 날짜에서는 예정으로만 보이고 체크하면 그때 만들어진다", async ({
  page,
}) => {
  await createDailyRoutine(page, "저녁 러닝");

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);

  await expect(page.getByText("예정된 루틴")).toBeVisible();
  await expect(page.getByText("저녁 러닝")).toBeVisible();

  await page.getByRole("button", { name: "미리 완료" }).click();

  await expect(page.getByText("예정된 루틴")).toBeHidden();
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
});

test("예정 루틴은 오늘 날짜로 조작해도 만들어지지 않는다", async ({ page }) => {
  await createDailyRoutine(page, "조작할 루틴");

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);
  const form = page.getByRole("button", { name: "미리 완료" }).locator("..");
  await form.locator('input[name="date"]').evaluate((input, value) => {
    (input as HTMLInputElement).value = value;
  }, formatKST(todayKST()));
  await form.getByRole("button", { name: "미리 완료" }).click();

  await expect(page.getByText("예정된 루틴")).toBeVisible();
  await expect(page.getByText("1개 중 1개 완료")).toBeHidden();
});

test("멈춘 루틴은 새 할 일을 만들지 않는다", async ({ page }) => {
  await createDailyRoutine(page, "멈출 루틴");

  await page.getByRole("button", { name: "잠시 멈춤" }).click();
  await expect(page.getByRole("button", { name: "다시 시작" })).toBeVisible();

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);

  await expect(page.getByText("멈출 루틴")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없다")).toBeVisible();
});

test("요일을 고르지 않은 매주 루틴은 만들어지지 않는다", async ({ page }) => {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByLabel("루틴 내용").fill("요일 없는 루틴");
  await page.getByRole("radio", { name: "매주" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();

  await expect(page.getByText("아직 루틴이 없다")).toBeVisible();
});

test("루틴을 지워도 이미 만들어진 할 일은 남는다", async ({ page }) => {
  await createDailyRoutine(page, "남을 할 일");

  // 오늘 화면을 실제로 열어야 루틴 할 일이 만들어진다. 이동을 기다린 뒤 확인한다.
  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("남을 할 일")).toBeVisible();

  // 삭제는 확인창을 띄운다. Playwright는 기본적으로 닫아버리므로 수락해준다.
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/settings/routines");
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 루틴이 없다")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("남을 할 일")).toBeVisible();
});
