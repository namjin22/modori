import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 친구 찾기에서 검색하기 전에 무작위 세 명을 추천하고, 바로 팔로우하고, 새로고침 버튼으로 다시 뽑는다.
const emails = [0, 1, 2, 3, 4].map((n) => `e2e-recommend-${n}-${RUN_TAG}@modori.test`);

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

test("검색 전에 추천 친구 세 명이 뜨고, 바로 팔로우하면 목록에서 빠지고, 버튼으로 다시 뽑는다", async ({ page, browser }) => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  // 추천 대상이 될 다른 계정들을 먼저 만든다(각자 따로 로그인).
  for (let n = 1; n < emails.length; n++) {
    const other = await browser.newContext();
    await signUp(await other.newPage(), emails[n], `추천${n}${RUN_TAG}`);
    await other.close();
  }
  await signUp(page, emails[0], `나${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });

  await page.goto("/feed/search");
  const section = page.getByRole("region", { name: "추천 친구" });
  const rows = section.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  // 나는 추천에 나오지 않고, 모두 팔로우 버튼이 있다.
  await expect(section.getByText(`나${RUN_TAG}`, { exact: true })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "팔로우", exact: true })).toHaveCount(3);

  // 바로 팔로우: DB에 연결이 생기고, 추천에서 빠진다(이미 팔로우한 사람은 다시 추천하지 않는다).
  const first = (await rows.first().getByRole("link").innerText()).trim();
  await rows.first().getByRole("button", { name: "팔로우", exact: true }).click();
  await expect.poll(() => prisma.follow.count({ where: { followerId: me.id } })).toBe(1);
  await expect(section.getByText(first, { exact: true })).toHaveCount(0);
  await expect(rows).toHaveCount(3);

  // 새로고침 버튼은 주소의 r을 바꿔 다시 뽑는다. 검색하면 추천은 사라진다.
  await section.getByRole("button", { name: /다른 사람 보기/ }).click();
  await expect(page).toHaveURL(/\/feed\/search\?r=[a-z0-9]+/);
  await expect(rows).toHaveCount(3);
  await page.getByLabel("닉네임 검색").fill(`추천1${RUN_TAG}`);
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByRole("region", { name: "추천 친구" })).toHaveCount(0);
});
