import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { addDays, formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FRIEND, ME, seed, today } from "./seed";

// 홍보 영상용 화면 녹화(docs/promo/README.md). 사람이 보는 속도로 천천히, 데모 계정으로만 움직인다.
const OUT = path.join("docs", "promo");
const SIZE = { width: 405, height: 720 };

test.use({ viewport: SIZE, video: { mode: "on", size: { width: 810, height: 1440 } } });

const beat = (page: import("@playwright/test").Page, ms = 900) => page.waitForTimeout(ms);

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await seed();
  // "모두 오늘 하기" 장면에서 옮길 것이 있도록 어제 안 끝낸 일을 둔다.
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id, name: "공부" } });
  const yesterday = addDays(today, -1);
  await prisma.todo.deleteMany({ where: { userId: me.id, date: yesterday } });
  await prisma.todo.createMany({
    data: ["영어 독해 1지문", "수학 오답 정리", "한국사 요약"].map((content, order) => ({
      userId: me.id, categoryId: category.id, content, date: yesterday, done: false, order,
    })),
  });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

test("홍보 영상", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

  // 1. 홈
  await beat(page, 3000);

  // 2. 할 일을 적는다
  await page.getByRole("button", { name: "공부에 할 일 쓰기" }).click();
  const input = page.getByLabel("공부 할 일");
  await input.pressSequentially("영어 발표 준비", { delay: 120 });
  await beat(page, 600);
  await input.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "영어 발표 준비" })).toBeVisible();
  await page.keyboard.press("Escape");
  await beat(page, 1500);

  // 3. 체크하면 진행 막대가 찬다
  for (const name of ["정보처리기능사 기출 1회", "스트레칭"]) {
    await page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "완료", exact: true }).click();
    await beat(page, 1400);
  }

  // 4. 어제 못 끝낸 일을 모두 오늘로
  await page.goto(`/?date=${formatKST(addDays(today, -1))}`);
  await beat(page, 1500);
  await page.getByRole("button", { name: /모두 오늘 하기/ }).click();
  await beat(page, 2500);

  // 5. 친구 화면에서 반응
  await page.goto("/feed");
  await beat(page, 1500);
  await page.getByRole("link", { name: /도리친구/ }).first().click();
  await beat(page, 1500);
  const done = page.getByRole("listitem").filter({ hasText: "프로젝트 회의" });
  await done.getByRole("button", { name: "반응 보내기" }).click();
  await beat(page, 1000);
  await page.getByRole("dialog").locator("button[aria-pressed]").first().click();
  await beat(page, 2000);

  // 6. 마지막 장면: 로그인 화면(서비스 이름과 소개가 보인다)
  await page.context().clearCookies();
  await page.goto("/login");
  await beat(page, 3000);

  const video = page.video();
  await page.close();
  await video?.saveAs(path.join(OUT, "modori-promo.webm"));
});
