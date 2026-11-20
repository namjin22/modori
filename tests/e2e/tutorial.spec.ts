import { expect, test as base, type Locator, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { TUTORIAL_TEST_HEADER } from "@/lib/tutorial";

import { RUN_TAG } from "./run-tag";
import { addTodo, homeReady } from "./todo-helpers";

// 처음 쓰는 사람용 둘러보기(2026-11-16 요청: 사용법 카드가 약관 같아서, 실제 홈 화면의 버튼을 하나씩 짚어 주는 안내로 바꿨다)와
// 마이페이지 설정 줄의 설명 글 삭제.
// 시험 서버는 가입 직후 곧바로 홈을 쓰길 기대하는 시험이 많아(안내가 화면을 덮는다) 둘러보기를 자동으로 띄우지 않는다. 이 파일의 묶음만 머리글로 켠다(lib/tutorial.ts).
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

/** 처음 가입한 계정의 홈에서 차례로 짚는 곳. 할 일이 없으니 "할 일 줄" 단계는 없다. */
const NEW_USER_STEPS = [
  { title: "모도리 둘러보기", target: null },
  { title: "내 프로필", target: "profile" },
  { title: "달력", target: "calendar" },
  // 일기와 AI 도우미 단계(2026-11-20): 일기 카드는 달력 밑, AI 도우미 버튼은 관리 버튼 옆에 있다.
  { title: "일기", target: "diary" },
  { title: "날짜 넘기기", target: "day-nav" },
  { title: "AI 도우미", target: "ai" },
  { title: "관리", target: "manage" },
  { title: "일정", target: "events" },
  { title: "카테고리 칩", target: "category" },
  { title: "소셜", target: "tab-social" },
  { title: "마이페이지", target: "tab-myPage" },
] as const;

const PAD = 6;

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "모도리 둘러보기" });

/** 밝게 뚫린 곳이 짚으려는 요소와 같은 자리인지(둘레 여백만큼 크다). 단계를 옮기면 구멍이 미끄러져 가므로 자리 잡을 때까지 기다린다. */
async function expectSpotOn(page: Page, selector: string) {
  await expect
    .poll(
      async () => {
        const spot = await page.locator("[data-tour-spot]").boundingBox();
        const target = await page.locator(selector).first().boundingBox();
        if (!spot || !target) return "측정 못 함";
        const off = [spot.x - (target.x - PAD), spot.y - (target.y - PAD), spot.width - (target.width + PAD * 2), spot.height - (target.height + PAD * 2)];
        return off.every((value) => Math.abs(value) < 2) ? "맞음" : `어긋남 ${off.map((value) => Math.round(value)).join(",")}`;
      },
      { timeout: 5_000, message: `${selector}를 짚고 있어야 한다` },
    )
    .toBe("맞음");
}

async function expectInside(box: { x: number; y: number; width: number; height: number } | null, viewport: { width: number; height: number }, what: string) {
  expect(box, `${what}를 잴 수 있어야 한다`).not.toBeNull();
  if (!box) return;
  expect(box.x, `${what} 왼쪽`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${what} 위`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what} 오른쪽`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `${what} 아래`).toBeLessThanOrEqual(viewport.height + 0.5);
}

/** 단계마다: 제목이 맞고, 구멍이 그 요소를 짚고, 말풍선이 화면 안에 있으며, 말풍선이 짚은 요소를 가리지 않는다. */
async function walkThrough(page: Page, steps: readonly { title: string; target: string | null }[]) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("뷰포트를 알 수 없다.");
  const dialog = dialogOf(page);

  for (const [index, step] of steps.entries()) {
    await expect(dialog.getByRole("heading", { name: step.title, exact: true })).toBeVisible();
    await expect(dialog.getByText(`${index + 1} / ${steps.length}`)).toBeVisible();

    if (step.target) {
      const selector = `[data-tour="${step.target}"]`;
      await expectSpotOn(page, selector);
      // 짚은 곳이 화면 안에 올라와 있어야 한다(스크롤을 막아 둔 채로도 단계를 옮길 때 올라온다).
      await expectInside(await page.locator(selector).first().boundingBox(), viewport, `${step.title}의 짚은 곳`);
      const box = await dialog.boundingBox();
      await expectInside(box, viewport, `${step.title}의 말풍선`);
      // 자리가 없어 화면 끝에 둔 말풍선(edge)이 아니면 짚은 곳과 겹치면 안 된다: 위·아래면 세로로, 옆이면 가로로 떨어져 있어야 한다.
      const side = await dialog.getAttribute("data-tour-side");
      const target = await page.locator(selector).first().boundingBox();
      if (side && !side.startsWith("edge") && box && target) {
        const overlapY = Math.min(box.y + box.height, target.y + target.height) - Math.max(box.y, target.y);
        const overlapX = Math.min(box.x + box.width, target.x + target.width) - Math.max(box.x, target.x);
        const overlap = side === "left" || side === "right" ? overlapX : overlapY;
        expect(overlap, `${step.title}: 말풍선(${side})이 짚은 곳을 가린다`).toBeLessThanOrEqual(0);
      }
    } else {
      await expectInside(await dialog.boundingBox(), viewport, `${step.title}의 말풍선`);
    }

    if (index < steps.length - 1) await dialog.getByRole("button", { name: index === 0 ? "시작하기" : "다음", exact: true }).click();
  }
}

