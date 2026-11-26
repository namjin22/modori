import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

// 릴리스 스크린샷 중 2026-11-26에 새로 생긴 화면: 색 고르기(흰색 + 내 색 + +), 새 색 만들기 창(대표 색 12개), 내 색 화면.
// 데모 데이터는 이 파일이 따로 만든다(다른 촬영 파일의 데모 계정과 겹치지 않는다). 번호는 33 뒤로 34부터 붙인다.
// 운영 화면은 찍지 않는다. 테스트 DB에 계정을 만들고 지운다.
const OUT = path.join("docs", "screenshots", process.env.SCREENSHOT_DIR ?? formatKST(todayKST()));
const EMAIL = "screens-colors@modori.test";
const today = todayKST();

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const me = await prisma.user.create({
    data: { email: EMAIL, nickname: "모도리", bio: "매일을 채워가요", privacyAgreedAt: new Date(), createdAt: addDays(today, -60) },
  });
  await prisma.category.create({ data: { userId: me.id, name: "공부", color: "#2563eb", isPublic: true, order: 0 } });
  const exam = await prisma.eventCategory.create({ data: { userId: me.id, name: "시험", color: "#f97316", order: 0 } });
  const school = await prisma.eventCategory.create({ data: { userId: me.id, name: "학교", color: "#7c3aed", order: 1 } });
  await prisma.eventCategory.createMany({
    data: [
      { userId: me.id, name: "약속", color: "#ec4899", order: 2 },
      { userId: me.id, name: "여행", color: "#38bdf8", order: 3 },
      { userId: me.id, name: "동아리", color: "#22c55e", order: 4 },
    ],
  });
  await prisma.event.createMany({
    data: [
      { userId: me.id, title: "수학 수행평가", startDate: addDays(today, 2), endDate: addDays(today, 2), color: exam.color, categoryId: exam.id },
      { userId: me.id, title: "학교 축제", startDate: addDays(today, 6), endDate: addDays(today, 6), color: school.color, categoryId: school.id },
    ],
  });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

/** 창을 페이지 높이만큼 늘려 찍는다(capture.spec.ts의 shoot과 같다). 펼침·나타남 움직임(0.3초)이 끝난 뒤 찍는다. */
async function shoot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("창 크기를 알 수 없다.");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 80 });
  await page.setViewportSize(viewport);
}

/** 창 크기 그대로 한 화면만 찍는다. 떠 있는 창은 열리는 움직임이 끝난 뒤. */
async function shootView(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 80 });
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} 내 색 화면`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(EMAIL);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

    // 34 일정 만들기 창의 색 고르기: 흰색, 내가 만든 색(시험·학교·약속·여행·동아리), 맨 오른쪽 +. 고른 색의 이름이 칸 아래에 보인다.
    await page.getByRole("button", { name: "일정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "새 일정" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("새 일정 이름").fill("영어 듣기평가");
    await dialog.getByRole("radio", { name: "시험", exact: true }).check();
    await shootView(page, `${viewport.name}-34-color-picker`);

    // 35 새 색 만들기 창: 이름과 색(대표 색 12개, 색상 코드, 직접 찍기). 적기만 하고 저장하지 않는다.
    await dialog.getByRole("button", { name: "새 색 만들기" }).click();
    const sheet = page.getByRole("dialog", { name: "새 색 만들기" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("색 이름").fill("동아리 행사");
    await sheet.getByRole("region", { name: "색 목록" }).getByRole("button").nth(8).click();
    await shootView(page, `${viewport.name}-35-new-color`);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 36 내 색 화면: 이름 고치기·색 바꾸기·순서·지우기. 만드는 곳은 색 고르기의 +다.
    await page.goto("/event-categories");
    await expect(page.getByRole("button", { name: "시험 고치기" })).toBeVisible();
    await shoot(page, `${viewport.name}-36-my-colors`);
  });
}
