import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { TUTORIAL_TEST_HEADER } from "@/lib/tutorial";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 처음 쓰는 사람용 사용법 카드(2026-11-16 요청)와 마이페이지 설정 줄의 설명 글 삭제.
// 시험 서버는 가입 직후 곧바로 홈을 기대하는 시험이 많아 사용법 카드를 자동으로 띄우지 않는다. 이 파일의 첫 묶음만 머리글로 켠다(lib/tutorial.ts).
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-tutorial-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
}

const seenAt = (email: string) => prisma.user.findUniqueOrThrow({ where: { email }, select: { tutorialSeenAt: true } }).then((user) => user.tutorialSeenAt);

test.describe("가입 직후", () => {
  test.use({ extraHTTPHeaders: { [TUTORIAL_TEST_HEADER]: "on" } });

  test("첫 홈은 사용법 카드로 가고, 끝까지 넘기면 홈으로 가며 다시 오지 않는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `사용법${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(page).toHaveURL(/\/welcome$/);
    expect(await seenAt(email)).toBeNull();

    const titles = ["모도리에 오신 걸 환영해요", "할 일 적고 끝내기", "일정과 루틴", "친구와 함께", "설정과 AI 연결"];
    for (const [index, title] of titles.entries()) {
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(`${index + 1} / 5`)).toBeVisible();
      if (index < titles.length - 1) {
        // 건너뛰기는 마지막 카드 앞까지만 있다.
        await expect(page.getByRole("button", { name: "건너뛰기" })).toBeVisible();
        await page.getByRole("button", { name: "다음" }).click();
      }
    }
    await expect(page.getByRole("button", { name: "건너뛰기" })).toHaveCount(0);
    await expect(page.getByText(/사용법 다시 보기/)).toBeVisible();

    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
    await expect(page).not.toHaveURL(/welcome/);
    expect(await seenAt(email)).not.toBeNull();

    // 봤으면 홈은 그대로 열린다.
    await page.reload();
    await expect(homeReady(page)).toBeVisible();
  });

  test("건너뛰어도 봤다고 적고, 좌우 화살표와 이전·점으로 오갈 수 있다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `건너${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(page).toHaveURL(/\/welcome$/);

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 1, name: "할 일 적고 끝내기" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "이전" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "할 일 적고 끝내기" })).toBeVisible();
    await page.getByRole("button", { name: "4 / 5" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "친구와 함께" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { level: 1, name: "일정과 루틴" })).toBeVisible();

    await page.getByRole("button", { name: "건너뛰기" }).click();
    await expect(homeReady(page)).toBeVisible();
    expect(await seenAt(email)).not.toBeNull();
  });

  test("이미 본 사람(이 기능이 생길 때 있던 사용자 포함)은 홈이 그대로 열린다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `기존${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(page).toHaveURL(/\/welcome$/);
    await prisma.user.update({ where: { email }, data: { tutorialSeenAt: new Date() } });
    await page.goto("/");
    await expect(homeReady(page)).toBeVisible();
  });
});

test("설정에서 사용법을 다시 보면 처음 본 시각은 그대로이고 설정으로 돌아온다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `다시${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(homeReady(page)).toBeVisible();
  const first = new Date("2026-11-01T00:00:00Z");
  await prisma.user.update({ where: { email }, data: { tutorialSeenAt: first } });

  await page.goto("/settings/preferences");
  await page.getByRole("link", { name: /사용법 다시 보기/ }).click();
  await expect(page).toHaveURL(/\/welcome\?replay=1$/);
  for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "다음" }).click();
  // 다시 보기의 마지막 단추는 "시작하기"가 아니라 "닫기"다.
  await expect(page.getByRole("button", { name: "시작하기" })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기" }).click();

  await expect(page).toHaveURL(/\/settings\/preferences$/);
  expect(await seenAt(email)).toEqual(first);
});

test("마이페이지의 설정 줄에는 밑에 붙는 설명 글이 없다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `설명${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(homeReady(page)).toBeVisible();
  await page.goto("/settings");
  // 링크의 이름이 "설정" 그대로면 안에 다른 글이 없다.
  await expect(page.getByRole("link", { name: "설정", exact: true })).toBeVisible();
  await expect(page.getByText("화면·알림·친구·시간대")).toHaveCount(0);
});
