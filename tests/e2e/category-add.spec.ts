import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addCategory, FIRST_CATEGORY, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-catadd-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("카테고리 옆 +로 그 카테고리에 연달아 적는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `칩${testInfo.testId.slice(-6)}${RUN_TAG}`);

  // 할 일이 없어도 카테고리 칩은 보인다.
  await expect(
    page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` }),
  ).toBeVisible();

  await addCategory(page, "운동");
  await page.goto("/");

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

test("카테고리를 만들 때 공개 여부를 정한다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `공개${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/categories");

  await page.getByLabel("새 카테고리 이름").fill("비밀 공부");
  await page.getByLabel("친구 피드에 보이기").uncheck();
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("button", { name: "비밀 공부 고치기" })).toContainText("비공개");

  // 기본값은 공개다.
  await page.getByLabel("새 카테고리 이름").fill("동아리");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("button", { name: "동아리 고치기" })).not.toContainText("비공개");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const categories = await prisma.category.findMany({ where: { userId: user.id }, select: { name: true, isPublic: true } });
  expect(categories.find((category) => category.name === "동아리")?.isPublic).toBe(true);
  expect(categories.find((category) => category.name.startsWith("비밀"))?.isPublic).toBe(false);
});

test("카테고리는 손잡이를 끌어 순서를 바꾸고, 피드 묶음도 그 순서를 따른다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `순서${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.category.createMany({
    data: [
      { userId: user.id, name: "공부", color: "#22c55e", order: 1 },
      { userId: user.id, name: "운동", color: "#f97316", order: 2 },
    ],
  });
  await page.goto("/categories");
  const handleOf = (name: string) =>
    page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "순서 바꾸기 손잡이" });
  const names = () => page.getByRole("button", { name: /고치기$/ }).allTextContents();

  // 마우스로 "운동"을 맨 위로 끈다.
  const from = await handleOf("운동").boundingBox();
  const to = await handleOf(FIRST_CATEGORY).boundingBox();
  if (!from || !to) throw new Error("손잡이를 찾지 못했다");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y - 10, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await names())[0]).toContain("운동");
  await expect
    .poll(async () =>
      (await prisma.category.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } })).map((c) => c.name),
    )
    .toEqual(["운동", FIRST_CATEGORY, "공부"]);

  // 키보드로 "공부"를 한 칸 위로.
  // dnd-kit은 집은 뒤 다음 틱에 방향키를 받는다(keyboard-reorder.spec과 같다). 안내를 보고 누른다.
  const announcer = page.locator('[id^="DndLiveRegion"]');
  await handleOf("공부").focus();
  await page.keyboard.press("Space");
  await expect(announcer).toContainText("3번째 자리로 옮기는 중");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await expect(announcer).toContainText("2번째 자리로 옮기는 중");
  await page.keyboard.press("Space");
  await expect
    .poll(async () =>
      (await prisma.category.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } })).map((c) => c.name),
    )
    .toEqual(["운동", "공부", FIRST_CATEGORY]);

  // 피드의 카테고리 칩도 같은 순서로 선다.
  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();
  const chips = await page.getByRole("button", { name: /에 할 일 쓰기$/ }).allTextContents();
  expect(chips.map((text) => text.trim())).toEqual(["운동", "공부", FIRST_CATEGORY]);
});
