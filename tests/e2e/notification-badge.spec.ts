import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const ME = `e2e-badge-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-badge-friend-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

test("알림을 열었다가 링크로 돌아오면 아래 탭의 알림 수가 바로 사라진다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`뱃지${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  const friend = await prisma.user.create({
    data: { email: FRIEND, nickname: `뱃친${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id } });

  await page.goto("/feed");
  const tabBadge = page.getByRole("navigation").last().getByLabel(/안 읽은 알림/);
  await expect(tabBadge).toHaveAttribute("aria-label", "안 읽은 알림 1개");

  // 새로 불러오지 않고 링크로만 오간다(실제로 쓰는 방식).
  await page.getByRole("link", { name: /^알림/ }).click();
  await expect(page.getByRole("heading", { name: "알림" })).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: "나를 팔로우했어요" });
  await expect(item).toContainText("NEW");

  await page.getByRole("link", { name: "소셜로" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByLabel(/안 읽은 알림/)).toHaveCount(0);

  // 피드 탭으로 옮겨도 다시 생기지 않는다.
  await page.getByRole("link", { name: "피드" }).click();
  await expect(homeReady(page)).toBeVisible();
  await expect(page.getByLabel(/안 읽은 알림/)).toHaveCount(0);
});
