import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-a11y-${RUN_TAG}@modori.test`;

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`접근${RUN_TAG}`);
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

test("넓은 화면에서 첫 Tab으로 달력을 건너뛰어 할 일로 간다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInAndOnboard(page);
  await page.reload();
  await expect(homeReady(page)).toBeVisible();
  // 새로 고친 뒤 포커스가 어디 남아 있든 문서 처음에서 시작한다.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "할 일로 건너뛰기" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page.locator("#day-list")).toBeFocused();
  // 다음 Tab은 달력 날짜가 아니라 할 일 쪽으로 간다.
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.closest("#day-list") !== null);
  expect(focused).toBe(true);
});
