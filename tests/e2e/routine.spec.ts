import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 테스트마다 계정을 따로 쓴다. 같은 이메일을 공유하면 병렬 실행에서
// 서로의 계정을 지워버린다.
const test = base.extend<{ email: string }>({
  // 인자 이름을 use로 두면 eslint가 React 훅으로 오해한다.
  email: async ({}, provide, testInfo) => {
    const email = `e2e-routine-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`루틴${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

async function createDailyRoutine(page: Page, content: string) {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByLabel("루틴 내용").fill(content);
  await page.getByRole("radio", { name: "매일" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: content }),
  ).toBeVisible();
}

test.beforeEach(async ({ page, email }) => {
  await signInAndOnboard(page, email);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("매일 루틴은 오늘 화면을 열면 할 일로 만들어진다", async ({ page }) => {
  await createDailyRoutine(page, "아침 스트레칭");

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");

  await expect(page.getByText("아침 스트레칭")).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("미래 날짜에서는 예정으로만 보이고 체크하면 그때 만들어진다", async ({
  page,
}) => {
  await createDailyRoutine(page, "저녁 러닝");

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);

  await expect(page.getByText("예정된 루틴")).toBeVisible();
  await expect(page.getByText("저녁 러닝")).toBeVisible();

  await page.getByRole("button", { name: "미리 완료" }).click();

  await expect(page.getByText("예정된 루틴")).toBeHidden();
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
});

test("예정 루틴은 오늘 날짜로 조작해도 만들어지지 않는다", async ({ page }) => {
  await createDailyRoutine(page, "조작할 루틴");

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);
  const form = page.getByRole("button", { name: "미리 완료" }).locator("..");
  await form.locator('input[name="date"]').evaluate((input, value) => {
    (input as HTMLInputElement).value = value;
  }, formatKST(todayKST()));
  await form.getByRole("button", { name: "미리 완료" }).click();

  await expect(page.getByText("예정된 루틴")).toBeVisible();
  await expect(page.getByText("1개 중 1개 완료")).toBeHidden();
});

test("멈춘 루틴은 새 할 일을 만들지 않는다", async ({ page }) => {
  await createDailyRoutine(page, "멈출 루틴");

  await page.getByRole("button", { name: "잠시 멈춤" }).click();
  await expect(page.getByRole("button", { name: "다시 시작" })).toBeVisible();

  const tomorrow = formatKST(addDays(todayKST(), 1));
  await page.goto(`/?date=${tomorrow}`);

  await expect(page.getByText("멈출 루틴")).toBeHidden();
  await expect(page.getByText("아직 할 일이 없어요")).toBeVisible();
});

test("카테고리를 지워 멈춘 루틴은 다시 시작할 수 없다", async ({ page, email }) => {
  await createDailyRoutine(page, "카테고리 잃을 루틴");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const routine = await prisma.routine.findFirstOrThrow({ where: { userId: user.id } });
  // 카테고리 삭제와 같은 결과: 루틴은 멈추고 카테고리 연결이 끊긴다.
  await prisma.category.delete({ where: { id: routine.categoryId! } });
  await prisma.routine.update({ where: { id: routine.id }, data: { pausedAt: new Date() } });

  await page.goto("/routines");
  const item = page.getByRole("listitem").filter({ hasText: "카테고리 잃을 루틴" });
  await expect(item.getByText("카테고리를 지워 멈춤")).toBeVisible();
  await expect(item.getByRole("button", { name: "다시 시작" })).toHaveCount(0);
});

test("요일을 고르지 않은 매주 루틴은 만들어지지 않는다", async ({ page }) => {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByLabel("루틴 내용").fill("요일 없는 루틴");
  await page.getByRole("radio", { name: "매주" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();

  await expect(page.getByText("아직 루틴이 없어요")).toBeVisible();
});

test("루틴을 지워도 이미 만들어진 할 일은 남는다", async ({ page }) => {
  await createDailyRoutine(page, "남을 할 일");

  // 오늘 화면을 실제로 열어야 루틴 할 일이 만들어진다. 이동을 기다린 뒤 확인한다.
  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("남을 할 일")).toBeVisible();

  // 삭제는 확인창을 띄운다. Playwright는 기본적으로 닫아버리므로 수락해준다.
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/settings/routines");
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 루틴이 없어요")).toBeVisible();

  await page.getByRole("link", { name: "피드", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("남을 할 일")).toBeVisible();
});

test("이미 만든 루틴의 내용과 카테고리를 고치면 오늘 할 일도 따라 바뀌고 지난 기록은 남는다", async ({ page, email }) => {
  // 카테고리를 하나 더 만든다(옮길 곳).
  await page.goto("/categories");
  await page.getByLabel("새 카테고리 이름").fill("운동");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("운동", { exact: true })).toBeVisible();

  await createDailyRoutine(page, "물 마시기");
  // 오늘 화면을 열어 오늘 할 일을 만든다. 어제 날짜의 끝낸 할 일은 지난 기록으로 둔다.
  await page.goto("/");
  await expect(page.getByText("물 마시기")).toBeVisible();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const routine = await prisma.routine.findFirstOrThrow({ where: { userId: user.id } });
  const yesterday = addDays(todayKST(), -1);
  await prisma.todo.create({
    data: { userId: user.id, date: yesterday, content: "물 마시기", done: true, doneAt: new Date(), routineId: routine.id, categoryId: routine.categoryId, order: 0 },
  });

  await page.goto("/routines");
  await page.getByRole("listitem").filter({ hasText: "물 마시기" }).getByRole("button", { name: "고치기" }).click();
  const dialog = page.getByRole("dialog", { name: "루틴 고치기" });
  await dialog.getByLabel("루틴 내용 수정").fill("물 2리터 마시기");
  await dialog.getByRole("button", { name: "루틴 카테고리 수정" }).click();
  await page.getByRole("dialog", { name: "루틴 카테고리 수정" }).getByRole("radio", { name: "운동" }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "물 2리터 마시기" })).toBeVisible();

  const exercise = await prisma.category.findFirstOrThrow({ where: { userId: user.id, name: "운동" } });
  const updated = await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } });
  expect(updated).toMatchObject({ content: "물 2리터 마시기", categoryId: exercise.id });

  // 오늘 할 일은 새 이름·카테고리로, 어제 끝낸 기록은 그대로.
  const todayTodo = await prisma.todo.findFirstOrThrow({ where: { routineId: routine.id, date: todayKST() } });
  expect(todayTodo).toMatchObject({ content: "물 2리터 마시기", categoryId: exercise.id });
  const past = await prisma.todo.findFirstOrThrow({ where: { routineId: routine.id, date: yesterday } });
  expect(past.content).toBe("물 마시기");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "운동에 할 일 쓰기" })).toBeVisible();
  await expect(page.getByText("물 2리터 마시기")).toBeVisible();
});

