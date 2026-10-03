import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, addTodo, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const TEST_EMAIL = `e2e-offline-${RUN_TAG}@modori.test`;
const FAILED = "인터넷에 연결되어 있지 않아요. 연결된 뒤 다시 해주세요.";

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

async function signInAndOnboard(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`연결${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.beforeEach(async ({ page }) => {
  await removeTestUser();
  await signInAndOnboard(page);
});

test.afterAll(async () => {
  await removeTestUser();
  await prisma.$disconnect();
});

test("연결이 끊긴 채 할 일을 적으면 화면과 적던 글자가 남는다", async ({ page, context }) => {
  await page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` }).click();
  const input = page.getByLabel(`${FIRST_CATEGORY} 할 일`);

  await context.setOffline(true);
  await input.fill("지하철에서 적은 할 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(input).toHaveValue("지하철에서 적은 할 일");

  // 다시 연결되면 그대로 Enter만 누르면 된다.
  await context.setOffline(false);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "지하철에서 적은 할 일", exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
});

test("연결이 끊긴 채 체크하면 체크가 돌아가고 알림이 뜬다", async ({ page, context }) => {
  await addTodo(page, "체크할 일");

  await context.setOffline(true);
  await page.getByRole("button", { name: "완료", exact: true }).click();

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(page.getByRole("button", { name: "완료", exact: true })).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});

test("연결이 끊긴 채 할 일을 고치면 창과 고친 글자가 남는다", async ({ page, context }) => {
  await addTodo(page, "고칠 일");
  await openTodo(page, "고칠 일");
  const input = page.getByLabel("할 일 내용 수정");

  await context.setOffline(true);
  await input.fill("고친 일");
  await input.press("Enter");

  await expect(page.getByRole("status", { name: "알림" })).toContainText(FAILED);
  await expect(input).toHaveValue("고친 일");
});

test("연결은 되는데 서버가 응답하지 못하면(오래 열어 둔 화면) 새로고침을 안내한다", async ({ page }) => {
  await addTodo(page, "오래된 화면에서 체크");

  // 앱이 새 버전으로 바뀌어 옛 화면의 서버 액션을 알아보지 못하는 상황을 흉내 낸다.
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 404, body: "" }) : route.continue(),
  );
  await page.getByRole("button", { name: "완료", exact: true }).click();

  const alert = page.getByRole("status", { name: "알림" });
  await expect(alert).toContainText("화면이 오래돼서 저장하지 못했어요. 새로고침하면 해결돼요.");
  await expect(alert).not.toContainText("인터넷");

  // 새로고침을 누르면 화면을 다시 불러온다(체크는 저장되지 않았으니 그대로 안 한 상태).
  await page.unroute("**/*");
  await alert.getByRole("button", { name: "새로고침" }).click();
  await expect(page.getByRole("button", { name: "완료", exact: true })).toBeVisible();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
});
