import { expect, test as base, type Page } from "@playwright/test";

import { formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 일정과 메모의 공개 스위치(2026-10-17): 친구가 켠 일정·메모만 팔로워에게 보이고, 끈 것은 브라우저로 보내지도 않는다.
const test = base.extend<{ emails: { me: string; friend: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-share-me-${tag}-${RUN_TAG}@modori.test`, friend: `e2e-share-you-${tag}-${RUN_TAG}@modori.test` };
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

test("친구가 공개로 켠 일정·반복 일정·메모만 보이고, 끈 것은 화면에도 페이지 데이터에도 없다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나공${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const today = todayKST();
  const friend = await prisma.user.create({
    data: {
      email: emails.friend,
      nickname: `친공${tag}${RUN_TAG}`,
      categories: { create: { name: "공부", color: "#2563eb", order: 0, isPublic: true } },
    },
    include: { categories: true },
  });
  const category = friend.categories[0];
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });
  await prisma.todo.createMany({
    data: [
      { userId: friend.id, categoryId: category.id, date: today, content: "공개 메모 할 일", memo: "보이는 할 일 메모", memoPublic: true, order: 0 },
      // 2026-10-18부터 기본값이 공개라, 숨길 것은 비공개를 적어 둔다.
      { userId: friend.id, categoryId: category.id, date: today, content: "비공개 메모 할 일", memo: "숨은 할 일 메모", memoPublic: false, order: 1 },
    ],
  });
  await prisma.event.createMany({
    data: [
      { userId: friend.id, title: "공개 일정", startDate: today, endDate: today, color: "#dc2626", isPublic: true, memo: "보이는 일정 메모", memoPublic: true },
      { userId: friend.id, title: "공개 일정 숨은 메모", startDate: today, endDate: today, color: "#22c55e", isPublic: true, memo: "숨은 일정 메모", memoPublic: false },
      { userId: friend.id, title: "비공개 일정", startDate: today, endDate: today, color: "#7c3aed", isPublic: false },
    ],
  });
  await prisma.eventRoutine.createMany({
    data: [
      { userId: friend.id, title: "공개 학원", color: "#2563eb", freq: "DAILY", startDate: today, isPublic: true },
      { userId: friend.id, title: "비공개 학원", color: "#2563eb", freq: "DAILY", startDate: today, isPublic: false },
    ],
  });

  const response = await page.goto(`/feed/u/${friend.id}`);
  const html = (await response?.text()) ?? "";
  const events = page.getByRole("region", { name: "친구 일정" });
  await expect(events.getByText("공개 일정", { exact: true })).toBeVisible();
  await expect(events).toContainText("보이는 일정 메모");
  await expect(events.getByText("공개 일정 숨은 메모")).toBeVisible();
  await expect(events.getByText("공개 학원", { exact: true })).toBeVisible();
  await expect(page.getByText("보이는 할 일 메모")).toBeVisible();
  await expect(page.locator(`[data-date="${formatKST(today)}"]`)).toContainText("공개 일정");

  // 끈 것은 화면에 없고, 페이지와 함께 보낸 데이터에도 들어 있지 않다.
  for (const hidden of ["비공개 일정", "숨은 일정 메모", "비공개 학원", "숨은 할 일 메모"]) {
    await expect(page.getByText(hidden, { exact: true })).toHaveCount(0);
    expect(html).not.toContain(hidden);
  }
});

test("새 일정·메모는 공개로 시작하고(비공개 스위치 꺼짐), 비공개를 켜면 숨겨 저장된다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나켜${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });

  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("보이는 시험");
  // 2026-10-18부터 "비공개" 스위치다. 기본은 공개(꺼짐)다.
  await expect(page.getByRole("checkbox", { name: /^비공개/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^메모 비공개/ })).not.toBeChecked();
  await page.getByLabel("새 일정 이름").press("Enter");
  await expect.poll(async () => (await prisma.event.findFirst({ where: { userId: me.id, title: "보이는 시험" } }))?.isPublic).toBe(true);

  await page.getByRole("button", { name: "+ 일정 더 적기" }).click();
  await page.getByLabel("새 일정 이름").fill("숨긴 병원");
  await page.getByRole("checkbox", { name: /^비공개/ }).check();
  await expect(page.getByRole("checkbox", { name: /^메모 비공개/ })).toHaveCount(0);
  await page.getByLabel("새 일정 이름").press("Enter");
  await expect.poll(async () => (await prisma.event.findFirst({ where: { userId: me.id, title: "숨긴 병원" } }))?.isPublic).toBe(false);

  await addTodo(page, "메모 공개할 일");
  await page.getByRole("button", { name: "메모 공개할 일", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "할 일" });
  // 메모도 기본은 공개다. 비공개를 켜야 숨는다.
  await expect(dialog.getByRole("checkbox", { name: /^메모 비공개/ })).not.toBeChecked();
  await dialog.getByLabel("할 일 메모").fill("친구도 보는 메모");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect
    .poll(async () => prisma.todo.findFirst({ where: { userId: me.id, content: "메모 공개할 일" }, select: { memo: true, memoPublic: true } }))
    .toEqual({ memo: "친구도 보는 메모", memoPublic: true });

  await page.getByRole("button", { name: /^메모 공개할 일/ }).first().click();
  const again = page.getByRole("dialog", { name: "할 일" });
  await again.getByRole("checkbox", { name: /^메모 비공개/ }).check();
  await again.getByRole("button", { name: "저장" }).click();
  await expect
    .poll(async () => (await prisma.todo.findFirst({ where: { userId: me.id, content: "메모 공개할 일" } }))?.memoPublic)
    .toBe(false);
});