test.describe("가입 직후", () => {
  test.use({ extraHTTPHeaders: { [TUTORIAL_TEST_HEADER]: "on" } });

  test("첫 홈에서 단계마다 실제 버튼을 짚고, 끝내면 다시 뜨지 않는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `둘러${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    // 안내 뒤의 홈은 실제 화면이다(다른 화면으로 가지 않았다).
    await expect(page).toHaveURL(/\/$/);
    expect(await seenAt(email)).toBeNull();

    await walkThrough(page, NEW_USER_STEPS);

    // 건너뛰기는 마지막 단계에는 없다.
    await expect(dialog.getByRole("button", { name: "건너뛰기" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "끝내기" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(homeReady(page)).toBeVisible();
    await expect.poll(() => seenAt(email)).not.toBeNull();

    // 봤으면 새로고침해도 뜨지 않고, 뒤 화면은 다시 눌린다.
    await page.reload();
    await expect(homeReady(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await homeReady(page).click();
    await expect(page.getByLabel("오늘 할 일")).toBeVisible();
  });

  test("안내가 떠 있는 동안 뒤 화면은 눌리지 않고, 건너뛰어도 봤다고 적는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `건너${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();

    // 카테고리 칩이 있는 바로 그 자리를 눌러도 안내가 받아서 입력칸이 열리지 않는다.
    const chip = await homeReady(page).boundingBox();
    if (!chip) throw new Error("카테고리 칩의 자리를 잴 수 없다.");
    await page.mouse.click(chip.x + chip.width / 2, chip.y + chip.height / 2);
    await expect(page.getByLabel("오늘 할 일")).toHaveCount(0);

    await dialog.getByRole("button", { name: "시작하기" }).click();
    await expect(dialog.getByRole("heading", { name: "내 프로필" })).toBeVisible();
    await dialog.getByRole("button", { name: "건너뛰기" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => seenAt(email)).not.toBeNull();
  });

  test("좌우 화살표로 오가고, Esc로 닫으면 봤다고 적는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `키보드${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("heading", { name: "내 프로필" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("heading", { name: "달력" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByRole("heading", { name: "내 프로필" })).toBeVisible();
    await dialog.getByRole("button", { name: "이전" }).click();
    await expect(dialog.getByRole("heading", { name: "모도리 둘러보기" })).toBeVisible();
    // 처음 단계에는 "이전"이 없다.
    await expect(dialog.getByRole("button", { name: "이전" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => seenAt(email)).not.toBeNull();
  });

  test("이미 본 사람(이 기능이 생길 때 있던 사용자 포함)에게는 뜨지 않는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `기존${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(dialogOf(page)).toBeVisible();
    await prisma.user.update({ where: { email }, data: { tutorialSeenAt: new Date() } });
    await page.goto("/");
    await expect(homeReady(page)).toBeVisible();
    await expect(dialogOf(page)).toHaveCount(0);
  });
});

test.describe("가입 직후, 폰 화면", () => {
  test.use({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { [TUTORIAL_TEST_HEADER]: "on" } });

  test("좁은 화면에서도 짚은 곳과 말풍선이 모두 화면 안에 있다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `폰${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(dialogOf(page)).toBeVisible();
    await walkThrough(page, NEW_USER_STEPS);
    await dialogOf(page).getByRole("button", { name: "끝내기" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  });
});

test.describe("설정에서 다시 보기", () => {
  test("처음 본 시각은 그대로이고, 끝내면 주소의 ?tour=1이 떨어진다. 할 일이 있으면 할 일 줄도 짚는다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `다시${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await expect(homeReady(page)).toBeVisible();
    await addTodo(page, "둘러보기 할 일");
    const first = new Date("2026-11-01T00:00:00Z");
    await prisma.user.update({ where: { email }, data: { tutorialSeenAt: first } });

    await page.goto("/settings/preferences");
    await page.getByRole("link", { name: /사용법 다시 보기/ }).click();
    await expect(page).toHaveURL(/\/\?tour=1$/);
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();

    // 할 일이 있는 계정이라 "카테고리 칩" 다음에 "할 일 줄"이 끼어든다.
    // 일기·AI 도우미 단계가 늘어(2026-11-20) "카테고리 칩"은 아홉 번째다.
    const withTodo = [...NEW_USER_STEPS.slice(0, 9), { title: "할 일 줄", target: "todo-row" }, ...NEW_USER_STEPS.slice(9)];
    await walkThrough(page, withTodo);
    await dialog.getByRole("button", { name: "끝내기" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    expect(await seenAt(email)).toEqual(first);
  });
});

test("마이페이지의 설정 줄에는 밑에 붙는 설명 글이 없다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `설명${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(homeReady(page)).toBeVisible();
  await page.goto("/settings");
  // 링크의 이름이 "설정" 그대로면 안에 다른 글이 없다.
  await expect(page.getByRole("link", { name: "설정", exact: true })).toBeVisible();
  await expect(page.getByText("화면·알림·친구·시간대")).toHaveCount(0);
});

test("화면 테마와 언어는 설정 안이 아니라 마이페이지에 있다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `밖에${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(homeReady(page)).toBeVisible();
  await page.goto("/settings");
  const theme: Locator = page.getByRole("radiogroup", { name: "화면 테마" });
  await expect(theme).toBeVisible();
  await expect(page.locator("[data-language-select]")).toBeVisible();

  await page.goto("/settings/preferences");
  await expect(page.getByRole("radiogroup", { name: "화면 테마" })).toHaveCount(0);
  await expect(page.locator("[data-language-select]")).toHaveCount(0);
});
