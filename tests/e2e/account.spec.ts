import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-account-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string, nickname: string) {
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

test("닉네임을 그대로 적어야 계정이 지워진다", async ({ page, email }, testInfo) => {
  const nickname = `탈퇴${testInfo.testId.slice(-6)}${RUN_TAG}`;
  await signInAndOnboard(page, email, nickname);

  await addTodo(page, "지워질 할 일");
  await expect(page.getByText("지워질 할 일")).toBeVisible();

  const before = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(await prisma.todo.count({ where: { userId: before.id } })).toBeGreaterThan(0);
  expect(await prisma.category.count({ where: { userId: before.id } })).toBeGreaterThan(0);

  await page.goto("/settings");
  await page.getByRole("link", { name: "계정 지우기" }).click();
  await expect(page.getByRole("heading", { name: "계정 지우기" })).toBeVisible();

  // 무엇이 사라지는지 숫자로 알려줘야 한다.
  await expect(page.getByText("할 일")).toBeVisible();

  // 닉네임이 다르면 지우지 않는다.
  await page.getByRole("textbox").fill("아무거나");
  await page.getByRole("button", { name: "계정 지우기" }).click();
  await expect(
    page.getByText("닉네임이 달라요. 지금 쓰는 닉네임을 그대로 입력해주세요."),
  ).toBeVisible();
  expect(await prisma.user.count({ where: { email } })).toBe(1);

  // 그대로 적으면 지워지고 로그인 화면으로 나간다.
  await page.getByRole("textbox").fill(nickname);
  await page.getByRole("button", { name: "계정 지우기" }).click();
  await expect(page).toHaveURL(/\/login$/);

  expect(await prisma.user.count({ where: { email } })).toBe(0);

  // 딸린 기록도 같이 사라져야 한다. 사용자만 지우고 남으면 주인 없는 데이터가 된다.
  expect(await prisma.todo.count({ where: { userId: before.id } })).toBe(0);
  expect(await prisma.category.count({ where: { userId: before.id } })).toBe(0);
});

test("계정을 지우면 나와 이어진 기록이 모두 사라지고 친구의 기록은 남는다", async ({ page, email }, testInfo) => {
  const nickname = `전부${testInfo.testId.slice(-6)}${RUN_TAG}`;
  await signInAndOnboard(page, email, nickname);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });

  // 친구는 DB로 바로 만든다. 로그인할 필요가 없다.
  const friend = await prisma.user.create({
    data: { email: `e2e-account-friend-${testInfo.testId}-${RUN_TAG}@modori.test`, nickname: `남는${testInfo.testId.slice(-6)}${RUN_TAG}` },
  });
  try {
    const myCategory = await prisma.category.findFirstOrThrow({ where: { userId: me.id } });
    const friendCategory = await prisma.category.create({
      data: { userId: friend.id, name: "친구 칸", color: "#22c55e", order: 0 },
    });
    const day = new Date("2026-09-01");
    const myTodo = await prisma.todo.create({
      data: { userId: me.id, categoryId: myCategory.id, content: "내 일", date: day, done: true, doneAt: day },
    });
    const friendTodo = await prisma.todo.create({
      data: { userId: friend.id, categoryId: friendCategory.id, content: "친구 일", date: day, done: true, doneAt: day },
    });
    const routine = await prisma.routine.create({
      data: { userId: me.id, categoryId: myCategory.id, content: "내 루틴", freq: "DAILY", byWeekday: [], byMonthday: [], startDate: day },
    });
    await prisma.routineSkip.create({ data: { routineId: routine.id, date: day } });
    await prisma.event.create({
      data: { userId: me.id, title: "내 일정", startDate: day, endDate: day, color: "#2563eb" },
    });
    await prisma.follow.createMany({
      data: [
        { followerId: me.id, followingId: friend.id },
        { followerId: friend.id, followingId: me.id },
      ],
    });
    await prisma.reaction.createMany({
      data: [
        { userId: me.id, todoId: friendTodo.id, todoUserId: friend.id, emoji: "👍" },
        { userId: friend.id, todoId: myTodo.id, todoUserId: me.id, emoji: "🔥" },
      ],
    });

    await page.goto("/settings/account");
    await page.getByRole("textbox").fill(nickname);
    await page.getByRole("button", { name: "계정 지우기" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const left = {
      user: await prisma.user.count({ where: { id: me.id } }),
      account: await prisma.account.count({ where: { userId: me.id } }),
      session: await prisma.session.count({ where: { userId: me.id } }),
      category: await prisma.category.count({ where: { userId: me.id } }),
      todo: await prisma.todo.count({ where: { userId: me.id } }),
      routine: await prisma.routine.count({ where: { userId: me.id } }),
      routineSkip: await prisma.routineSkip.count({ where: { routineId: routine.id } }),
      event: await prisma.event.count({ where: { userId: me.id } }),
      follow: await prisma.follow.count({ where: { OR: [{ followerId: me.id }, { followingId: me.id }] } }),
      reaction: await prisma.reaction.count({ where: { OR: [{ userId: me.id }, { todoUserId: me.id }] } }),
    };
    expect(left).toEqual({
      user: 0, account: 0, session: 0, category: 0, todo: 0, routine: 0, routineSkip: 0, event: 0, follow: 0, reaction: 0,
    });

    // 친구의 할 일은 남는다(내가 남긴 반응만 사라진다).
    expect(await prisma.todo.count({ where: { id: friendTodo.id } })).toBe(1);
  } finally {
    await prisma.user.delete({ where: { id: friend.id } });
  }
});
