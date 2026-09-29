import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const ME = `e2e-ffl-me-${RUN_TAG}@modori.test`;
const FRIEND = `e2e-ffl-friend-${RUN_TAG}@modori.test`;
const OTHER = `e2e-ffl-other-${RUN_TAG}@modori.test`;
const STRANGER = `e2e-ffl-stranger-${RUN_TAG}@modori.test`;
const EMAILS = [ME, FRIEND, OTHER, STRANGER];

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.$disconnect();
});

test("친구 화면에서 친구의 팔로우·팔로워 목록을 보고, 모르는 사람은 그 자리에서 팔로우한다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  const joined = { privacyAgreedAt: new Date() };
  const [friend, other] = await Promise.all([
    prisma.user.create({ data: { email: FRIEND, nickname: `친구${RUN_TAG}`, ...joined } }),
    prisma.user.create({ data: { email: OTHER, nickname: `다른${RUN_TAG}`, ...joined } }),
    prisma.user.create({ data: { email: STRANGER, nickname: `남남${RUN_TAG}`, ...joined } }),
  ]);

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`나${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });

  // 나 → 친구, 친구 ↔ 다른 사람. 나는 다른 사람을 아직 팔로우하지 않았다.
  await prisma.follow.createMany({
    data: [
      { followerId: me.id, followingId: friend.id },
      { followerId: friend.id, followingId: other.id },
      { followerId: other.id, followingId: friend.id },
    ],
  });

  await page.goto(`/feed/u/${friend.id}`);
  await expect(page.getByRole("link", { name: "팔로우 1" })).toBeVisible();
  await page.getByRole("link", { name: "팔로워 2" }).click();
  await expect(page.getByRole("heading", { name: `친구${RUN_TAG}의 팔로워` })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: `나${RUN_TAG}` })).toContainText("나");

  await page.getByRole("link", { name: /화면으로/ }).click();
  await page.getByRole("link", { name: "팔로우 1" }).click();
  await expect(page.getByRole("heading", { name: `친구${RUN_TAG}의 팔로우` })).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: `다른${RUN_TAG}` });
  // 아직 팔로우하지 않은 사람은 화면 링크 대신 팔로우 버튼이 있다.
  await expect(row.getByRole("link")).toHaveCount(0);
  await row.getByRole("button", { name: "팔로우" }).click();
  await expect(row).toContainText("팔로우 중");
  await expect(row.getByRole("link", { name: `다른${RUN_TAG}` })).toHaveAttribute("href", `/feed/u/${other.id}`);
  expect(await prisma.follow.count({ where: { followerId: me.id, followingId: other.id } })).toBe(1);
});

test("팔로우하지 않은 사람의 목록은 없는 주소다", async ({ page }) => {
  const friend = await prisma.user.findUniqueOrThrow({ where: { email: FRIEND } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(STRANGER);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  for (const kind of ["following", "followers"]) {
    await page.goto(`/feed/u/${friend.id}/${kind}`);
    await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  }
});
