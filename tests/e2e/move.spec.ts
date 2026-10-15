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

  // 오늘이 아닌 날(내일 화면)에서는 버튼 이름이 "오늘 하기"가 되고, 누르면 오늘로 당겨 온다(2026-10-14 요청).
  await page.goto(`/?date=${formatKST(tomorrow)}`);
  await openTodo(page, "빨래 개기");
  await expect(page.getByRole("dialog").getByRole("button", { name: "다음 날에 하기" })).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "오늘 하기" }).click();
  await expect(page.getByText(`${formatMonthDayKST(todayKST())}로 옮겼어요`)).toBeVisible();
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
  // 오늘 화면에서는 "오늘 하기"가 아니라 "내일 하기"로 넘긴다(아래 시험).
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

test("끝낸 할 일은 옮기지 않고 '또 하기'로 다른 날에 베낀다. 끝낸 기록은 그날에 남는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `또하기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "영어 단어 외우기");
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });

  // 안 끝낸 일에는 예전 문구(옮기기)가 보인다.
  await openTodo(page, "영어 단어 외우기");
  await expect(page.getByRole("button", { name: "내일 하기", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();

  // 끝낸 일에는 "또 하기"가 보이고, 누르면 내일에 새 할 일이 생기며 오늘의 끝낸 기록은 그대로다.
  await openTodo(page, "영어 단어 외우기");
  await expect(page.getByRole("button", { name: "내일 하기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다른 날 또 하기" })).toBeVisible();
  await page.getByRole("button", { name: "내일 또 하기", exact: true }).click();
  const tomorrow = addDays(todayKST(), 1);
  await expect(page.getByText(`${formatMonthDayKST(tomorrow)}에 또 하기로 적었어요`)).toBeVisible();

  await expect
    .poll(async () =>
      (await prisma.todo.findMany({ where: { userId: me.id, content: "영어 단어 외우기" }, orderBy: { date: "asc" } })).map((todo) => [
        formatKST(todo.date),
        todo.done,
      ]),
    )
    .toEqual([
      [formatKST(todayKST()), true],
      [formatKST(tomorrow), false],
    ]);

  // 오늘 화면에는 끝낸 일이 그대로 있고, 내일 화면에는 안 끝낸 새 할 일이 있다.
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
  await page.goto(`/?date=${formatKST(tomorrow)}`);
  await expect(page.getByRole("button", { name: "영어 단어 외우기", exact: true })).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();

  // 같은 날로는 또 하지 않는다(다른 날 또 하기에서 고른 날이 그날이면 거절).
  await page.goto("/");
  await openTodo(page, "영어 단어 외우기");
  await page.getByRole("button", { name: "다른 날 또 하기" }).click();
  await chooseDate(page, "또 할 날짜", formatKST(todayKST()));
  await page.getByRole("button", { name: "또 하기", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("이미 그날이에요. 다른 날을 골라 주세요.");
});

test("미리 계획해 둔 앞날의 안 끝낸 일도 '모두 오늘 하기'로 한 번에 오늘로 당겨 온다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `당기기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  const today = todayKST();
  const later = addDays(today, 3);
  await prisma.todo.createMany({
    data: [
      { userId: user.id, categoryId: category.id, date: later, content: "미리 계획 1", order: 0 },
      { userId: user.id, categoryId: category.id, date: later, content: "미리 계획 2", order: 1 },
      { userId: user.id, categoryId: category.id, date: later, content: "이미 끝낸 일", order: 2, done: true, doneAt: new Date() },
    ],
  });

  // 앞날 화면에 안 끝낸 일 수만큼의 버튼이 있다(끝낸 일은 세지 않는다).
  await page.goto(`/?date=${formatKST(later)}`);
  await page.getByRole("button", { name: "안 끝낸 일 2개 모두 오늘 하기" }).click();
  await expect(page.getByText(/오늘로 옮겼어요|2개/).first()).toBeVisible();

  await expect
    .poll(async () => (await prisma.todo.findMany({ where: { userId: user.id, date: today }, orderBy: { order: "asc" } })).map((todo) => todo.content))
    .toEqual(["미리 계획 1", "미리 계획 2"]);
  // 끝낸 일은 그 날에 그대로 있다.
  expect((await prisma.todo.findMany({ where: { userId: user.id, date: later } })).map((todo) => todo.content)).toEqual(["이미 끝낸 일"]);

  // 오늘 화면에서는 "오늘 하기"가 아니라 "내일 하기"가 나온다(아래 시험).
  await page.goto("/");
  await expect(page.getByRole("button", { name: /모두 오늘 하기/ })).toHaveCount(0);
});

test("오늘 못 끝낸 일은 맨 아래 버튼 하나로 '모두 내일 하기'로 넘기고, 잘못 눌렀으면 되돌린다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `내일넘기기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  const today = todayKST();
  const tomorrow = addDays(today, 1);
  await prisma.todo.createMany({
    data: [
      { userId: user.id, categoryId: category.id, date: today, content: "못 끝낸 하나", order: 0 },
      { userId: user.id, categoryId: category.id, date: today, content: "못 끝낸 둘", order: 1 },
      { userId: user.id, categoryId: category.id, date: today, content: "오늘 끝낸 일", order: 2, done: true, doneAt: new Date() },
    ],
  });
  await page.reload();

  // 접힌 버튼 없이 바로 넘기는 버튼 하나가 목록의 맨 아래(할 일들보다 아래)에 있다(2026-10-16 요청).
  const button = page.getByRole("button", { name: "안 끝낸 일 2개 모두 내일 하기" });
  await expect(button).toBeVisible();
  await expect(page.getByRole("button", { name: "안 끝낸 일 한꺼번에 넘기기" })).toHaveCount(0);
  const buttonBox = await button.boundingBox();
  const lastRow = await page.getByRole("listitem").filter({ hasText: "오늘 끝낸 일" }).boundingBox();
  if (!buttonBox || !lastRow) throw new Error("좌표를 구하지 못했다");
  expect(buttonBox.y).toBeGreaterThan(lastRow.y);

  await button.click();
  await expect(page.getByText("안 끝낸 일 2개를 내일로 옮겼어요")).toBeVisible();
  await expect
    .poll(async () => (await prisma.todo.findMany({ where: { userId: user.id, date: tomorrow }, orderBy: { order: "asc" } })).map((todo) => todo.content))
    .toEqual(["못 끝낸 하나", "못 끝낸 둘"]);
  expect((await prisma.todo.findMany({ where: { userId: user.id, date: today } })).map((todo) => todo.content)).toEqual(["오늘 끝낸 일"]);

  // 알림의 되돌리기로 원래 날, 원래 순서로 돌아온다.
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect
    .poll(async () => (await prisma.todo.findMany({ where: { userId: user.id, date: today }, orderBy: { order: "asc" } })).map((todo) => todo.content))
    .toEqual(["못 끝낸 하나", "못 끝낸 둘", "오늘 끝낸 일"]);
  await expect(page.getByRole("button", { name: "못 끝낸 하나", exact: true })).toBeVisible();
});
