import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-profile-${testInfo.testId}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill("처음닉네임");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByLabel("할 일 내용")).toBeVisible();
}

test.beforeEach(async ({ page, email }) => {
  await signInAndOnboard(page, email);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("닉네임과 이모지를 바꿀 수 있다", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /프로필 수정/ }).click();

  await page.getByLabel("닉네임").fill("바꾼닉네임");
  await page.getByRole("button", { name: "🔥 고르기" }).click();
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("저장했어요.")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("바꾼닉네임")).toBeVisible();
  await expect(page.getByText("🔥")).toBeVisible();
});

test("이모지가 아닌 값은 거절하고 이유를 알려준다", async ({ page }) => {
  await page.goto("/settings/profile");

  await page.getByLabel("프로필 이모지").fill("안녕");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("프로필은 이모지 한 개로 정해주세요.")).toBeVisible();
});

test("빈 닉네임은 거절한다", async ({ page }) => {
  await page.goto("/settings/profile");

  await page.getByLabel("닉네임").fill("   ");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("닉네임을 입력해주세요.")).toBeVisible();
});

test("요일을 고르지 않은 매주 루틴은 이유를 알려준다", async ({ page }) => {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();

  await page.getByLabel("루틴 내용").fill("요일 없는 루틴");
  await page.getByRole("radio", { name: "매주" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();

  await expect(
    page.getByText("반복할 요일을 하나 이상 골라주세요."),
  ).toBeVisible();
});

test("없는 주소는 안내 화면을 보여준다", async ({ page }) => {
  await page.goto("/이런주소는없다");

  await expect(page.getByText("없는 주소예요")).toBeVisible();
  await expect(page.getByRole("link", { name: "오늘 화면으로" })).toBeVisible();
});
