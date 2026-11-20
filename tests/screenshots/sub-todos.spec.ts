import { mkdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

// 릴리스 스크린샷 중 2026-11-17~20에 새로 생긴 화면(세부 할 일, 일정 팝업·다가오는 일정, AI 도우미 제안, 둘러보기의 새 단계).
// 데모 데이터는 이 파일이 따로 만든다(capture.spec.ts의 데모 계정과 겹치지 않는다). 번호는 capture.spec.ts의 21~24 뒤로 25부터 붙인다.
// 운영 화면은 찍지 않는다. 테스트 DB에 계정을 만들고 지운다.
const OUT = path.join("docs", "screenshots", process.env.SCREENSHOT_DIR ?? formatKST(todayKST()));
const EMAIL = "screens-sub@modori.test";
const AI_PORT = 3199;
const today = todayKST();

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

let server: Server;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  // 진짜 AI 서비스를 부르지 않는다. 어떤 말에도 세부 할 일이 달린 제안을 돌려주는 가짜 서버다(playwright.config.ts가 AI_API_BASE를 이 포트로 돌려 둔다).
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const plan = {
        reply: "정보처리기능사 필기를 4주 안에 준비하는 계획으로 짜 봤어요. 큰 일 밑에 세부 할 일을 달았어요.",
        declined: false,
        todos: [
          { content: "기출문제 1회분 풀기", date: formatKST(addDays(today, 1)), category: "공부", subTodos: ["1과목 오답 정리", "2과목 오답 정리", "틀린 문제 다시 풀기"] },
          { content: "개념 노트 정리", date: formatKST(addDays(today, 2)), category: "공부", subTodos: ["데이터베이스", "운영체제"] },
        ],
        events: [{ title: "정보처리기능사 필기", startDate: formatKST(addDays(today, 28)), endDate: formatKST(addDays(today, 28)), startTime: "10:00", endTime: "11:00" }],
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(plan) }, finish_reason: "stop" }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(AI_PORT, "127.0.0.1", resolve));

  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const me = await prisma.user.create({
    data: { email: EMAIL, nickname: "모도리", bio: "매일을 채워가요", privacyAgreedAt: new Date(), createdAt: addDays(today, -60), aiChatConsentAt: new Date() },
  });
  const study = await prisma.category.create({ data: { userId: me.id, name: "공부", color: "#2563eb", isPublic: true, order: 0 } });
  const life = await prisma.category.create({ data: { userId: me.id, name: "생활", color: "#f97316", isPublic: false, order: 1 } });
  const big = await prisma.todo.create({ data: { userId: me.id, categoryId: study.id, content: "포트폴리오 완성", date: today, order: 0 } });
  const kids = ["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"];
  for (const [index, content] of kids.entries()) {
    await prisma.todo.create({
      data: { userId: me.id, categoryId: study.id, parentId: big.id, content, date: today, order: index + 1, ...(index === 0 && { done: true, doneAt: new Date() }) },
    });
  }
  await prisma.todo.createMany({
    data: [
      { userId: me.id, categoryId: study.id, content: "영어 단어 50개", date: today, order: 10, done: true, doneAt: new Date() },
      { userId: me.id, categoryId: life.id, content: "장보기", date: today, order: 0 },
    ],
  });
  await prisma.event.createMany({
    data: [
      { userId: me.id, title: "수행평가 발표", startDate: today, endDate: today, startTime: 14 * 60, endTime: 15 * 60, color: "#dc2626" },
      { userId: me.id, title: "중간고사", startDate: addDays(today, 3), endDate: addDays(today, 5), color: "#7c3aed" },
      { userId: me.id, title: "동아리 발표회", startDate: addDays(today, 9), endDate: addDays(today, 9), startTime: 16 * 60, endTime: 18 * 60, color: "#22c55e" },
      { userId: me.id, title: "정보처리기능사 필기", startDate: addDays(today, 28), endDate: addDays(today, 28), startTime: 10 * 60, endTime: 11 * 60, color: "#2563eb" },
    ],
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

/** 창을 페이지 높이만큼 늘려 찍는다(capture.spec.ts의 shoot과 같다). 펼침·나타남 움직임(0.3초)이 끝난 뒤 찍는다(안 기다리면 흐리게 찍혔다). */
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

/** 창 크기 그대로 한 화면만 찍는다. 떠 있는 창·둘러보기는 열리는 움직임이 끝난 뒤. */
async function shootView(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 80 });
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} 새 화면`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(EMAIL);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

    // 25 홈: 큰 할 일 밑의 세부 할 일과 끝낸 개수(1/3).
    await page.goto("/");
    await expect(page.getByRole("list", { name: "포트폴리오 완성의 세부 할 일" })).toBeVisible();
    await shoot(page, `${viewport.name}-25-sub-todos`);

    // 26 큰 할 일 창: 세부 할 일 입력칸.
    await page.getByRole("button", { name: "포트폴리오 완성", exact: true }).click();
    await expect(page.getByLabel("포트폴리오 완성의 세부 할 일 이름")).toBeVisible();
    await shootView(page, `${viewport.name}-26-sub-todo-sheet`);
    await page.keyboard.press("Escape");

    // 27 일정 만들기는 팝업으로 뜬다. 28 다가오는 일정은 제목 옆 토글로 한꺼번에 펼친다.
    await page.getByRole("button", { name: "일정", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "새 일정" })).toBeVisible();
    await shootView(page, `${viewport.name}-27-event-popup`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /다가오는 일정 \d+개 펼치기/ }).click();
    await expect(page.locator("#upcoming-events")).toBeVisible();
    await shoot(page, `${viewport.name}-28-upcoming-events`);

    // 29 AI 도우미 제안: 큰 할 일 밑에 세부 할 일이 들여 보인다.
    await page.goto("/ai");
    await page.getByLabel("AI에게 보낼 말").fill("4주 안에 정보처리기능사 필기를 준비하고 싶어");
    await page.getByRole("button", { name: "보내기", exact: true }).click();
    await expect(page.getByRole("region", { name: "이렇게 넣을까요?" })).toBeVisible();
    await shoot(page, `${viewport.name}-29-ai-proposal`);

    // 30·31 둘러보기의 새 단계: 일기, AI 도우미.
    await page.goto("/?tour=1");
    const tour = page.getByRole("dialog", { name: "모도리 둘러보기" });
    await expect(tour).toBeVisible();
    for (const [title, name] of [
      ["일기", "30-tour-diary"],
      ["AI 도우미", "31-tour-ai"],
    ] as const) {
      while (!(await tour.getByRole("heading", { name: title, exact: true }).isVisible())) {
        await tour.getByRole("button", { name: /^(시작하기|다음)$/ }).click();
      }
      await shootView(page, `${viewport.name}-${name}`);
    }
    await page.keyboard.press("Escape");
  });
}
