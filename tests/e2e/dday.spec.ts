import { expect, test as base, type Page } from "@playwright/test";

import { addDays, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady, openEvent } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-dday-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
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

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("D-day를 끈 일정은 다가오는 일정 목록에서 빠진다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `디데${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const later = addDays(todayKST(), 5);
  await prisma.event.createMany({
    data: [
      { userId: user.id, title: "기말고사", startDate: later, endDate: later, color: "#2563eb" },
      { userId: user.id, title: "동아리 회의", startDate: later, endDate: later, color: "#2563eb" },
    ],
  });

  await page.reload();
  const section = page.getByRole("region", { name: "일정" });
  await expect(section.getByRole("button", { name: /기말고사/ })).toContainText("D-5");
  await expect(section.getByRole("button", { name: /동아리 회의/ })).toBeVisible();

  await openEvent(page, "동아리 회의");
  const toggle = page.getByRole("checkbox", { name: /D-day 보이기/ });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();

  await expect(section.getByRole("button", { name: /동아리 회의/ })).toHaveCount(0);
  await expect(section.getByRole("button", { name: /기말고사/ })).toContainText("D-5");
  expect((await prisma.event.findFirstOrThrow({ where: { userId: user.id, title: "동아리 회의" } })).dday).toBe(false);
});

test("D-day를 끄고 만든 오늘 일정은 D-DAY 표시 없이 이름만 보인다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `오늘${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByLabel("새 일정 이름").fill("학급 회의");
  await page.getByRole("checkbox", { name: /D-day 보이기/ }).uncheck();
  await page.getByRole("button", { name: "저장", exact: true }).click();

  const card = page.getByRole("listitem").filter({ hasText: "학급 회의" });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("D-DAY");
});
