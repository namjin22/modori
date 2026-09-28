import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { addDays, formatKST, startOfMonthKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

// 운영 화면을 찍지 않는다. 실제 사용자의 할 일이 공개 저장소에 올라간다.
// 테스트 DB에 데모 계정을 만들어 찍고 지운다.
const ME = "screens-me@modori.test";
const FRIEND = "screens-friend@modori.test";

const today = todayKST();
const OUT = path.join("docs", "screenshots", process.env.SCREENSHOT_DIR ?? formatKST(today));

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

type Seeded = { friendId: string };

async function seed(): Promise<Seeded> {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  const joined = { privacyAgreedAt: new Date(), createdAt: addDays(today, -60) };

  const me = await prisma.user.create({
    data: { email: ME, nickname: "모도리", bio: "매일을 채워가요", ...joined },
  });
  const friend = await prisma.user.create({
    data: { email: FRIEND, nickname: "도리친구", bio: "알고리즘 하루 두 문제", ...joined },
  });
  await prisma.follow.createMany({
    data: [
      { followerId: me.id, followingId: friend.id },
      { followerId: friend.id, followingId: me.id },
    ],
  });

  const [study, workout, life] = await Promise.all(
    [
      { name: "공부", color: "#2563eb", isPublic: true },
      { name: "운동", color: "#22c55e", isPublic: true },
      { name: "생활", color: "#f97316", isPublic: false },
    ].map((category, order) => prisma.category.create({ data: { ...category, order, userId: me.id } })),
  );
  const coding = await prisma.category.create({
    data: { name: "코딩", color: "#7c3aed", isPublic: true, order: 0, userId: friend.id },
  });

  const doneAt = new Date();
  const todo = (userId: string, categoryId: string, content: string, done: boolean, order: number) => ({
    userId,
    categoryId,
    content,
    date: today,
    done,
    doneAt: done ? doneAt : null,
    order,
  });
  await prisma.todo.createMany({
    data: [
      todo(me.id, study.id, "수학 문제집 3장", true, 0),
      todo(me.id, study.id, "영어 단어 50개", true, 1),
      todo(me.id, study.id, "정보처리기능사 기출 1회", false, 2),
      todo(me.id, workout.id, "줄넘기 500개", true, 0),
      todo(me.id, workout.id, "스트레칭", false, 1),
      todo(me.id, life.id, "방 정리", false, 0),
      todo(friend.id, coding.id, "알고리즘 2문제", true, 0),
      todo(friend.id, coding.id, "프로젝트 회의", true, 1),
      todo(friend.id, coding.id, "블로그 글 쓰기", false, 2),
    ],
  });

  // 달력이 비어 보이지 않게 이번 달 지난 날에도 할 일을 둔다. 날마다 개수와 끝낸 수를 조금씩 다르게.
  const past: { userId: string; categoryId: string; content: string; date: Date; done: boolean; order: number }[] = [];
  for (let day = startOfMonthKST(today); day < today; day = addDays(day, 1)) {
    const index = day.getUTCDate();
    const count = (index * 7) % 4 + 1;
    for (let order = 0; order < count; order += 1) {
      const categoryId = [study.id, workout.id, life.id][(index + order) % 3];
      past.push({ userId: me.id, categoryId, content: `할 일 ${order + 1}`, date: day, done: order < count - (index % 2), order });
    }
  }
  await prisma.todo.createMany({ data: past });

  await prisma.event.createMany({
    data: [
      { userId: me.id, title: "수행평가 발표", startDate: today, endDate: today, startTime: 14 * 60, endTime: 15 * 60, color: "#dc2626" },
      { userId: me.id, title: "중간고사", startDate: addDays(today, 7), endDate: addDays(today, 10), color: "#7c3aed" },
    ],
  });

  const mine = await prisma.todo.findMany({ where: { userId: me.id, date: today, done: true }, orderBy: { order: "asc" } });
  const theirs = await prisma.todo.findFirstOrThrow({ where: { userId: friend.id, done: true } });
  await prisma.reaction.createMany({
    data: [
      { userId: friend.id, todoId: mine[0].id, todoUserId: me.id, emoji: "dori:happy" },
      { userId: friend.id, todoId: mine[0].id, todoUserId: me.id, emoji: "🔥" },
      { userId: friend.id, todoId: mine[1].id, todoUserId: me.id, emoji: "👍" },
      { userId: me.id, todoId: theirs.id, todoUserId: friend.id, emoji: "dori:love" },
    ],
  });
  // 알림 뱃지가 보이게 반응보다 앞선 시각으로 둔다.
  await prisma.user.update({ where: { id: me.id }, data: { lastSeenAt: addDays(today, -1) } });

  return { friendId: friend.id };
}

/**
 * 창을 페이지 높이만큼 늘려 찍고 되돌린다. fullPage로 찍으면 아래 탭 바(fixed)가 원래 창 높이 자리에 박혀
 * 내용 한가운데를 가린다.
 */
async function shoot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("창 크기를 알 수 없다.");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 80 });
  await page.setViewportSize(viewport);
}

let seeded: Seeded;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  seeded = await seed();
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} 화면`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/login");
    await shoot(page, `${viewport.name}-01-login`);

    await page.getByLabel("테스트 이메일").fill(ME);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    // 데모 계정은 기본 카테고리 대신 직접 만든 카테고리를 쓴다.
    await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

    const screens: [string, string][] = [
      ["02-home", "/"],
      ...(viewport.name === "phone" ? [["03-calendar", "/?view=month"] as [string, string]] : []),
      ["04-social", "/feed"],
      ["05-friend", `/feed/u/${seeded.friendId}`],
      ["06-notifications", "/feed/reactions"],
      ["07-stats", "/stats"],
      ["08-mypage", "/settings"],
    ];
    for (const [name, url] of screens) {
      await page.goto(url);
      await shoot(page, `${viewport.name}-${name}`);
    }

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await shoot(page, `${viewport.name}-09-home-dark`);
  });
}
