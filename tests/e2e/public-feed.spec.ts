import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 공개 피드(2026-10-19): 모르는 사람도 보는 "끝낸 할 일 + 짧은 글", 이모지 반응, 신고·차단·운영자 숨김. 시험 서버는 PUBLIC_FEED=on으로 연다.
const test = base.extend<{ emails: { me: string; stranger: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-pub-me-${tag}-${RUN_TAG}@modori.test`, stranger: `e2e-pub-you-${tag}-${RUN_TAG}@modori.test` };
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

/** 팔로우하지 않은 사람이 오늘 끝낸 할 일로 글을 올려 둔다. */
async function strangerWithPost(email: string, nickname: string, body: string) {
  const stranger = await prisma.user.create({
    data: { email, nickname, categories: { create: { name: "공부", color: "#2563eb", order: 0 } } },
    include: { categories: true },
  });
  const post = await prisma.post.create({ data: { userId: stranger.id, todoContent: "모르는 사람이 끝낸 일", todoColor: "#22c55e", body } });
  return { stranger, post };
}

test("오늘 끝낸 할 일과 짧은 글을 올리면 모두의 피드 맨 위에 뜨고, 내 글은 지울 수 있다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나피${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me }, include: { categories: true } });
  await prisma.todo.create({ data: { userId: me.id, categoryId: me.categories[0].id, date: todayKST(), content: "수학 3장 끝", done: true, doneAt: new Date(), order: 0 } });

  // 하단 탭은 화면을 미리 받아 둔다. DB에 직접 넣은 할 일이 보이게 홈을 다시 연다(화면에서 체크하면 저절로 비워진다).
  await page.reload();
  // 하단 소셜 탭은 모두의 피드부터 연다. 위에 [모두의 피드 | 내 친구] 탭이 있다.
  await page.getByRole("link", { name: "소셜", exact: true }).click();
  await expect(page).toHaveURL(/\/feed\/public$/);
  await expect(page.getByRole("navigation", { name: "소셜 보기" }).getByRole("link", { name: "모두의 피드" })).toHaveAttribute("aria-current", "page");

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await expect(composer.getByRole("radio", { name: /수학 3장 끝/ })).toHaveAttribute("aria-checked", "true");
  await composer.getByLabel("피드 글").fill("오늘은 집중이 잘 됐다");
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("피드에 올렸어요.");

  const feed = page.getByRole("list", { name: "피드 글" });
  const first = feed.getByRole("listitem").first();
  await expect(first).toContainText("수학 3장 끝");
  await expect(first).toContainText("오늘은 집중이 잘 됐다");
  await first.getByRole("button", { name: "지우기" }).click();
  await expect.poll(async () => prisma.post.count({ where: { userId: me.id } })).toBe(0);

  // 내 친구 탭은 예전 소셜 화면이다.
  await page.getByRole("navigation", { name: "소셜 보기" }).getByRole("link", { name: "내 친구" }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("모르는 사람의 글을 보고 반응하고 신고하면 그 글이 신고에 남는다. 차단하거나 운영자가 숨기면 사라진다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나신${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const { stranger, post } = await strangerWithPost(emails.stranger, `남${tag}${RUN_TAG}`, "처음 보는 사람의 글");

  await page.goto("/feed/public");
  const card = page.getByRole("list", { name: "피드 글" }).getByRole("listitem").filter({ hasText: "처음 보는 사람의 글" });
  await expect(card).toBeVisible();

  // 이모지 반응
  await card.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("tab", { name: "이모지" }).click();
  await page.getByRole("button", { name: "좋아요" }).click();
  await expect.poll(async () => prisma.postReaction.count({ where: { postId: post.id, userId: me.id } })).toBe(1);

  // 신고하면 그 글이 같이 남는다.
  await card.getByRole("button", { name: /신고·차단$/ }).click();
  await page.getByRole("button", { name: "신고하기", exact: true }).click();
  await page.getByLabel("스팸·광고").check();
  await page.getByRole("dialog").getByRole("button", { name: "신고하기", exact: true }).click();
  await expect(page.getByText("신고했어요. 운영자가 확인할게요.")).toBeVisible();
  expect((await prisma.report.findFirstOrThrow({ where: { reporterId: me.id, reportedId: stranger.id } })).postId).toBe(post.id);

  // 운영자가 숨기면 보이지 않는다.
  await prisma.post.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
  await page.reload();
  await expect(page.getByText("처음 보는 사람의 글")).toHaveCount(0);

  // 차단한 사람의 글도 보이지 않는다.
  const second = await prisma.post.create({ data: { userId: stranger.id, todoContent: "또 끝낸 일", body: "두 번째 글" } });
  await page.reload();
  await expect(page.getByText("두 번째 글")).toBeVisible();
  await prisma.block.create({ data: { blockerId: me.id, blockedId: stranger.id } });
  await page.reload();
  await expect(page.getByText("두 번째 글")).toHaveCount(0);
  expect(second.id).toBeTruthy();
});

test("오늘 끝낸 일이 없으면 올리는 칸 대신 안내가 보인다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나없${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/feed/public");
  await expect(page.getByText("오늘 할 일을 하나 끝내면 여기서 피드에 올릴 수 있어요.")).toBeVisible();
  await expect(page.getByRole("form", { name: "피드에 올리기" })).toHaveCount(0);
});