test("빈 내용으로는 루틴을 고치지 않는다", async ({ page }) => {
  await createDailyRoutine(page, "책 읽기");
  await page.getByRole("listitem").filter({ hasText: "책 읽기" }).getByRole("button", { name: "고치기" }).click();
  const dialog = page.getByRole("dialog", { name: "루틴 고치기" });
  await dialog.getByLabel("루틴 내용 수정").fill("   ");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByRole("alert")).toContainText("루틴 내용을 적어주세요");
});

test("루틴 고치기 창에도 만들 때와 같은 반복 칸이 지금 값으로 떠서, 요일까지 바꾸고 이미 만든 할 일은 남는다", async ({ page, email }) => {
  await createDailyRoutine(page, "영어 단어");
  // 오늘 화면을 열어 오늘 할 일을 만든다. 규칙을 바꿔도 이 할 일은 지우지 않는다.
  await page.goto("/");
  await expect(page.getByText("영어 단어")).toBeVisible();

  // 오늘이 아닌 요일 둘을 고른다.
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  const todayIndex = todayKST().getUTCDay();
  const picked = [(todayIndex + 2) % 7, (todayIndex + 4) % 7];

  await page.goto("/routines");
  await page.getByRole("listitem").filter({ hasText: "영어 단어" }).getByRole("button", { name: "고치기" }).click();
  const dialog = page.getByRole("dialog", { name: "루틴 고치기" });
  // 지금 규칙(매일)으로 떠 있다.
  await expect(dialog.getByRole("radio", { name: "매일" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("radio", { name: "매주" }).click();
  for (const index of picked) await dialog.getByText(names[index], { exact: true }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  const routine = await prisma.routine.findFirstOrThrow({ where: { content: "영어 단어", user: { email } } });
  expect(routine).toMatchObject({ freq: "WEEKLY", byWeekday: [...picked].sort((a, b) => a - b), byMonthday: [] });
  await expect(page.getByRole("listitem").filter({ hasText: "영어 단어" })).toContainText("매주");
  // 이미 만들어진 오늘 할 일은 그대로 남는다.
  expect(await prisma.todo.count({ where: { routineId: routine.id } })).toBe(1);
});

test("루틴 고치기 창은 지금 날짜·종료일을 채워 보여 주고, 요일·날짜를 하나도 안 고르면 저장하지 않는다", async ({ page, email }) => {
  await createDailyRoutine(page, "청소");
  const routine = await prisma.routine.findFirstOrThrow({ where: { content: "청소", user: { email } } });
  const start = addDays(todayKST(), 1);
  const end = addDays(todayKST(), 40);
  await prisma.routine.update({
    where: { id: routine.id },
    data: { freq: "MONTHLY", byMonthday: [5, 20], byWeekday: [], startDate: start, endDate: end },
  });

  await page.goto("/routines");
  await page.getByRole("listitem").filter({ hasText: "청소" }).getByRole("button", { name: "고치기" }).click();
  const dialog = page.getByRole("dialog", { name: "루틴 고치기" });
  await expect(dialog.getByRole("radio", { name: "매월" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByLabel("5", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("20", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("6", { exact: true })).not.toBeChecked();
  // 시작일·종료일 단추에 지금 날짜가 보인다(날짜는 "2026년 12월 31일 (목)" 꼴이라 월·일로 본다).
  const [, startMonth, startDay] = formatKST(start).split("-").map(Number);
  const [, endMonth, endDay] = formatKST(end).split("-").map(Number);
  await expect(dialog.getByRole("button", { name: /^루틴 시작일:/ })).toContainText(`${startMonth}월 ${startDay}일`);
  await expect(dialog.getByRole("button", { name: /^루틴 종료일:/ })).toContainText(`${endMonth}월 ${endDay}일`);

  // 날짜를 모두 빼면 저장하지 않고 이유를 보여 준다. 규칙은 그대로다.
  await dialog.getByText("5", { exact: true }).click();
  await dialog.getByText("20", { exact: true }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByRole("alert")).toContainText("반복할 날짜를 하나 이상 골라주세요");
  expect(await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } })).toMatchObject({ freq: "MONTHLY", byMonthday: [5, 20] });

  // 6일을 더해 저장하면 바뀐다.
  await dialog.getByText("6", { exact: true }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
  const updated = await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } });
  expect(updated.byMonthday).toEqual([6]);
  expect(formatKST(updated.endDate ?? start)).toBe(formatKST(end));
});
