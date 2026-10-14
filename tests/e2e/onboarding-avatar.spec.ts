import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-avatar-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

// 1×1 빨간 점 PNG. 브라우저가 128×128 JPEG로 줄여서 보낸다.
const RED_DOT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function startOnboarding(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
}

async function pickPhoto(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("radio", { name: "내 사진" }).click();
  await (await chooser).setFiles({ name: "me.png", mimeType: "image/png", buffer: RED_DOT });
  await expect(page.getByRole("radio", { name: "내 사진" })).toHaveAttribute("aria-checked", "true");
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("가입할 때 아무것도 고르지 않으면 도리로 시작한다", async ({ page, email }, testInfo) => {
  await startOnboarding(page, email, `도리${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(page.getByRole("radio", { name: "도리" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).profileImage).toBeNull();
});

test("가입할 때 내 사진을 고르면 그 사진으로 시작한다", async ({ page, email }, testInfo) => {
  await startOnboarding(page, email, `사진${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await pickPhoto(page);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).profileImage).toMatch(/^data:image\/jpeg;base64,/);
});

test("사진을 골랐다가 도리로 바꾸면 사진 없이 시작한다", async ({ page, email }, testInfo) => {
  await startOnboarding(page, email, `바꿈${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await pickPhoto(page);
  await page.getByRole("radio", { name: "도리" }).click();
  await expect(page.getByRole("radio", { name: "도리" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).profileImage).toBeNull();
});

test("가입할 때 캐릭터(몽이)를 고르면 그 캐릭터로 시작한다", async ({ page, email }, testInfo) => {
  await startOnboarding(page, email, `몽이${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByRole("radio", { name: "몽이" }).click();
  await expect(page.getByRole("radio", { name: "몽이" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(saved.avatarCharacter).toBe("mong");
  expect(saved.profileImage).toBeNull();
  await expect(page.locator("[data-avatar='mong'] svg").first()).toBeVisible();
});

test.describe("좁은 폰 화면", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("프로필 사진 칸을 옆으로 넘겨도 화면 전체가 넓어지지 않고 칸 안에서만 넘어간다", async ({ page, email }, testInfo) => {
    await startOnboarding(page, email, `폭${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const widths = await page.evaluate(() => {
      const group = document.querySelector('[role="radiogroup"]');
      if (!(group instanceof HTMLElement)) throw new Error("프로필 사진 칸이 없다.");
      return {
        page: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
        groupScroll: group.scrollWidth,
        groupClient: group.clientWidth,
      };
    });
    expect(widths.page).toBeLessThanOrEqual(widths.view);
    expect(widths.groupScroll).toBeGreaterThan(widths.groupClient);
  });
});

test.describe("좁은 폰 화면(마이페이지)", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("마이페이지 프로필 수정에서도 사진 칸만 옆으로 넘어가고 화면과 카드는 그대로다", async ({ page, email }, testInfo) => {
    await startOnboarding(page, email, `프필${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
    await page.goto("/settings/profile");
    await expect(page.getByRole("radiogroup", { name: "프로필 사진" })).toBeVisible();
    const widths = await page.evaluate(() => {
      const group = document.querySelector('[role="radiogroup"]');
      if (!(group instanceof HTMLElement)) throw new Error("프로필 사진 칸이 없다.");
      const card = group.closest("section");
      return {
        page: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
        pageHeightOk: document.documentElement.scrollHeight >= document.documentElement.clientHeight,
        card: card?.getBoundingClientRect().right ?? 0,
        groupScroll: group.scrollWidth,
        groupClient: group.clientWidth,
      };
    });
    expect(widths.page).toBeLessThanOrEqual(widths.view);
    expect(widths.card).toBeLessThanOrEqual(widths.view);
    expect(widths.groupScroll).toBeGreaterThan(widths.groupClient);
  });
});
