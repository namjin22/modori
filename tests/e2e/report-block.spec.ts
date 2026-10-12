import { expect, test, type Page } from "@playwright/test";

import { PRIVACY_MANAGER } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { recommendPeople } from "@/lib/recommend";
import { todayKST } from "@/lib/date";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// App Store 심사 지침 1.2: 사용자가 만든 내용이 보이는 앱은 신고와 차단 수단이 있어야 한다.
const ME = `e2e-rb-me-${RUN_TAG}@modori.test`;
const OTHER = `e2e-rb-other-${RUN_TAG}@modori.test`;
const ADMIN = PRIVACY_MANAGER.email;

async function signIn(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

async function setup(page: Page) {
  await prisma.user.deleteMany({ where: { email: { in: [ME, OTHER] } } });
  const other = await prisma.user.create({ data: { email: OTHER, nickname: `상대${RUN_TAG}`, privacyAgreedAt: new Date() } });
  const category = await prisma.category.create({ data: { userId: other.id, name: "공부", color: "#2563eb", order: 0, isPublic: true } });
  const todo = await prisma.todo.create({
    data: { userId: other.id, categoryId: category.id, date: todayKST(), content: "상대의 할 일", done: true, doneAt: new Date(), order: 0 },
  });
  await signIn(page, ME, `나${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  await prisma.follow.create({ data: { followerId: me.id, followingId: other.id } });
  return { me, other, todo };
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, OTHER] } } });
  await prisma.$disconnect();
});

test("신고하면 운영자 화면에 쌓이고, 같은 사람을 하루 안에 다시 신고해도 한 번만 받는다", async ({ page }) => {
  const { me, other } = await setup(page);

  await page.goto(`/feed/u/${other.id}`);
  await page.getByRole("button", { name: /신고·차단$/ }).click();
  await page.getByRole("button", { name: "신고하기", exact: true }).click();
  // 이유를 고르기 전에는 보낼 수 없다.
  const send = page.getByRole("dialog").getByRole("button", { name: "신고하기", exact: true });
  await expect(send).toBeDisabled();
  await page.getByLabel("욕설·괴롭힘").check();
  await page.getByLabel("신고 내용").fill("불쾌한 말을 했어요");
  await send.click();
  await expect(page.getByText("신고했어요. 운영자가 확인할게요.")).toBeVisible();

  const first = await prisma.report.findFirstOrThrow({ where: { reporterId: me.id, reportedId: other.id } });
  expect(first).toMatchObject({ reason: "abuse", detail: "불쾌한 말을 했어요", handledAt: null });

  // 다시 신고해도 한 건이다.
  await page.getByRole("button", { name: /신고·차단$/ }).click();
  await page.getByRole("button", { name: "신고하기", exact: true }).click();
  await page.getByLabel("스팸·광고").check();
  await page.getByRole("dialog").getByRole("button", { name: "신고하기", exact: true }).click();
  await expect(page.getByText("이미 신고했어요. 운영자가 확인할게요.")).toBeVisible();
  expect(await prisma.report.count({ where: { reporterId: me.id, reportedId: other.id } })).toBe(1);
});

test("운영자는 신고를 보고 확인 처리하며, 운영자가 아니면 없는 주소다", async ({ page, browser }) => {
  const { me, other } = await setup(page);
  await prisma.report.create({ data: { reporterId: me.id, reportedId: other.id, reason: "spam", detail: "광고를 올려요" } });

  // 일반 사용자에게는 없는 주소.
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();

  const existing = await prisma.user.findUnique({ where: { email: ADMIN } });
  test.skip(existing !== null, "테스트 DB에 운영자 계정이 이미 있다");
  const context = await browser.newContext();
  const admin = await context.newPage();
  await signIn(admin, ADMIN, `운영${RUN_TAG}`);
  try {
    await admin.goto("/admin/reports");
    const card = admin.getByRole("listitem").filter({ hasText: `상대${RUN_TAG}` }).first();
    await expect(card).toContainText("스팸·광고");
    await expect(card).toContainText("광고를 올려요");
    await expect(card).toContainText("확인 전");
    await card.getByRole("button", { name: "확인했어요" }).click();
    await expect(card).toContainText("처리함");
    expect((await prisma.report.findFirstOrThrow({ where: { reportedId: other.id } })).handledAt).not.toBeNull();
  } finally {
    await prisma.user.deleteMany({ where: { email: ADMIN } });
    await context.close();
  }
});

test("차단하면 서로의 팔로우·반응이 지워지고, 찾기·추천·친구 화면에서 서로 사라지며, 풀면 돌아온다", async ({ page, browser }) => {
  const { me, other, todo } = await setup(page);
  // 서로 팔로우, 서로 반응.
  await prisma.follow.create({ data: { followerId: other.id, followingId: me.id } });
  await prisma.reaction.create({ data: { userId: me.id, todoId: todo.id, todoUserId: other.id, emoji: "👍" } });

  await page.goto(`/feed/u/${other.id}`);
  await expect(page.getByText("상대의 할 일")).toBeVisible();
  await page.getByRole("button", { name: /신고·차단$/ }).click();
  await page.getByRole("button", { name: "차단하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "차단하기", exact: true }).click();
  await expect(page.getByText("차단했어요.")).toBeVisible();
  await expect(page).toHaveURL(/\/feed$/);

  expect(await prisma.block.count({ where: { blockerId: me.id, blockedId: other.id } })).toBe(1);
  expect(await prisma.follow.count({ where: { OR: [{ followerId: me.id }, { followerId: other.id }] } })).toBe(0);
  expect(await prisma.reaction.count({ where: { todoId: todo.id } })).toBe(0);

  // 찾기에서 안 나온다. 추천에도 없다.
  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(`상대${RUN_TAG}`);
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText(`상대${RUN_TAG}`, { exact: true })).toHaveCount(0);
  expect((await recommendPeople(me.id, "seed", 1000)).map((person) => person.id)).not.toContain(other.id);

  // 내가 연 상대 화면은 "차단한 사람"(할 일 없음, 풀기만 가능). 팔로우도 되지 않는다.
  await page.goto(`/feed/u/${other.id}`);
  await expect(page.getByText("차단한 사람이에요")).toBeVisible();
  await expect(page.getByText("상대의 할 일")).toHaveCount(0);

  // 상대 쪽에서는 나를 찾을 수 없고, 내 화면은 없는 주소다.
  const context = await browser.newContext();
  const theirs = await context.newPage();
  await theirs.goto("/login");
  await theirs.getByLabel("테스트 이메일").fill(OTHER);
  await theirs.getByRole("button", { name: "테스트 로그인" }).click();
  await theirs.waitForURL((url) => !url.pathname.startsWith("/login"));
  await theirs.goto(`/feed/u/${me.id}`);
  await expect(theirs.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  await context.close();

  // 마이페이지의 차단한 사용자에서 푼다.
  await page.goto("/settings/blocked");
  await expect(page.getByText(`상대${RUN_TAG}`)).toBeVisible();
  await page.getByRole("button", { name: "차단 풀기" }).click();
  await expect(page.getByText("차단한 사람이 없어요")).toBeVisible();
  expect(await prisma.block.count({ where: { blockerId: me.id } })).toBe(0);

  // 풀면 다시 찾고 팔로우할 수 있다(팔로우와 반응은 돌아오지 않는다).
  await page.goto(`/feed/u/${other.id}`);
  await expect(page.getByRole("button", { name: "팔로우", exact: true })).toBeVisible();
});
