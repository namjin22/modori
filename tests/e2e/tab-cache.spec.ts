import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 탭을 다시 열 때 방금 본 화면을 30초 동안 쓴다(next.config.ts staleTimes). 그래도 내가 바꾼 것은
// 탭을 오간 뒤에 낡아 보이면 안 된다.
const TEST_EMAIL = `e2e-tabcache-${RUN_TAG}@modori.test`;

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`탭${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.beforeEach(async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await signInAndOnboard(page);
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

const tab = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

test("탭을 오간 뒤에도 방금 추가하고 끝낸 할 일이 그대로 보인다", async ({ page }) => {
  // 홈을 한 번 보여 둔다(이 화면이 탭 캐시에 남는다).
  await tab(page, "소셜").click();
  await expect(page).toHaveURL(/\/feed/);
  await tab(page, "피드").click();
  await expect(page).toHaveURL("/");

  await addTodo(page, "탭 캐시 확인");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();

  await tab(page, "마이페이지").click();
  await expect(page).toHaveURL(/\/settings/);
  await tab(page, "피드").click();
  await expect(page).toHaveURL("/");

  await expect(page.getByText("탭 캐시 확인")).toBeVisible();
  await expect(page.getByText("1개 중 1개 완료")).toBeVisible();
});
