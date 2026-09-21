import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

type Account = { email: string; nickname: string };

const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-follow-me-${tag}@modori.test`, nickname: `나${tag}` },
      friend: {
        email: `e2e-follow-you-${tag}@modori.test`,
        nickname: `친구${tag}`,
      },
    };

    const emails = [accounts.me.email, accounts.friend.email];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await provide(accounts);
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  },
});

async function signIn(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(account.email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();

  const nickname = page.getByPlaceholder("닉네임");
  await expect(nickname.or(homeReady(page)).first()).toBeVisible();

  if (await nickname.isVisible()) {
    await nickname.fill(account.nickname);
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
  }
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("팔로우한 사람 목록에서 언팔로우할 수 있다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, accounts.me);

  await page.goto("/feed/following");
  await expect(page.getByText("아직 팔로우한 친구가 없어요")).toBeVisible();

  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(accounts.friend.nickname);
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(page.getByRole("button", { name: "팔로우 중" })).toBeVisible();

  await page.goto("/feed/following");
  await expect(page.getByText(accounts.friend.nickname)).toBeVisible();

  await page.getByRole("button", { name: "언팔로우" }).click();
  await expect(page.getByText("아직 팔로우한 친구가 없어요")).toBeVisible();
});
