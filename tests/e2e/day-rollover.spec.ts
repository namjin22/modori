import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-rollover-${RUN_TAG}@modori.test`;

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`자정${RUN_TAG}`);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

// 화면의 "오늘"이 브라우저의 오늘과 달라지면(자정을 넘기면) 서버에 새로 그려 달라고 한다.
test("오늘을 보는 화면은 날짜가 바뀌면 다시 그린다", async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await signInAndOnboard(page);

  const refreshed = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/" && request.headers()["rsc"] === "1",
  );
  await page.clock.fastForward("24:01:00");
  await refreshed;
});

test("날짜를 골라 보는 화면은 날짜가 바뀌어도 그대로 둔다", async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await signInAndOnboard(page);
  await page.goto("/?date=2026-01-05");
  await expect(page.getByText("2026-01-05")).toBeVisible();

  let refreshed = false;
  page.on("request", (request) => {
    if (request.headers()["rsc"] === "1" && !request.headers()["next-router-prefetch"]) refreshed = true;
  });
  await page.clock.fastForward("24:01:00");
  await page.waitForTimeout(1500);
  expect(refreshed).toBe(false);
});
