import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-layout-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("탭은 피드, 소셜, 마이페이지 셋이고 카테고리와 루틴은 피드에 속한다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `탭${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const tabs = page.getByRole("navigation").last().getByRole("link");
  await expect(tabs).toHaveText(["피드", "소셜", "마이페이지"]);

  // 넓은 화면에서는 달력과 목록이 한 화면에 같이 있다.
  await expect(page.getByRole("link", { name: /일, 완료 (있음|없음)$/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "루틴", exact: true }).click();
  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByRole("link", { name: "피드", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // 마이페이지에는 카테고리·루틴이 없고, 테마는 라이트와 다크뿐이다.
  await page.getByRole("link", { name: "마이페이지", exact: true }).click();
  await expect(page.getByRole("link", { name: /카테고리 관리|루틴 관리/ })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveText(["라이트", "다크"]);

  await page.getByRole("radio", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("radio", { name: "다크" })).toHaveAttribute("aria-checked", "true");
});

test("예전 주소로 들어와도 옮긴 화면으로 간다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `옛${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings/categories");
  await expect(page).toHaveURL(/\/categories$/);
  await page.goto("/settings/routines");
  await expect(page).toHaveURL(/\/routines$/);
});

test.describe("좁은 화면", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("달력은 눌렀을 때만 펼친다", async ({ page, email }, testInfo) => {
    await signInAndOnboard(page, email, `좁${testInfo.testId.slice(-6)}${RUN_TAG}`);

    const monthDay = page.getByRole("link", { name: /일, 완료 (있음|없음)$/ }).first();
    await expect(monthDay).toBeHidden();
    await expect(page.getByRole("navigation", { name: "주간 날짜" })).toBeVisible();

    await page.getByRole("link", { name: "달력 펼치기" }).click();
    await expect(monthDay).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주간 날짜" })).toBeHidden();

    await page.getByRole("link", { name: "달력 접기" }).click();
    await expect(monthDay).toBeHidden();
  });
});

test("가장 좁은 폰(320px)에서 루틴 폼을 열어도 가로로 넘치지 않는다", async ({ page, email }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signInAndOnboard(page, email, `좁폼${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByRole("radio", { name: "매월" }).click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // 루틴은 카테고리 안에 들어간다. 고르지 않아도 첫 카테고리가 잡혀 있다.
  await expect(page.getByLabel("루틴 카테고리")).not.toHaveValue("");
});

test("넓은 화면에서 할 일이 많아 스크롤해도 왼쪽 달력은 제자리에 있다", async ({ page, email }, testInfo) => {
  // 노트북처럼 창이 낮으면 달력 칸이 페이지 끝에서 밀려 올라갔다. 스크롤 시작 때도 8px 움직였다.
  await page.setViewportSize({ width: 1366, height: 620 });
  await signInAndOnboard(page, email, `고정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id } });
  await prisma.todo.createMany({
    data: Array.from({ length: 30 }, (_, order) => ({
      userId: user.id,
      categoryId: category.id,
      content: `할 일 ${order}`,
      date: todayKST(),
      order,
    })),
  });
  await page.reload();

  const monthHeading = page.getByRole("heading", { level: 2, name: /년 \d+월/ });
  const tops: number[] = [];
  for (const y of [0, 200, 600, 100_000]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    // 고정 시간만 기다리면 PC가 바쁠 때 스크롤이 끝나기 전에 쟀다(전체 E2E를 병렬로 돌리면 가끔 실패).
    // 스크롤이 목표(또는 맨 끝)에 닿은 뒤, 화면이 두 프레임 그려질 때까지 기다린 다음 잰다.
    await page.waitForFunction((top) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.abs(window.scrollY - Math.min(top, max)) < 1;
    }, y);
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    tops.push(Math.round((await monthHeading.boundingBox())?.y ?? -1));
  }
  expect(new Set(tops).size).toBe(1);
});
