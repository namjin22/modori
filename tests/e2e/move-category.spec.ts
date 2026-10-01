import { expect, test as base, type Locator, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-movecat-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

/** 손잡이를 잡아 다른 칸(또는 줄) 위로 끌어다 놓는다. */
async function dragHandleTo(page: Page, handle: Locator, target: Locator) {
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("좌표를 구하지 못했다");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("할 일을 끌어 다른 카테고리로 옮기면 그 카테고리 묶음에 들어가고 색도 따라간다", async ({ page, email }, testInfo) => {
  await signIn(page, email, `이동${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();

  const [from, to] = await Promise.all([
    prisma.category.create({ data: { userId: user.id, name: "출발", color: "#ef4444", order: 10 } }),
    prisma.category.create({ data: { userId: user.id, name: "도착", color: "#0ea5e9", order: 11 } }),
  ]);
  const base = { userId: user.id, date: today, done: false };
  const moved = await prisma.todo.create({ data: { ...base, categoryId: from.id, content: "옮길 일", order: 100, color: "#22c55e" } });
  await prisma.todo.createMany({
    data: [
      { ...base, categoryId: from.id, content: "남는 일", order: 101 },
      { ...base, categoryId: to.id, content: "도착에 있던 일", order: 102 },
    ],
  });

  await page.goto("/");
  const row = page.getByRole("listitem").filter({ hasText: "옮길 일" });
  const target = page.getByRole("listitem").filter({ hasText: "도착에 있던 일" });
  await dragHandleTo(page, row.getByRole("button", { name: "순서 바꾸기 손잡이" }), target);

  // 놓는 순간 도착 묶음(이름 줄 "도착" 아래)에 들어가 보인다.
  const arrival = page.locator("section").filter({ has: page.getByRole("button", { name: "도착에 할 일 쓰기" }) });
  await expect(arrival.getByRole("listitem").filter({ hasText: "옮길 일" })).toBeVisible();
  const departure = page.locator("section").filter({ has: page.getByRole("button", { name: "출발에 할 일 쓰기" }) });
  await expect(departure.getByRole("listitem").filter({ hasText: "옮길 일" })).toHaveCount(0);
  await expect(departure.getByRole("listitem").filter({ hasText: "남는 일" })).toBeVisible();

  // 저장이 끝날 때까지 기다린 뒤 새로고침해도 그대로다. DB도 카테고리가 바뀌고 따로 고른 색은 버려졌다.
  await expect(page.locator("ul[aria-busy=true]")).toHaveCount(0);
  await page.reload();
  await expect(arrival.getByRole("listitem").filter({ hasText: "옮길 일" })).toBeVisible();
  const saved = await prisma.todo.findUniqueOrThrow({ where: { id: moved.id } });
  expect(saved.categoryId).toBe(to.id);
  expect(saved.color).toBeNull();
});
