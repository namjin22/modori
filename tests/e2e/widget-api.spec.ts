import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 홈 화면 위젯(2026-11-20 운영자 요청, Android)이 부르는 /api/widget: 오늘 남은 할 일만, 로그인한 사람의 것만, 읽기 전용.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-widget-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
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

type WidgetResponse = { date: string; remaining: number; todos: { id: string; content: string; color: string; subDone?: number; subTotal?: number }[] };

test("로그인하지 않으면 401이고 할 일을 돌려주지 않는다", async ({ request }) => {
  const response = await request.get("/api/widget");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({});
});

test("오늘 남은 할 일만, 카테고리 순서대로, 세부 할 일은 큰 할 일 줄에 합쳐서 돌려준다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `위젯${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const first = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const second = await prisma.category.create({ data: { userId: me.id, name: "공부", color: "#dc2626", order: first.order + 1 } });
  const today = todayKST();

  const big = await prisma.todo.create({ data: { userId: me.id, categoryId: first.id, content: "포트폴리오 완성", date: today, order: 0 } });
  await prisma.todo.createMany({
    data: [
      { userId: me.id, categoryId: first.id, parentId: big.id, content: "메인 페이지", date: today, order: 1, done: true, doneAt: new Date() },
      { userId: me.id, categoryId: first.id, parentId: big.id, content: "배포하기", date: today, order: 2 },
      { userId: me.id, categoryId: second.id, content: "영어 단어", date: today, order: 0 },
      { userId: me.id, categoryId: first.id, content: "이미 끝낸 일", date: today, order: 3, done: true, doneAt: new Date() },
      { userId: me.id, categoryId: first.id, content: "내일 할 일", date: addDays(today, 1), order: 0 },
      { userId: me.id, categoryId: first.id, content: "어제 못 한 일", date: addDays(today, -1), order: 0 },
    ],
  });
  // 다른 사람의 오늘 할 일은 섞이지 않는다.
  const other = await prisma.user.create({ data: { email: `other-${email}`, nickname: `남${RUN_TAG}`.slice(0, 12), privacyAgreedAt: new Date() } });
  try {
    await prisma.todo.create({ data: { userId: other.id, content: "남의 할 일", date: today, order: 0 } });

    const response = await page.request.get("/api/widget");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as WidgetResponse;
    expect(body.date).toBe(formatKST(today));
    expect(body.remaining).toBe(2);
    expect(body.todos.map((todo) => todo.content)).toEqual(["포트폴리오 완성", "영어 단어"]);
    expect(body.todos[0]).toMatchObject({ id: big.id, subDone: 1, subTotal: 2, color: first.color });
    expect(body.todos[1]).toMatchObject({ color: "#dc2626" });
    expect(body.todos[1]).not.toHaveProperty("subTotal");
  } finally {
    await prisma.user.deleteMany({ where: { id: other.id } });
  }
});

test("앱을 열기 전에도 오늘 루틴 할 일이 목록에 나온다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `위젯${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const today = todayKST();
  // 홈을 연 뒤에 루틴을 만들었으니 오늘 할 일 행은 아직 없다. 위젯이 부르면 만들어진다.
  await prisma.routine.create({ data: { userId: me.id, content: "물 마시기", freq: "DAILY", startDate: today, categoryId: category.id } });
  expect(await prisma.todo.count({ where: { userId: me.id, date: today } })).toBe(0);

  const body = (await (await page.request.get("/api/widget")).json()) as WidgetResponse;
  expect(body.todos.map((todo) => todo.content)).toEqual(["물 마시기"]);
  expect(body.remaining).toBe(1);
  expect(await prisma.todo.count({ where: { userId: me.id, date: today, routineId: { not: null } } })).toBe(1);
});

test("남은 일이 없으면 빈 목록이고, 위젯 호출은 할 일을 바꾸지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `위젯${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const todo = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, content: "다 했다", date: todayKST(), order: 0, done: true, doneAt: new Date() } });

  const body = (await (await page.request.get("/api/widget")).json()) as WidgetResponse;
  expect(body).toMatchObject({ remaining: 0, todos: [] });
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: todo.id } })).toMatchObject({ done: true, content: "다 했다" });
});
