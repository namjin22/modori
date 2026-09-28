import { expect, test as base, type Locator, type Page } from "@playwright/test";

import { addDays, daysInMonthKST, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 폰에서 손가락으로 끄는 경우. 마우스 테스트만으로는 화면이 대신 스크롤되거나(touch-action)
// 포인터가 취소되는 문제를 잡지 못한다. Chromium에 실제 터치 이벤트를 보낸다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-touch-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.afterAll(async () => {
  await prisma.$disconnect();
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

/** 손가락을 from에 대고 to까지 천천히 끈 뒤 뗀다. */
async function touchDrag(page: Page, from: Locator, to: Locator, dy = 0) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("끌 곳을 찾지 못했다");
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 + dy };
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  // 누르고 조금 기다렸다 움직인다. 사람 손가락처럼.
  await page.waitForTimeout(150);
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    const point = {
      x: start.x + ((end.x - start.x) * step) / steps,
      y: start.y + ((end.y - start.y) * step) / steps,
    };
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    await page.waitForTimeout(20);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

const categoryNames = async (userId: string) =>
  (await prisma.category.findMany({ where: { userId }, orderBy: { order: "asc" } })).map((c) => c.name);

test("손가락으로 달력의 일정 이름을 끌어 기간을 늘린다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `터치일정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();
  const forward = today.getUTCDate() + 2 <= daysInMonthKST(today);
  const target = addDays(today, forward ? 2 : -2);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.event.create({
    data: { userId: user.id, title: "손가락 일정", startDate: today, endDate: today, color: "#2563eb" },
  });

  // 폰에서는 "달력"을 펴야 한 달 달력이 나온다.
  await page.goto("/?view=month");
  const cell = (date: Date) => page.getByRole("link", { name: new RegExp(`^${date.getUTCDate()}일, 완료`) });
  await touchDrag(page, cell(today).locator("[data-event-id]"), cell(target));

  await expect
    .poll(async () => {
      const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id } });
      return [formatKST(event.startDate), formatKST(event.endDate)];
    })
    .toEqual(forward ? [formatKST(today), formatKST(target)] : [formatKST(target), formatKST(today)]);
});

test("손가락으로 할 일 손잡이를 끌어 순서를 바꾼다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `터치할일${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: ["하나", "둘", "셋"].map((content, order) => ({
      userId: user.id,
      categoryId: category.id,
      content,
      date: todayKST(),
      order,
    })),
  });
  await page.reload();

  // 할 일 이름은 눌러 고치는 버튼이다. 화면 순서대로 나온다.
  const names = page.getByRole("button", { name: /^(하나|둘|셋)$/ });
  const handle = (text: string) =>
    page.getByRole("listitem").filter({ hasText: text }).getByRole("button", { name: "순서 바꾸기 손잡이" });
  await expect(page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` })).toBeVisible();
  await touchDrag(page, handle("셋"), handle("하나"), -8);

  await expect
    .poll(async () =>
      (await prisma.todo.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } })).map((t) => t.content),
    )
    .toEqual(["셋", "하나", "둘"]);
  await expect(names.first()).toHaveText("셋");
});

test("손가락으로 카테고리 손잡이를 끌어 순서를 바꾼다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `터치분류${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.category.createMany({
    data: [
      { userId: user.id, name: "공부", color: "#22c55e", order: 1 },
      { userId: user.id, name: "운동", color: "#f97316", order: 2 },
    ],
  });
  await page.goto("/categories");
  const handle = (name: string) =>
    page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "순서 바꾸기 손잡이" });
  await touchDrag(page, handle("운동"), handle(FIRST_CATEGORY), -10);

  await expect.poll(() => categoryNames(user.id)).toEqual(["운동", FIRST_CATEGORY, "공부"]);
});
