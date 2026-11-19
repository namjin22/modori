import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { addTodo, homeReady, openTodo } from "./todo-helpers";

// 할 일과 목표의 연결(2026-11-19, docs/decisions.md): 할 일 수정 창에서 목표 고르기, 목표 카드의 "할 일 넣기", 연결된 할 일 수, 지우기·되돌리기·친구 화면.
const test = base.extend<{ emails: { me: string; friend: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-gtodo-me-${tag}-${RUN_TAG}@modori.test`, friend: `e2e-gtodo-you-${tag}-${RUN_TAG}@modori.test` };
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await provide(emails);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
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

async function makeGoal(userId: string) {
  return prisma.goal.create({
    data: { userId, title: "토익 900점", children: { create: [{ userId, title: "단어 1000개" }] } },
    include: { children: true },
  });
}

const row = (page: Page, content: string) => page.getByRole("listitem").filter({ hasText: content });

test("할 일 수정 창에서 목표(세부 목표)를 고르면 줄에 이름이 붙고, 목표 카드의 연결된 할 일 수가 오르며, '연결 안 함'으로 끊는다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나연${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const goal = await makeGoal(me.id);
  const sub = goal.children[0];
  await page.reload();
  await expect(homeReady(page)).toBeVisible();
  await addTodo(page, "단어 50개 외우기");

  // 목표가 있으면 수정 창에 목표 칸이 생긴다. 세부 목표는 "목표 › 세부 목표"로 보인다.
  await openTodo(page, "단어 50개 외우기");
  await page.getByRole("button", { name: "할 일 목표" }).click();
  await page.getByRole("dialog", { name: "할 일 목표" }).getByRole("radio", { name: "토익 900점 › 단어 1000개" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(row(page, "단어 50개 외우기").getByText("토익 900점 › 단어 1000개")).toBeVisible();
  await expect.poll(async () => (await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "단어 50개 외우기" } })).goalId).toBe(sub.id);

  // 목표 카드: 세부 목표 옆 0/1, 목표 합계 0/1. 할 일을 끝내면 1/1.
  await page.getByRole("button", { name: "토익 900점 펼치기" }).click();
  await expect(page.getByLabel("연결된 할 일 0/1")).toBeVisible();
  await expect(page.getByText("연결된 할 일 0/1")).toBeVisible();
  await row(page, "단어 50개 외우기").getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText("연결된 할 일 1/1")).toBeVisible();

  // "연결 안 함"으로 끊는다.
  await openTodo(page, "단어 50개 외우기");
  await page.getByRole("button", { name: "할 일 목표" }).click();
  await page.getByRole("dialog", { name: "할 일 목표" }).getByRole("radio", { name: "연결 안 함" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(row(page, "단어 50개 외우기").getByText("토익 900점 › 단어 1000개")).toHaveCount(0);
  await expect.poll(async () => (await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "단어 50개 외우기" } })).goalId).toBeNull();
});

test("목표 카드의 '할 일 넣기'로 세부 목표를 골라 적으면 그 날 연결된 할 일이 생긴다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나넣${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const goal = await makeGoal(me.id);
  await page.reload();
  await page.getByRole("button", { name: "토익 900점 펼치기" }).click();

  // 세부 목표가 있으면 넣을 곳을 고른다(기본은 목표 전체).
  await page.getByLabel("토익 900점에 넣을 할 일").fill("LC 기출 한 회 풀기");
  await page.getByRole("button", { name: "토익 900점의 할 일을 넣을 곳" }).click();
  await page.getByRole("dialog", { name: "토익 900점의 할 일을 넣을 곳" }).getByRole("radio", { name: "토익 900점 › 단어 1000개" }).click();
  await page.getByRole("button", { name: "넣기", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "할 일을 넣었어요." })).toBeVisible();

  const todo = await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "LC 기출 한 회 풀기" } });
  expect(todo.goalId).toBe(goal.children[0].id);
  expect(todo.date.getTime()).toBe(todayKST().getTime());
  // 오늘 목록에 연결된 이름과 함께 보인다.
  await expect(row(page, "LC 기출 한 회 풀기").getByText("토익 900점 › 단어 1000개")).toBeVisible();

  // 목표 전체에도 넣을 수 있다(고르지 않으면 목표 전체).
  await page.getByLabel("토익 900점에 넣을 할 일").fill("모의고사 일정 잡기");
  await page.getByRole("button", { name: "토익 900점의 할 일을 넣을 곳" }).click();
  await page.getByRole("dialog", { name: "토익 900점의 할 일을 넣을 곳" }).getByRole("radio", { name: "토익 900점", exact: true }).click();
  await page.getByRole("button", { name: "넣기", exact: true }).click();
  await expect.poll(async () => (await prisma.todo.findFirst({ where: { userId: me.id, content: "모의고사 일정 잡기" } }))?.goalId).toBe(goal.id);
});

test("할 일을 지웠다 되돌리면 연결이 그대로 돌아오고, 목표를 지우면 할 일은 남고 연결만 끊어진다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나지${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const goal = await makeGoal(me.id);
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id } });
  await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, date: todayKST(), content: "연결된 할 일", goalId: goal.id } });
  await page.reload();
  await expect(row(page, "연결된 할 일").getByText("토익 900점")).toBeVisible();

  await openTodo(page, "연결된 할 일");
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(row(page, "연결된 할 일")).toHaveCount(0);
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(row(page, "연결된 할 일").getByText("토익 900점")).toBeVisible();
  await expect.poll(async () => (await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "연결된 할 일" } })).goalId).toBe(goal.id);

  // 목표를 지우면(세부 목표까지) 할 일은 남고 연결만 비워진다.
  await prisma.goal.delete({ where: { id: goal.id } });
  await page.reload();
  await expect(row(page, "연결된 할 일")).toBeVisible();
  await expect(row(page, "연결된 할 일").getByText("토익 900점")).toHaveCount(0);
  expect((await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "연결된 할 일" } })).goalId).toBeNull();
});

test("친구 화면에는 할 일의 목표 연결이 나오지 않고, 비공개 목표의 이름은 페이지 데이터에도 없다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나친${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const friend = await prisma.user.create({
    data: {
      email: emails.friend,
      nickname: `친연${tag}${RUN_TAG}`,
      categories: { create: { name: "공부", color: "#2563eb", order: 0, isPublic: true } },
    },
    include: { categories: true },
  });
  const secret = await prisma.goal.create({ data: { userId: friend.id, title: "비밀스러운 숨긴 목표", isPublic: false } });
  const open = await prisma.goal.create({ data: { userId: friend.id, title: "공개된 목표", isPublic: true } });
  await prisma.todo.createMany({
    data: [
      { userId: friend.id, categoryId: friend.categories[0].id, date: todayKST(), content: "숨긴 목표로 가는 할 일", goalId: secret.id },
      { userId: friend.id, categoryId: friend.categories[0].id, date: todayKST(), content: "공개 목표로 가는 할 일", goalId: open.id },
    ],
  });
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  const response = await page.goto(`/feed/u/${friend.id}`);
  const html = (await response?.text()) ?? "";
  await expect(page.getByText("숨긴 목표로 가는 할 일")).toBeVisible();
  await expect(page.getByText("공개 목표로 가는 할 일")).toBeVisible();
  // 할 일 줄에는 목표 표시가 없다. 공개한 목표는 위쪽 목표 칸에만 있다.
  await expect(page.getByText("🎯")).toHaveCount(0);
  expect(html).not.toContain("비밀스러운 숨긴 목표");
  await expect(page.getByRole("region", { name: "목표", exact: true }).getByText("공개된 목표")).toBeVisible();
});
