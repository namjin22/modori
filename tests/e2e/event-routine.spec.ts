import { expect, test as base, type Page } from "@playwright/test";

import { formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 반복 일정(일정 루틴, 2026-10-14 요청): 루틴 화면에서 "일정"을 골라 만들면 홈 달력·일정 목록에 그 규칙대로 뜬다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-evroutine-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("루틴 화면에서 매일 반복 일정을 만들면 홈의 달력과 일정 목록에 뜨고, 이 날만 빼고 되돌린다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `반복${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByRole("radio", { name: "일정" }).click();
  await page.getByLabel("반복 일정 이름").fill("학원");
  await page.getByRole("checkbox", { name: "하루 종일" }).uncheck();
  // 하루 종일을 끄면 저녁 6~7시가 들어간다.
  await expect(page.getByRole("button", { name: /^반복 일정 시작 시간 / })).toHaveAccessibleName("반복 일정 시작 시간 오후 6:00, 바꾸기");
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(page.getByRole("status").filter({ hasText: "반복 일정을 만들었어요." })).toBeVisible();
  const repeats = page.getByRole("region", { name: "반복 일정" });
  await expect(repeats.getByText("학원")).toBeVisible();
  await expect(repeats).toContainText("매일 · 18:00 ~ 19:00");

  await page.goto("/");
  const list = page.getByRole("region", { name: "일정" }).getByRole("list", { name: "반복 일정" });
  await expect(list.getByText("학원")).toBeVisible();
  await expect(list).toContainText("↻ 매일 · 18:00 ~ 19:00");
  const todayCell = page.locator(`[data-date="${formatKST(todayKST())}"]`);
  await expect(todayCell).toContainText("학원");
  // 반복 일정의 이름표는 끌어 기간을 바꾸지 않는다.
  await expect(todayCell.locator("[data-event-id]")).toHaveCount(0);

  // 이 날만 빼면 오늘에서 사라지고, 되돌리면 다시 뜬다.
  await list.getByText("학원").click();
  const dialog = page.getByRole("dialog", { name: "반복 일정" });
  await dialog.getByRole("button", { name: "이 날만 빼기" }).click();
  await expect(list).toHaveCount(0);
  await expect(todayCell).not.toContainText("학원");
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("list", { name: "반복 일정" }).getByText("학원")).toBeVisible();
});

test("멈춘 반복 일정은 홈에 뜨지 않고, 하루 상한은 그 날에만 있는 일정끼리 센다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `멈춤${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();
  await prisma.eventRoutine.create({
    data: { userId: user.id, title: "멈춘 학원", color: "#2563eb", freq: "DAILY", startDate: today, pausedAt: new Date() },
  });
  await prisma.eventRoutine.create({ data: { userId: user.id, title: "도는 운동", color: "#22c55e", freq: "DAILY", startDate: today } });

  await page.goto("/");
  const section = page.getByRole("region", { name: "일정" });
  await expect(section.getByText("도는 운동")).toBeVisible();
  await expect(section.getByText("멈춘 학원")).toHaveCount(0);
  // 반복 일정이 있어도 그 날 일정은 처음처럼 적을 수 있다.
  await expect(section.getByRole("button", { name: "시험이나 행사 적어두기" })).toBeVisible();
});
