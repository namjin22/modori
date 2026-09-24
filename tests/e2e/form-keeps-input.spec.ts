import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-form-keep-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`폼${RUN_TAG}`);
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

test("루틴을 서버가 거절해도 적은 내용이 남고, 만들고 나면 비워진다", async ({ page }) => {
  await page.goto("/routines");
  await page.getByText("루틴 만들기").click();
  const content = page.getByLabel("루틴 내용");
  await content.fill("영어 단어 30개");
  await page.getByRole("radio", { name: "매주" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();

  await expect(page.getByText("반복할 요일을 하나 이상 골라주세요.")).toBeVisible();
  await expect(content).toHaveValue("영어 단어 30개");

  // 요일만 고르고 다시 누르면 된다.
  await page.getByText("월", { exact: true }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(page.getByText("루틴을 만들었어요.")).toBeVisible();
  await expect(content).toHaveValue("");
});

test("일정 날짜가 잘못돼도 적은 이름이 남는다", async ({ page }) => {
  await page.getByRole("button", { name: "일정", exact: true }).click();
  const title = page.getByLabel("새 일정 이름");
  await title.fill("중간고사");
  await page.getByLabel("새 일정 종료일").fill("2020-01-01");
  await title.press("Enter");

  await expect(page.getByText("종료일이 시작일보다 앞설 수 없어요.")).toBeVisible();
  await expect(title).toHaveValue("중간고사");
});
