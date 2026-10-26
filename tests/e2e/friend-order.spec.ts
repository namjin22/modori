import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 소셜 위쪽 친구 줄을 끌어 순서 바꾸기(2026-10-26 요청): 저장되고 새로 열어도 남고, 새 친구는 맨 앞, 그냥 누르면 친구 화면으로 간다.
// 시험이 중간에 실패해도 만든 친구 계정이 남지 않게, 이 실행의 꼬리표가 붙은 계정을 앞뒤로 모두 지운다.
const mine = { email: { startsWith: "e2e-forder-", endsWith: `-${RUN_TAG}@modori.test` } };
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-forder-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: mine });
    await provide(email);
    await prisma.user.deleteMany({ where: mine });
  },
});

const FRIENDS = ["가", "나", "다", "라"];
const friendEmail = (name: string, tag: string) => `e2e-forder-${name.charCodeAt(0)}-${tag}-${RUN_TAG}@modori.test`;

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

/** 친구를 만들고 팔로우한다. 팔로우한 시각이 달라야 "최근 팔로우가 앞"이 정해진다. */
async function makeFriends(meId: string, tag: string) {
  const ids: Record<string, string> = {};
  for (const [index, name] of FRIENDS.entries()) {
    const friend = await prisma.user.create({
      data: { email: friendEmail(name, tag), nickname: `${name}${tag}${RUN_TAG}`, privacyAgreedAt: new Date() },
    });
    await prisma.follow.create({ data: { followerId: meId, followingId: friend.id, createdAt: new Date(Date.now() - (FRIENDS.length - index) * 60_000) } });
    ids[name] = friend.id;
  }
  return ids;
}

const names = (page: Page, tag: string) =>
  page.locator("nav[aria-label='친구'] li[data-friend-id]").evaluateAll((items, suffix) => items.map((item) => (item.textContent ?? "").replace(String(suffix), "").replace(/⠿ 순서 바꾸기/, "").trim()), `${tag}${RUN_TAG}`);

async function drag(page: Page, from: string, to: string) {
  // 얼굴이 화면에 보이고 자리를 잡은 뒤에 좌표를 잰다(막 그려지는 중에 재면 비어 있다).
  const sourceTile = page.locator(`li[data-friend-id="${from}"]`);
  const targetTile = page.locator(`li[data-friend-id="${to}"]`);
  await expect(sourceTile).toBeVisible();
  await expect(targetTile).toBeVisible();
  const source = await sourceTile.boundingBox();
  const target = await targetTile.boundingBox();
  if (!source || !target) throw new Error(`친구 얼굴의 위치를 알 수 없다: ${JSON.stringify({ source, target })}`);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 4 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("친구 얼굴을 끌어 순서를 바꾸면 저장되어 새로 열어도 그대로이고, 새 친구는 맨 앞에 온다", async ({ page, email }, testInfo) => {
  const tag = `${testInfo.testId.slice(-4)}`;
  await page.setViewportSize({ width: 1100, height: 800 });
  await signUp(page, email, `순서${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const ids = await makeFriends(me.id, tag);

  await page.goto("/feed");
  // 안 바꾼 사이는 최근에 팔로우한 사람이 앞이다: 라, 다, 나, 가
  await expect.poll(() => names(page, tag)).toEqual(["라", "다", "나", "가"]);

  // 맨 끝의 "가"를 맨 앞으로 끌어온다.
  await drag(page, ids["가"], ids["라"]);
  await expect.poll(() => names(page, tag)).toEqual(["가", "라", "다", "나"]);
  await expect
    .poll(async () => (await prisma.follow.findMany({ where: { followerId: me.id }, orderBy: { sortOrder: "asc" } })).map((row) => row.followingId))
    .toEqual([ids["가"], ids["라"], ids["다"], ids["나"]]);

  // 새로 열어도 그대로.
  await page.reload();
  await expect.poll(() => names(page, tag)).toEqual(["가", "라", "다", "나"]);

  // 새로 팔로우한 사람은 순서를 바꿔 둔 사람에게도 맨 앞에 온다.
  const newcomer = await prisma.user.create({ data: { email: friendEmail("마", tag), nickname: `마${tag}${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await page.goto(`/feed/u/${newcomer.id}`);
  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect.poll(async () => prisma.follow.count({ where: { followerId: me.id, followingId: newcomer.id } })).toBe(1);
  await page.goto("/feed");
  await expect.poll(() => names(page, tag)).toEqual(["마", "가", "라", "다", "나"]);

});

test("끌지 않고 누르면 그 친구 화면으로 가고, 끈 뒤에는 이동하지 않는다", async ({ page, email }, testInfo) => {
  const tag = `${testInfo.testId.slice(-4)}`;
  await page.setViewportSize({ width: 1100, height: 800 });
  await signUp(page, email, `누름${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const ids = await makeFriends(me.id, tag);

  await page.goto("/feed");
  await expect.poll(() => names(page, tag)).toEqual(["라", "다", "나", "가"]);

  // 끌고 놓은 곳에서 링크가 따라 눌리면 안 된다.
  await drag(page, ids["나"], ids["다"]);
  await expect.poll(() => names(page, tag)).toEqual(["라", "나", "다", "가"]);
  await expect(page).toHaveURL(/\/feed$/);

  // 그냥 누르면 친구 화면.
  await page.locator(`li[data-friend-id="${ids["다"]}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${ids["다"]}$`));

});
