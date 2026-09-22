import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-reorder-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("드래그로 할 일 순서를 바꾼다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `정렬${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await addTodo(page, "첫째");
  await addTodo(page, "둘째");
  await addTodo(page, "셋째");

  const items = page.getByRole("listitem");
  await expect(items.nth(0)).toContainText("첫째");
  await expect(items.nth(2)).toContainText("셋째");

  // 첫 항목의 손잡이를 잡아 마지막 항목 아래로 옮긴다.
  const handle = items.nth(0).getByRole("button", { name: "순서 바꾸기 손잡이" });
  const target = items.nth(2);

  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("좌표를 구하지 못했다");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole("listitem").nth(2)).toContainText("첫째");

  // 저장이 끝나기 전에 새로고침하면 요청 자체가 끊긴다. 끝날 때까지 기다린다.
  await expect(page.locator("ul[aria-busy]")).toHaveAttribute("aria-busy", "false");

  // 새로고침해도 유지되어야 진짜 저장된 것이다.
  await page.reload();
  await expect(page.getByRole("listitem").nth(2)).toContainText("첫째");
});

test("같은 닉네임은 다른 사람이 가져갈 수 없다", async ({ page }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  const first = `e2e-nick-a-${tag}-${RUN_TAG}@modori.test`;
  const second = `e2e-nick-b-${tag}-${RUN_TAG}@modori.test`;
  const nickname = `겹치는${tag}${RUN_TAG}`;

  await prisma.user.deleteMany({ where: { email: { in: [first, second] } } });

  try {
    await signInAndOnboard(page, first, nickname);

    await page.goto("/settings");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("테스트 이메일").fill(second);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.getByPlaceholder("닉네임").fill(nickname);
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(
      page.getByText("이미 쓰고 있는 닉네임이에요. 다른 이름으로 해주세요."),
    ).toBeVisible();

    // 다른 이름으로는 들어간다
    await page.getByPlaceholder("닉네임").fill(`${nickname}2`);
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [first, second] } } });
  }
});
