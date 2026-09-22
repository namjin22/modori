import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-profile-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill("처음닉네임");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.beforeEach(async ({ page, email }) => {
  await signInAndOnboard(page, email);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("닉네임을 바꿀 수 있다", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /프로필 수정/ }).click();

  await page.getByLabel("닉네임").fill("바꾼닉네임");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("저장했어요.")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("바꾼닉네임")).toBeVisible();
});

test("올린 사진이 프로필에 남는다", async ({ page, email }) => {
  await page.goto("/settings/profile");

  // 버튼으로 고른다. 숨은 입력칸에 파일만 꽂으면 아직 붙지 않은 onChange를
  // 놓쳐서 아무 일도 일어나지 않는다. 버튼이 열리는 것은 붙었다는 뜻이다.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "사진 고르기" }).click();
  // 1×1 빨간 점 PNG. 브라우저가 128×128 JPEG로 줄여서 보낸다.
  await (
    await chooser
  ).setFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  // 줄이는 일이 끝나야 값이 폼에 붙는다. 미리보기가 바뀌는 것을 기다린다.
  await expect(page.locator("fieldset img")).toBeVisible();

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했어요.")).toBeVisible();

  const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(saved.profileImage).toMatch(/^data:image\/jpeg;base64,/);

  // 목록에도 그 사진이 나온다.
  await page.goto("/settings");
  await expect(page.locator(`img[src="${saved.profileImage}"]`)).toBeVisible();
});

test("사진을 올리지 않으면 도리 얼굴을 쓴다", async ({ page, email }) => {
  const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(saved.profileImage).toBeNull();

  await page.goto("/settings");
  await expect(page.locator("a[href='/settings/profile'] svg")).toBeVisible();
});

test("빈 닉네임은 거절한다", async ({ page }) => {
  await page.goto("/settings/profile");

  await page.getByLabel("닉네임").fill("   ");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("닉네임을 입력해주세요.")).toBeVisible();
});

test("요일을 고르지 않은 매주 루틴은 이유를 알려준다", async ({ page }) => {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();

  await page.getByLabel("루틴 내용").fill("요일 없는 루틴");
  await page.getByRole("radio", { name: "매주" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();

  await expect(
    page.getByText("반복할 요일을 하나 이상 골라주세요."),
  ).toBeVisible();
});

test("없는 주소는 안내 화면을 보여준다", async ({ page }) => {
  await page.goto("/이런주소는없다");

  await expect(page.getByText("없는 주소예요")).toBeVisible();
  await expect(page.getByRole("link", { name: "오늘 화면으로" })).toBeVisible();
});
