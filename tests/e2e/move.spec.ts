import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, formatMonthDayKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo, homeReady, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-move-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("다른 날에 하기로 할 일을 고른 날로 옮긴다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `옮김${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "영어 단어 외우기");

  await openTodo(page, "영어 단어 외우기");
  await page.getByRole("button", { name: "다른 날에 하기" }).click();
  // 처음 값은 다음 날이다.
  const tomorrow = addDays(todayKST(), 1);
  await expect(page.getByLabel("옮길 날짜")).toHaveValue(formatKST(tomorrow));
  const target = addDays(todayKST(), 3);
  await page.getByLabel("옮길 날짜").fill(formatKST(target));
  await page.getByRole("button", { name: "옮기기" }).click();

  await expect(page.getByText(`${formatMonthDayKST(target)}로 옮겼어요`)).toBeVisible();
  await expect(page.getByRole("button", { name: "영어 단어 외우기", exact: true })).toHaveCount(0);

  await page.goto(`/?date=${formatKST(target)}`);
  await expect(page.getByRole("button", { name: "영어 단어 외우기", exact: true })).toBeVisible();

  // 같은 날로는 옮기지 않는다.
  await openTodo(page, "영어 단어 외우기");
  await page.getByRole("button", { name: "다른 날에 하기" }).click();
  await page.getByLabel("옮길 날짜").fill(formatKST(target));
  await page.getByRole("button", { name: "옮기기" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("이미 그날의 할 일이에요.");
});

test("루틴 할 일을 옮기면 원래 날에 다시 생기지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `루옮${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();
  await prisma.routine.create({
    data: { userId: user.id, content: "줄넘기", freq: "DAILY", startDate: today },
  });

  await page.reload();
  await openTodo(page, "줄넘기");
  await page.getByRole("button", { name: "다른 날에 하기" }).click();
  await page.getByLabel("옮길 날짜").fill(formatKST(addDays(today, -1)));
  await page.getByRole("button", { name: "옮기기" }).click();
  await expect(page.getByText("로 옮겼어요")).toBeVisible();

  // 다시 그려도 오늘 루틴 할 일이 되살아나지 않는다.
  await page.reload();
  await expect(homeReady(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "줄넘기", exact: true })).toHaveCount(0);

  const moved = await prisma.todo.findMany({ where: { userId: user.id, content: "줄넘기" } });
  expect(moved.map((todo) => ({ date: formatKST(todo.date), routineId: todo.routineId }))).toContainEqual({
    date: formatKST(addDays(today, -1)),
    routineId: null,
  });
});
