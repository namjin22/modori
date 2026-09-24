import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, addTodo, homeReady, openCategory } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-archived-${testInfo.testId}-${RUN_TAG}@modori.test`;
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
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("카테고리를 보관해도 그 카테고리의 할 일은 이름을 달고 남는다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `보관${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await addTodo(page, "보관 전에 만든 일");
  await expect(page.getByText("보관 전에 만든 일")).toBeVisible();

  // 묶음 머리에 카테고리 이름이 보인다.
  const group = page.locator("section").filter({ hasText: "보관 전에 만든 일" });
  await expect(group.locator(`span:text-is("${FIRST_CATEGORY}")`)).toBeVisible();

  await page.goto("/categories");
  // 보관하기는 카테고리 줄을 눌러 뜬 창 안에 있다.
  await openCategory(page, FIRST_CATEGORY);
  await page.getByRole("button", { name: "보관하기" }).click();
  await expect(page.getByText("보관함")).toBeVisible();

  await page.goto("/");
  // 할 일은 그대로 있고, 묶음 이름도 그대로다. 카테고리가 살아 있는 묶음 뒤로 간다.
  const groupAfter = page.locator("section").filter({ hasText: "보관 전에 만든 일" });
  await expect(groupAfter.getByText("보관 전에 만든 일")).toBeVisible();
  await expect(groupAfter.locator(`span:text-is("${FIRST_CATEGORY}")`)).toBeVisible();

  // 새 할 일을 적을 칩도 사라진다.
  await expect(
    page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` }),
  ).toHaveCount(0);
});

test("카테고리를 보관하는 동안 그 카테고리의 루틴은 할 일을 만들지 않는다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `루틴${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  const second = await prisma.category.create({
    data: { userId: user.id, name: "남는 칸", color: "#22c55e", order: 1 },
  });
  const today = todayKST();
  await prisma.routine.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      content: "매일 단어 외우기",
      freq: "DAILY",
      byWeekday: [],
      byMonthday: [],
      startDate: today,
      order: 0,
    },
  });
  await prisma.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } });

  await page.goto("/");
  await expect(page.getByRole("button", { name: `${second.name}에 할 일 쓰기` })).toBeVisible();
  await expect(page.getByText("매일 단어 외우기")).toHaveCount(0);

  // 루틴 화면에서는 왜 멈췄는지 보인다.
  await page.goto("/routines");
  await expect(page.getByText("카테고리 보관 중")).toBeVisible();

  // 되살리면 다시 돈다.
  await page.goto("/categories");
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: `${FIRST_CATEGORY} 고치기` })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "매일 단어 외우기", exact: true })).toBeVisible();
});
