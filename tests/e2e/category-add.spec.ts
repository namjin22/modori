import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-catadd-${testInfo.testId}@modori.test`;
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
  await expect(page.getByLabel("할 일 내용", { exact: true })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("카테고리 옆 +로 그 카테고리에 연달아 적는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `칩${testInfo.testId.slice(-6)}`);

  // 할 일이 없어도 카테고리 칩은 보인다.
  for (const name of ["공부", "운동", "생활"]) {
    await expect(page.getByRole("button", { name: `${name}에 할 일 쓰기` })).toBeVisible();
  }

  await page.getByRole("button", { name: "운동에 할 일 쓰기" }).click();
  const input = page.getByLabel("운동 할 일");
  await input.fill("스쿼트 30개");
  await input.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "스쿼트 30개" })).toBeVisible();

  // 입력칸은 비워진 채 열려 있어서 바로 다음 것을 적는다.
  await expect(input).toHaveValue("");
  await input.fill("플랭크 1분");
  await input.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "플랭크 1분" })).toBeVisible();

  await input.press("Escape");
  await expect(input).toBeHidden();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const todos = await prisma.todo.findMany({
    where: { userId: user.id },
    include: { category: true },
    orderBy: { order: "asc" },
  });
  expect(todos.map((todo) => [todo.content, todo.category?.name])).toEqual([
    ["스쿼트 30개", "운동"],
    ["플랭크 1분", "운동"],
  ]);
});

test("못 한 일은 내일로 넘긴다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `내일${testInfo.testId.slice(-6)}`);

  await page.getByLabel("할 일 내용", { exact: true }).fill("영단어 외우기");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "영단어 외우기" });
  await expect(row).toBeVisible();

  await row.getByText("수정").click();
  await row.getByRole("button", { name: "내일로" }).click();
  await expect(page.getByText("아직 할 일이 없어요")).toBeVisible();

  await page.goto(`/?date=${formatKST(addDays(todayKST(), 1))}`);
  await expect(page.getByRole("listitem").filter({ hasText: "영단어 외우기" })).toBeVisible();
});
