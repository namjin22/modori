import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

type Account = { email: string; nickname: string };

const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-friendday-me-${tag}@modori.test`, nickname: `나${tag}` },
      friend: {
        email: `e2e-friendday-you-${tag}@modori.test`,
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
  await expect(nickname.or(page.getByLabel("할 일 내용", { exact: true })).first()).toBeVisible();

  if (await nickname.isVisible()) {
    await nickname.fill(account.nickname);
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page.getByLabel("할 일 내용", { exact: true })).toBeVisible();
  }
}

async function signOut(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("팔로우한 친구의 하루를 열어본다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await page.getByLabel("할 일 내용", { exact: true }).fill("친구가 한 일");
  await page.getByLabel("카테고리", { exact: true }).selectOption({ label: "공부" });
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();

  const friendId = (
    await prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } })
  ).id;

  await signOut(page);
  await signIn(page, accounts.me);

  // 팔로우하기 전에는 볼 수 없다.
  await page.goto(`/feed/u/${friendId}`);
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();

  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(accounts.friend.nickname);
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(page.getByRole("button", { name: "팔로우 중" })).toBeVisible();

  // 피드에서 이름을 누르면 그 사람 화면으로 간다.
  await page.goto("/feed");
  await page.getByRole("link", { name: accounts.friend.nickname }).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friendId}$`));
  await expect(page.getByText("친구가 한 일")).toBeVisible();
});
