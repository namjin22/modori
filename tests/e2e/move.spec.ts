import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, formatMonthDayKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo, chooseDate, homeReady, openTodo } from "./todo-helpers";

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
  await expect(page.getByRole("button", { name: /^옮길 날짜:/ })).toHaveAccessibleName(
    new RegExp(`${tomorrow.getUTCFullYear()}년 ${tomorrow.getUTCMonth() + 1}월 ${tomorrow.getUTCDate()}일`),
  );
  const target = addDays(todayKST(), 3);
  await chooseDate(page, "옮길 날짜", formatKST(target));
  await page.getByRole("button", { name: "옮기기" }).click();

  await expect(page.getByText(`${formatMonthDayKST(target)}로 옮겼어요`)).toBeVisible();
  await expect(page.getByRole("button", { name: "영어 단어 외우기", exact: true })).toHaveCount(0);

  await page.goto(`/?date=${formatKST(target)}`);
  await expect(page.getByRole("button", { name: "영어 단어 외우기", exact: true })).toBeVisible();

  // 같은 날로는 옮기지 않는다.
  await openTodo(page, "영어 단어 외우기");
  await page.getByRole("button", { name: "다른 날에 하기" }).click();
  await chooseDate(page, "옮길 날짜", formatKST(target));
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
  await chooseDate(page, "옮길 날짜", formatKST(addDays(today, -1)));
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

test("내일 하기를 누르면 오늘 할 일이 내일로 옮겨진다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `내일${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "빨래 개기");

  await openTodo(page, "빨래 개기");
  // 옮기기 버튼은 메모보다 위에 있다.
  const dialog = page.getByRole("dialog");
  const tomorrowBox = await dialog.getByRole("button", { name: "내일 하기" }).boundingBox();
  const memoBox = await dialog.getByLabel("할 일 메모").boundingBox();
  expect(tomorrowBox!.y).toBeLessThan(memoBox!.y);

  await dialog.getByRole("button", { name: "내일 하기" }).click();
  const tomorrow = addDays(todayKST(), 1);
  await expect(page.getByText(`${formatMonthDayKST(tomorrow)}로 옮겼어요`)).toBeVisible();
  await expect(page.getByRole("button", { name: "빨래 개기", exact: true })).toHaveCount(0);

  // 내일 화면에서는 버튼 이름이 "다음 날에 하기"가 된다.
  await page.goto(`/?date=${formatKST(tomorrow)}`);
  await openTodo(page, "빨래 개기");
  await expect(page.getByRole("dialog").getByRole("button", { name: "다음 날에 하기" })).toBeVisible();
});

test("지난 날의 할 일은 오늘 하기로 오늘에 옮기고, 안 끝낸 일은 모두 오늘 하기로 한꺼번에 옮긴다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `지난${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  const yesterday = addDays(todayKST(), -1);
  const base = { userId: user.id, categoryId: category.id, date: yesterday };
  await prisma.todo.createMany({
    data: [
      { ...base, content: "어제 못 한 일 1", order: 0 },
      { ...base, content: "어제 못 한 일 2", order: 1 },
      { ...base, content: "어제 못 한 일 3", order: 2 },
      { ...base, content: "어제 끝낸 일", order: 3, done: true, doneAt: new Date() },
    ],
  });

  await page.goto(`/?date=${formatKST(yesterday)}`);
  // 지난 날에서는 한 번에 옮기기가 "오늘 하기"다(내일이 아니다).
  await openTodo(page, "어제 못 한 일 1");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "내일 하기" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "오늘 하기" }).click();
  await expect(page.getByText(`${formatMonthDayKST(todayKST())}로 옮겼어요`)).toBeVisible();

  // 남은 안 끝낸 일 둘을 한꺼번에. 끝낸 일은 그대로 남는다.
  await page.getByRole("button", { name: "안 끝낸 일 2개 모두 오늘 하기" }).click();
  await expect(page.getByText("안 끝낸 일 2개를 오늘로 옮겼어요")).toBeVisible();
  await expect(page.getByRole("button", { name: /모두 오늘 하기/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "어제 끝낸 일", exact: true })).toBeVisible();

  await page.goto("/");
  for (const content of ["어제 못 한 일 1", "어제 못 한 일 2", "어제 못 한 일 3"]) {
    await expect(page.getByRole("button", { name: content, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "어제 끝낸 일", exact: true })).toHaveCount(0);
  // 오늘 화면에는 모두 오늘 하기가 없다.
  await expect(page.getByRole("button", { name: /모두 오늘 하기/ })).toHaveCount(0);
});

test("오늘이 가득 차 있으면 들어가는 만큼만 옮기고 남은 수를 알린다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `가득${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  const today = todayKST();
  const yesterday = addDays(today, -1);
  await prisma.todo.createMany({
    data: [
      // 오늘은 49개가 차 있어 하나만 더 들어간다(하루 50개).
      ...Array.from({ length: 49 }, (_, order) => ({ userId: user.id, categoryId: category.id, date: today, content: `오늘 ${order}`, order })),
      ...Array.from({ length: 3 }, (_, order) => ({ userId: user.id, categoryId: category.id, date: yesterday, content: `밀린 ${order}`, order })),
    ],
  });
  await page.goto(`/?date=${formatKST(yesterday)}`);
  await page.getByRole("button", { name: "안 끝낸 일 3개 모두 오늘 하기" }).click();
  await expect(page.getByText("오늘 넣을 수 있는 1개만 옮겼어요. 2개가 남았어요")).toBeVisible();
  expect(await prisma.todo.count({ where: { userId: user.id, date: today } })).toBe(50);
  expect(await prisma.todo.count({ where: { userId: user.id, date: yesterday } })).toBe(2);
});
