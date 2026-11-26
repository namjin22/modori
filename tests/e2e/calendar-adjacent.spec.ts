import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 달력의 첫 줄·마지막 줄 빈 칸에 앞뒤 달의 날짜가 흐리게 보인다(2026-11-27 요청). 2026년 12월은 화요일에 시작해 11월 29·30일이 앞에, 목요일에 끝나 1월 1·2일이 뒤에 온다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-caladj-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test("달력 첫 줄과 마지막 줄의 빈 칸에 앞뒤 달의 날짜가 흐리게 보이고, 누르는 칸은 아니다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `인접${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/?month=2026-12&date=2026-12-01");
  const other = page.locator("[data-other-month]");
  await expect(other).toHaveText(["29", "30", "1", "2"]);
  // 이번 달 날짜만 누르는 칸(data-date)이고, 앞뒤 달 날짜는 링크도 아니다.
  await expect(page.locator("[data-date]")).toHaveCount(31);
  await expect(other.first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("link", { name: /^29일, / })).toHaveCount(1);

  // 첫 칸이 일요일이면 앞쪽 흐린 날짜는 없다(2026년 11월은 일요일에 시작하고 월요일 30일에 끝난다).
  await page.goto("/?month=2026-11&date=2026-11-01");
  await expect(page.locator("[data-other-month]")).toHaveText(["1", "2", "3", "4", "5"]);
});
