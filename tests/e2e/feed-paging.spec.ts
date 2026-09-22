import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 50개를 넘겨야 다음 쪽이 생긴다. 화면으로 50번 넣으면 너무 느려서 DB에 바로 넣는다.
const FEED_SIZE = 50;

type Account = { email: string; nickname: string };

const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-paging-me-${tag}-${RUN_TAG}@modori.test`, nickname: `나${tag}${RUN_TAG}` },
      friend: {
        email: `e2e-paging-you-${tag}-${RUN_TAG}@modori.test`,
        nickname: `친구${tag}${RUN_TAG}`,
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

async function signOut(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** 친구를 만들고, 내가 그 친구를 팔로우한 상태에서 완료한 할 일을 채워 넣는다. */
async function seedFriendFeed(me: Account, friend: Account, count: number) {
  const [myRow, friendRow] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: me.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: friend.email } }),
  ]);

  const category = await prisma.category.create({
    data: {
      userId: friendRow.id,
      name: "공개",
      color: "#00b26a",
      isPublic: true,
      order: 0,
    },
  });

  await prisma.follow.create({
    data: { followerId: myRow.id, followingId: friendRow.id },
  });

  const base = Date.now();
  await prisma.todo.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      userId: friendRow.id,
      categoryId: category.id,
      content: `친구할일 ${index + 1}`,
      date: todayKST(),
      order: index,
      done: true,
      // 오래된 것일수록 먼저 완료한 것으로 둔다. 1번이 마지막 쪽에 온다.
      doneAt: new Date(base - (count - index) * 1000),
    })),
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("피드가 50개를 넘으면 더 보기로 이어서 본다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);
  await signOut(page);
  await signIn(page, accounts.me);

  await seedFriendFeed(accounts.me, accounts.friend, FEED_SIZE + 3);

  await page.goto("/feed");

  // 가장 최근이 맨 위, 가장 오래된 3개는 아직 안 보인다.
  await expect(page.getByText(`친구할일 ${FEED_SIZE + 3}`)).toBeVisible();
  await expect(page.getByText("친구할일 1", { exact: true })).toBeHidden();

  await page.getByRole("link", { name: "더 보기 →" }).click();

  await expect(page.getByText("친구할일 1", { exact: true })).toBeVisible();
  // 다음 쪽에 첫 쪽 항목이 다시 나오면 안 된다.
  await expect(page.getByText(`친구할일 ${FEED_SIZE + 3}`)).toBeHidden();

  await page.getByRole("link", { name: "↑ 최근으로" }).click();
  await expect(page.getByText(`친구할일 ${FEED_SIZE + 3}`)).toBeVisible();
});

test("주소창의 이어보기 값이 엉터리여도 피드는 열린다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.me);

  await page.goto("/feed?after=이런id는없다");

  await expect(page.getByRole("heading", { name: "소셜" })).toBeVisible();
});
