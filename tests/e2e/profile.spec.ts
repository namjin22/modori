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
  await page.getByPlaceholder("닉네임").fill(`처음${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
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

  await page.getByLabel("닉네임").fill(`바꾼${RUN_TAG}`);
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("저장했어요.")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText(`바꾼${RUN_TAG}`)).toBeVisible();
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

  // 목록에도 그 사진이 나온다. 사진은 data URL이 아니라 주소로 내려준다.
  // data URL을 그대로 넣으면 아바타마다 HTML에 9KB씩 실린다.
  await page.goto("/settings");
  const avatar = page.locator(`img[src^="/api/avatar/${saved.id}?v="]`);
  await expect(avatar).toBeVisible();
  // 브라우저가 그 주소로 실제 그림을 받아 그렸는지 본다.
  expect(await avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(128);
  expect(await page.content()).not.toContain("data:image/jpeg;base64");
});

test("사진을 올리지 않으면 도리 얼굴을 쓴다", async ({ page, email }) => {
  const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(saved.profileImage).toBeNull();

  await page.goto("/settings");
  // 기본 프로필은 화면 곳곳의 도리 얼굴을 쓴다(data-avatar로 구분).
  await expect(
    page.locator("a[href='/settings/profile'] [data-avatar='dori'] svg"),
  ).toBeVisible();
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

test("투명 배경 사진은 흰 바탕으로 저장된다", async ({ page }) => {
  await page.goto("/settings/profile");

  // 가운데만 파란 원이고 나머지는 투명한 PNG를 브라우저에서 만든다.
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#2563eb";
    context.beginPath();
    context.arc(100, 100, 50, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png").split(",")[1];
  });
  // 숨은 입력칸에 바로 꽂으면 onChange가 붙기 전에 지나갈 수 있다. 버튼으로 파일 창을 연다.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "사진 고르기" }).click();
  await (await chooser).setFiles({
    name: "transparent.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
  // 버튼 상태는 줄이기 시작 전에도 "사진 고르기"라 기다림 조건이 되지 못한다. 값이 들어올 때까지 본다.
  const field = page.locator("input[name=profileImage]");
  await expect(field).toHaveValue(/^data:image\/jpeg;base64,/);

  const saved = await field.inputValue();
  const corner = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(2, 2, 1, 1).data);
  }, saved);
  // JPEG라 정확히 255는 아닐 수 있다. 검정(0)이 아니라 흰색에 가까우면 된다.
  expect(Math.min(corner[0], corner[1], corner[2])).toBeGreaterThan(240);
});
