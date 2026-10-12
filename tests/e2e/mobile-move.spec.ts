import { expect, test as base } from "@playwright/test";

import { formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo, FIRST_CATEGORY, homeReady, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 폰에서 할 일·일정을 옮기기 어렵다는 요청(끌다가 화면이 스크롤된다). 쓸면 스크롤, 잠깐 누르고 끌면 끌기, 끌지 않고 옮기는 길.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-mobilemove-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signUp(page: import("@playwright/test").Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test("일정 이름 위에서 손가락을 바로 쓸면 끌기가 아니라 스크롤이라 일정 기간이 바뀌지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `쓸기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();
  await prisma.event.create({ data: { userId: user.id, title: "쓸어도 그대로", startDate: today, endDate: today, color: "#2563eb" } });
  await page.reload();

  const chip = page.locator(`a[data-date="${formatKST(today)}"] [data-event-id]`);
  await expect(chip).toBeVisible();
  const box = await chip.boundingBox();
  if (!box) throw new Error("일정 이름을 찾지 못했다");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const client = await page.context().newCDPSession(page);
  // 누르자마자(기다리지 않고) 위로 쓸어 올린다.
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y - step * 25 }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();

  await page.waitForTimeout(800);
  await expect(page.locator("[data-drag-range]")).toHaveCount(0);
  const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id } });
  expect([formatKST(event.startDate), formatKST(event.endDate)]).toEqual([formatKST(today), formatKST(today)]);
});

test("할 일 창에서 카테고리를 골라 끌지 않고 다른 카테고리로 옮긴다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `분류옮김${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.category.create({ data: { userId: user.id, name: "운동", color: "#f97316", order: 1 } });
  await page.reload();
  await addTodo(page, "줄넘기");

  await openTodo(page, "줄넘기");
  const select = page.getByLabel("할 일 카테고리");
  await expect(select).toHaveValue((await prisma.category.findFirstOrThrow({ where: { userId: user.id, name: FIRST_CATEGORY } })).id);
  await select.selectOption({ label: "운동" });
  await page.getByRole("button", { name: "저장", exact: true }).click();

  // 창이 닫히고, 줄이 운동 칩 아래(운동 묶음)로 간다. 묶음 순서는 오늘 → 운동이다.
  await expect(page.getByLabel("할 일 카테고리")).toHaveCount(0);
  const below = async () => {
    const chip = await page.getByRole("button", { name: "운동에 할 일 쓰기" }).boundingBox();
    const row = await page.getByRole("listitem").filter({ hasText: "줄넘기" }).boundingBox();
    return Boolean(chip && row && row.y > chip.y);
  };
  await expect.poll(below).toBe(true);
  await expect
    .poll(async () => (await prisma.todo.findFirstOrThrow({ where: { userId: user.id, content: "줄넘기" }, include: { category: true } })).category?.name)
    .toBe("운동");
  await page.reload();
  await expect.poll(below).toBe(true);
});

test("폰에서 할 일 줄을 짧게 누르면 창이 열리고, 길게 누르지 않고 쓸면 순서가 바뀌지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `짧게${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: ["첫째", "둘째"].map((content, order) => ({ userId: user.id, categoryId: category.id, content, date: todayKST(), order })),
  });
  await page.reload();

  // 짧게 누르면(탭) 할 일 창이 열린다. 창에는 길게 누르는 법이 적혀 있다.
  await page.getByRole("button", { name: "둘째", exact: true }).tap();
  await expect(page.getByLabel("할 일 내용 수정")).toBeVisible();
  await expect(page.getByText("할 일을 길게 누르면 집혀서")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("할 일 내용 수정")).toHaveCount(0);

  // 바로 쓸어 올린다(누르고 기다리지 않음): 집히지 않는다.
  // (시험 도구가 보내는 스와이프 뒤에는 탭이 먹지 않아 탭을 먼저 본다. 예전 코드에서도 같다.)
  const row = page.getByRole("listitem").filter({ hasText: "둘째" });
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  if (!box) throw new Error("줄을 찾지 못했다");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let step = 1; step <= 6; step += 1) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y - step * 15 }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(800);
  expect((await prisma.todo.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } })).map((todo) => todo.content)).toEqual([
    "첫째",
    "둘째",
  ]);
});
