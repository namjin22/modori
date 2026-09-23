import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { addEvent, homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-dday-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("아직 오지 않은 일정이 남은 날과 함께 오늘 화면에 뜬다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `디데${testInfo.testId.slice(-6)}${RUN_TAG}`);

  // 오늘 시작하는 일정과, 이레 뒤에 시작하는 일정.
  await addEvent(page, "오늘 발표");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.event.create({
    data: {
      userId: user.id,
      title: "중간고사",
      startDate: addDays(todayKST(), 7),
      endDate: addDays(todayKST(), 9),
      color: "#3b82f6",
    },
  });

  await page.goto("/");

  // 오늘 것은 D-DAY, 아직 안 온 것은 남은 날과 시작일이 함께 보인다.
  await expect(page.getByText("D-DAY", { exact: true })).toBeVisible();
  const upcoming = page.getByRole("button", { name: /중간고사/ });
  await expect(upcoming).toContainText("D-7");

  // 눌러서 바로 고칠 수 있다.
  await upcoming.click();
  await expect(page.getByLabel("일정 이름", { exact: true })).toHaveValue(
    "중간고사",
  );
});

test("끝난 일정에는 남은 날을 붙이지 않는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `지난${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const past = addDays(todayKST(), -3);
  await prisma.event.create({
    data: {
      userId: user.id,
      title: "지난 일정",
      startDate: past,
      endDate: past,
      color: "#3b82f6",
    },
  });

  await page.goto(`/?date=${formatKST(past)}`);

  await expect(page.getByRole("button", { name: /지난 일정/ })).toBeVisible();
  await expect(page.getByText("D-", { exact: false })).toHaveCount(0);
});
