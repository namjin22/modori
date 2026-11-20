import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady, openEvent, openTodo } from "./todo-helpers";

// 할 일·일정 창의 "AI용으로 복사"(2026-11-20 운영자 요청): id가 든 글을 클립보드에 넣는다. 메모는 넣지 않는다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-copyai-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

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

// Windows의 클립보드는 줄바꿈을 \r\n으로 돌려준다. 글 내용을 보려는 시험이라 \n으로 맞춘다.
const clipboard = async (page: Page) => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");

test("할 일 창에서 복사하면 id·날짜·카테고리·세부 할 일의 id가 든 글이 들어가고, 메모는 빠진다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `복사${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const today = todayKST();
  const parent = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, content: "포트폴리오 완성", memo: "비밀 메모 내용", date: today, order: 0 } });
  const done = await prisma.todo.create({
    data: { userId: me.id, categoryId: category.id, parentId: parent.id, content: "메인 페이지 디자인", date: today, order: 1, done: true, doneAt: new Date() },
  });
  const open = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, parentId: parent.id, content: "배포하기", date: today, order: 2 } });
  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();

  // 메모가 있는 줄은 버튼 이름에 메모가 붙는다. 이름이 포트폴리오 완성으로 시작하는 줄을 연다.
  await page.getByRole("button", { name: /^포트폴리오 완성/ }).click();
  await expect(page.getByLabel("할 일 내용 수정")).toBeVisible();
  await page.getByRole("button", { name: "AI용으로 복사" }).click();
  await expect(page.getByRole("button", { name: "복사했어요" })).toBeVisible();

  const text = await clipboard(page);
  expect(text.split("\n")).toEqual([
    "Modori todo",
    `id: ${parent.id}`,
    "title: 포트폴리오 완성",
    `date: ${formatKST(today)}`,
    `category: ${category.name}`,
    "done: no",
    "sub-todos (1/2 done):",
    `- [x] 메인 페이지 디자인 (id: ${done.id})`,
    `- [ ] 배포하기 (id: ${open.id})`,
  ]);
  expect(text).not.toContain("비밀 메모");

  // 잠시 뒤 글자가 처음으로 돌아온다.
  await expect(page.getByRole("button", { name: "AI용으로 복사" })).toBeVisible({ timeout: 6000 });
});

test("세부 할 일 창에서 복사하면 큰 할 일의 id가 들어간다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `복사${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const today = todayKST();
  const parent = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, content: "큰 일", date: today, order: 0 } });
  const child = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, parentId: parent.id, content: "작은 일", date: today, order: 1 } });
  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();

  await openTodo(page, "작은 일");
  await page.getByRole("button", { name: "AI용으로 복사" }).click();
  await expect(page.getByRole("button", { name: "복사했어요" })).toBeVisible();
  const text = await clipboard(page);
  expect(text.split("\n")[0]).toBe("Modori sub-todo");
  expect(text).toContain(`id: ${child.id}`);
  expect(text).toContain(`parent id: ${parent.id}`);
});

test("일정 창에서 복사하면 id·기간·시간이 든 글이 들어간다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `복사${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();
  const event = await prisma.event.create({
    data: { userId: me.id, title: "중간고사", startDate: today, endDate: addDays(today, 2), startTime: 14 * 60, endTime: 15 * 60 + 30, color: "#2563eb", memo: "비밀 일정 메모" },
  });
  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();

  await openEvent(page, "중간고사");
  await page.getByRole("button", { name: "AI용으로 복사" }).click();
  await expect(page.getByRole("button", { name: "복사했어요" })).toBeVisible();

  const text = await clipboard(page);
  expect(text.split("\n")).toEqual([
    "Modori event",
    `id: ${event.id}`,
    "title: 중간고사",
    `date: ${formatKST(today)} ~ ${formatKST(addDays(today, 2))}`,
    "time: 14:00-15:30",
  ]);
  expect(text).not.toContain("비밀 일정 메모");
});

test("클립보드가 막히면 이유를 알리고 글을 보여 줘서 직접 복사할 수 있다", async ({ page, email }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
  });
  await signUp(page, email, `복사${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const todo = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, content: "막힌 복사", date: todayKST(), order: 0 } });
  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();

  await openTodo(page, "막힌 복사");
  await page.getByRole("button", { name: "AI용으로 복사" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "복사하지 못했어요" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "AI용으로 복사" })).toHaveValue(new RegExp(`id: ${todo.id}`));
});
