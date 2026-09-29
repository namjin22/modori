import { expect, test } from "@playwright/test";

import { todayKST } from "@/lib/date";
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
  // 아직 팔로우하지 않은 사람도 눌러 볼 수 있고(팔로우 안내가 뜬다), 그 자리에서 팔로우하는 버튼도 있다.
  await expect(row.getByRole("link", { name: `다른${RUN_TAG}` })).toHaveAttribute("href", `/feed/u/${other.id}`);
  await row.getByRole("button", { name: "팔로우" }).click();
  await expect(row).toContainText("팔로우 중");
  await expect(row.getByRole("link", { name: `다른${RUN_TAG}` })).toHaveAttribute("href", `/feed/u/${other.id}`);
  expect(await prisma.follow.count({ where: { followerId: me.id, followingId: other.id } })).toBe(1);
});

test("팔로우하지 않은 사람의 목록은 없는 주소다", async ({ page }) => {
  // 앞 테스트에 기대지 않고 자기 데이터를 만든다(앞이 실패해 정리되면 이 테스트까지 연쇄로 실패했다).
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  const joined = { privacyAgreedAt: new Date() };
  const [friend] = await Promise.all([
    prisma.user.create({ data: { email: FRIEND, nickname: `친구${RUN_TAG}`, ...joined } }),
    prisma.user.create({ data: { email: STRANGER, nickname: `남남${RUN_TAG}`, ...joined } }),
  ]);
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(STRANGER);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  for (const kind of ["following", "followers"]) {
    await page.goto(`/feed/u/${friend.id}/${kind}`);
    await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  }
});

test("이미 팔로우한 사람 화면에서 언팔로우하면 팔로우 안내로 바뀌고, 다시 팔로우하면 할 일이 보인다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  const joined = { privacyAgreedAt: new Date() };
  const friend = await prisma.user.create({ data: { email: FRIEND, nickname: `친구${RUN_TAG}`, bio: "비밀 소개", ...joined } });
  const category = await prisma.category.create({ data: { userId: friend.id, name: "공개", color: "#22c55e", order: 0, isPublic: true } });
  await prisma.todo.create({
    data: { userId: friend.id, categoryId: category.id, content: "친구의 오늘 할 일", date: todayKST(), done: false },
  });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`나${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  await page.goto(`/feed/u/${friend.id}`);
  await expect(page.getByText("친구의 오늘 할 일")).toBeVisible();
  await page.getByRole("button", { name: "언팔로우" }).click();

  // 끊으면 할 일·소개는 사라지고 팔로우 안내가 뜬다.
  await expect(page.getByText("할 일을 볼 수 있어요")).toBeVisible();
  await expect(page.getByText("친구의 오늘 할 일")).toHaveCount(0);
  await expect(page.getByText("비밀 소개")).toHaveCount(0);
  expect(await prisma.follow.count({ where: { followerId: me.id, followingId: friend.id } })).toBe(0);

  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(page.getByText("친구의 오늘 할 일")).toBeVisible();
  expect(await prisma.follow.count({ where: { followerId: me.id, followingId: friend.id } })).toBe(1);
});

test("자기 자신의 프로필 주소와 가입 전 계정은 없는 주소다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  const unfinished = await prisma.user.create({ data: { email: OTHER } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(ME);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`나${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const me = await prisma.user.findUniqueOrThrow({ where: { email: ME } });
  for (const id of [me.id, unfinished.id]) {
    await page.goto(`/feed/u/${id}`);
    await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  }
});
