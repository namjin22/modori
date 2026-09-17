import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-layout-${testInfo.testId}@modori.test`;
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
  await expect(page.getByLabel("할 일 내용", { exact: true })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("탭은 피드, 소셜, 설정 셋이고 카테고리와 루틴은 피드에 속한다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `탭${testInfo.testId.slice(-6)}`);

  const tabs = page.getByRole("navigation").last().getByRole("link");
  await expect(tabs).toHaveText(["피드", "소셜", "설정"]);

  // 넓은 화면에서는 달력과 목록이 한 화면에 같이 있다.
  await expect(page.getByRole("link", { name: /일, 완료 (있음|없음)$/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "루틴", exact: true }).click();
  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByRole("link", { name: "피드", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // 설정에는 더 이상 카테고리·루틴이 없고, 테마는 라이트와 다크뿐이다.
  await page.getByRole("link", { name: "설정", exact: true }).click();
  await expect(page.getByRole("link", { name: /카테고리 관리|루틴 관리/ })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveText(["라이트", "다크"]);

  await page.getByRole("radio", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("radio", { name: "다크" })).toHaveAttribute("aria-checked", "true");
});

test("예전 주소로 들어와도 옮긴 화면으로 간다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `옛${testInfo.testId.slice(-6)}`);

  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings/categories");
  await expect(page).toHaveURL(/\/categories$/);
  await page.goto("/settings/routines");
  await expect(page).toHaveURL(/\/routines$/);
});

test.describe("좁은 화면", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("달력은 눌렀을 때만 펼친다", async ({ page, email }, testInfo) => {
    await signInAndOnboard(page, email, `좁${testInfo.testId.slice(-6)}`);

    const monthDay = page.getByRole("link", { name: /일, 완료 (있음|없음)$/ }).first();
    await expect(monthDay).toBeHidden();
    await expect(page.getByRole("navigation", { name: "주간 날짜" })).toBeVisible();

    await page.getByRole("link", { name: "달력 펼치기" }).click();
    await expect(monthDay).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주간 날짜" })).toBeHidden();

    await page.getByRole("link", { name: "달력 접기" }).click();
    await expect(monthDay).toBeHidden();
  });
});
