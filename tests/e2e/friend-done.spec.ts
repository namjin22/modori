import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 친구가 할 일을 끝냈을 때의 알림(2026-10-17 요청): 소셜 알림 목록·하단 탭 숫자, 앱에서는 푸시 받기 스위치.
const APP_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";

const test = base.extend<{ emails: { me: string; friend: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-done-me-${tag}-${RUN_TAG}@modori.test`, friend: `e2e-done-you-${tag}-${RUN_TAG}@modori.test` };
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await provide(emails);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
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
  await expect(homeReady(page)).toBeVisible();
}

async function friendWithCategories(email: string, nickname: string) {
  return prisma.user.create({
    data: {
      email,
      nickname,
      categories: {
        create: [
          { name: "공부", color: "#2563eb", order: 0, isPublic: true },
          { name: "비밀", color: "#7c3aed", order: 1, isPublic: false },
        ],
      },
    },
    include: { categories: true },
  });
}

test("친구가 공개 카테고리에서 끝낸 일이 알림 목록에 친구·날짜별로 묶여 뜨고, 숫자 API가 새 소식을 센다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나끝${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const friend = await friendWithCategories(emails.friend, `친끝${tag}${RUN_TAG}`);
  const open = friend.categories.find((category) => category.isPublic)!;
  const secret = friend.categories.find((category) => !category.isPublic)!;
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  const unread = async () => (await (await page.request.get("/api/notifications/unread")).json()).count as number;
  // 알림을 1분 전에 봤고, 친구는 그 뒤(30초 전쯤)에 끝냈다. 끝낸 시각을 미래로 두면 알림을 봐도 계속 새 소식이 된다.
  const now = Date.now();
  await prisma.user.update({ where: { id: me.id }, data: { lastSeenAt: new Date(now - 60_000) } });
  expect(await unread()).toBe(0);

  const today = todayKST();
  await prisma.todo.createMany({
    data: [
      { userId: friend.id, categoryId: open.id, date: today, content: "수학 문제집", done: true, doneAt: new Date(now - 40_000), order: 0 },
      { userId: friend.id, categoryId: open.id, date: today, content: "영어 단어", done: true, doneAt: new Date(now - 30_000), order: 1 },
      { userId: friend.id, categoryId: secret.id, date: today, content: "비밀 일", done: true, doneAt: new Date(now - 20_000), order: 2 },
    ],
  });
  // 끝낸 일 둘이지만 친구 한 명이라 1로 센다.
  await expect.poll(unread).toBe(1);

  await page.goto("/feed/reactions");
  const row = page.getByRole("listitem").filter({ hasText: `친끝${tag}${RUN_TAG}님이 할 일 2개를 끝냈어요` });
  await expect(row).toBeVisible();
  await expect(row).toContainText("영어 단어 외 1개");
  await expect(page.getByText("비밀 일")).toHaveCount(0);
  // 알림 화면을 보면 읽은 것으로 친다.
  await expect.poll(unread).toBe(0);
});

test.describe("앱", () => {
  test.use({ userAgent: APP_UA, viewport: { width: 390, height: 844 } });

  test("마이페이지에서 친구 끝냄 푸시를 끄고 켠다(기본은 켜짐)", async ({ page, emails }, testInfo) => {
    await signUp(page, emails.me, `나푸${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const saved = async () => (await prisma.user.findUniqueOrThrow({ where: { email: emails.me } })).notifyFriendDone;
    await page.goto("/settings");
    const toggle = page.getByRole("checkbox", { name: /친구가 할 일을 끝내면 알림/ });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect.poll(saved).toBe(false);
    await toggle.check();
    await expect.poll(saved).toBe(true);
  });
});
