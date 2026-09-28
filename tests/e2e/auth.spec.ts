import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 온보딩은 닉네임이 비어 있을 때만 뜨므로, 매 테스트마다 계정을 지우고 시작한다.
// 실제 사람이 쓰지 않는 도메인을 쓴다.
const TEST_EMAIL = `e2e-${RUN_TAG}@modori.test`;

async function removeTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

test.beforeEach(removeTestUser);
test.afterAll(async () => {
  await removeTestUser();
  await prisma.$disconnect();
});

test("로그인하지 않으면 로그인 화면으로 보낸다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "모도리" })).toBeVisible();
});

test("최초 로그인이면 닉네임 온보딩을 거쳐 홈에 도착한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page).toHaveURL("/");
  await expect(homeReady(page)).toBeVisible();
});

test("닉네임이 이미 있으면 온보딩을 건너뛴다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/onboarding");

  await expect(page).toHaveURL("/");
});

test("빈 닉네임은 통과하지 못한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  await page.getByPlaceholder("닉네임").fill("   ");
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page.getByText("닉네임은 1~20자로 적어주세요.")).toBeVisible();
});

test("로그아웃하면 다시 로그인 화면으로 간다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`모도리${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();

  await page.getByRole("link", { name: "마이페이지" }).click();

  // 잘못 눌렀으면 취소하고 그대로 남는다.
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("dialog", { name: "로그아웃할까요?" })).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: "로그아웃" }).click();
  // 한 번 더 묻는 창에서 확인한다.
  await page.getByRole("dialog").getByRole("button", { name: "로그아웃" }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test.describe("개인정보 동의", () => {
  test("동의하지 않으면 가입되지 않고 이유를 알려준다", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.getByPlaceholder("닉네임").fill(`동의${RUN_TAG}`);
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "개인정보 수집·이용에 동의해주세요" })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    expect(user.nickname).toBeNull();
  });

  test("내용을 읽고 동의하면 체크되고, 가입하면 동의 시각이 남는다", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.getByPlaceholder("닉네임").fill(`동의${RUN_TAG}`);

    await page.getByRole("button", { name: "내용 보기" }).click();
    const dialog = page.getByRole("dialog", { name: "개인정보 수집·이용 동의" });
    await expect(dialog.getByText("개인정보 보호책임자")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "penamjin@gmail.com" })).toBeVisible();
    await dialog.getByRole("button", { name: "동의하고 닫기" }).click();
    await expect(page.getByLabel("개인정보 수집·이용에 동의해요")).toBeChecked();

    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    expect(user.privacyAgreedAt).not.toBeNull();
  });

  test("로그인하지 않아도 로그인 화면에서 방침을 볼 수 있다", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "개인정보처리방침" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible();
    await expect(page.getByText("Neon(미국 오하이오)", { exact: false })).toBeVisible();
  });
});
