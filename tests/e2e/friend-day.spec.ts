import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

type Account = { email: string; nickname: string };

const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-friendday-me-${tag}-${RUN_TAG}@modori.test`, nickname: `나${tag}${RUN_TAG}` },
      friend: {
        email: `e2e-friendday-you-${tag}-${RUN_TAG}@modori.test`,
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
    await page.getByLabel("개인정보 수집·이용에 동의해요").check();
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(homeReady(page)).toBeVisible();
  }
}

async function signOut(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  // 한 번 더 묻는 창에서 확인한다.
  await page.getByRole("dialog").getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("팔로우한 친구의 하루를 열어본다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addTodo(page, "친구가 한 일");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();

  const friendId = (
    await prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } })
  ).id;

  await signOut(page);
  await signIn(page, accounts.me);

  // 팔로우하기 전에는 할 일을 볼 수 없고, 팔로우하면 볼 수 있다는 안내가 뜬다(2026-09-29 요청으로 "없는 주소"에서 바꿈).
  await page.goto(`/feed/u/${friendId}`);
  await expect(page.getByText("팔로우하면", { exact: false })).toContainText("할 일을 볼 수 있어요");
  await expect(page.getByText("친구가 한 일")).toHaveCount(0);

  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(accounts.friend.nickname);
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(page.getByRole("button", { name: "팔로우 중" })).toBeVisible();

  // 친구 찾기에서 이름을 눌러도 그 사람 화면으로 간다.
  await page.getByRole("link", { name: accounts.friend.nickname }).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friendId}$`));
  await expect(page.getByText("친구가 한 일")).toBeVisible();

  // 피드에서 눌러도 같은 곳으로 간다.
  await page.goto("/feed");
  // 위쪽 친구 줄에도 같은 이름 링크가 있다. 피드 카드의 이름(아래쪽)을 누른다.
  const author = page.getByRole("link", { name: accounts.friend.nickname, exact: true }).last();
  await expect(author).toBeVisible();
  await author.click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friendId}$`));
});

test("소셜 위쪽 친구 줄에서 친구를 누르면 그 친구 화면으로 간다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await signOut(page);
  await signIn(page, accounts.me);

  const [me, friend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } }),
  ]);
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  await page.goto("/feed");
  const row = page.getByRole("navigation", { name: "친구" });
  await row.getByRole("link", { name: accounts.friend.nickname }).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friend.id}$`));

  // 마이페이지에 팔로우·팔로워 수가 보인다. 친구가 나를 팔로우하면 팔로워가 는다.
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id } });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(page.getByRole("link", { name: "1 팔로우" })).toBeVisible();
  await expect(page.getByText("팔로워")).toBeVisible();
});

test("친구가 20명을 넘으면 친구 줄은 20명과 전체 보기를 보여준다", async ({ page, accounts }) => {
  await signIn(page, accounts.me);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } });
  const tag = `${RUN_TAG}${Date.now().toString(36).slice(-3)}`;
  const many = await prisma.user.createManyAndReturn({
    data: Array.from({ length: 25 }, (_, index) => ({
      email: `e2e-many-${index}-${tag}@modori.test`,
      nickname: `많은${index}${tag}`,
    })),
    select: { id: true },
  });
  try {
    await prisma.follow.createMany({ data: many.map((user) => ({ followerId: me.id, followingId: user.id })) });

    await page.goto("/feed");
    const row = page.getByRole("navigation", { name: "친구" });
    await expect(row.getByRole("link", { name: /^많은/ })).toHaveCount(20);
    await row.getByRole("link", { name: "+5 전체 보기" }).click();
    await expect(page).toHaveURL(/\/feed\/following$/);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: many.map((user) => user.id) } } });
  }
});

test("마이페이지 팔로워를 누르면 팔로워 목록이 나오고 맞팔로우할 수 있다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await signOut(page);
  await signIn(page, accounts.me);
  const [me, friend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } }),
  ]);
  // 친구만 나를 팔로우한 상태.
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id } });

  await page.goto("/settings");
  await page.getByRole("link", { name: "1 팔로워" }).click();
  await expect(page).toHaveURL(/\/feed\/followers$/);
  await expect(page.getByRole("heading", { name: "팔로워" })).toBeVisible();
  // 아직 팔로우하지 않았으니 친구 화면 링크는 없고 맞팔로우 버튼이 있다.
  await expect(page.getByRole("link", { name: accounts.friend.nickname })).toHaveCount(0);
  await page.getByRole("button", { name: "맞팔로우" }).click();

  await expect(page.getByText("팔로우 중", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: accounts.friend.nickname }).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friend.id}$`));
});

test("팔로워를 끊으면 그 사람은 내 할 일을 더 볼 수 없다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await signOut(page);
  await signIn(page, accounts.me);
  const [me, friend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } }),
  ]);
  await prisma.follow.create({ data: { followerId: friend.id, followingId: me.id } });

  await page.goto("/feed/followers");
  // 잘못 눌렀으면 취소한다. 아무 일도 없다.
  await page.getByRole("button", { name: `${accounts.friend.nickname} 팔로워 끊기` }).click();
  await expect(page.getByRole("dialog", { name: "팔로워를 끊을까요?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  expect(await prisma.follow.count({ where: { followerId: friend.id, followingId: me.id } })).toBe(1);

  await page.getByRole("button", { name: `${accounts.friend.nickname} 팔로워 끊기` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "끊기" }).click();
  await expect(page.getByText("아직 나를 팔로우한 친구가 없어요")).toBeVisible();
  expect(await prisma.follow.count({ where: { followerId: friend.id, followingId: me.id } })).toBe(0);

  // 끊긴 사람은 내 하루를 열 수 없다. 팔로우하면 볼 수 있다는 안내만 뜬다(예전에는 "없는 주소"였다).
  await signOut(page);
  await signIn(page, accounts.friend);
  await page.goto(`/feed/u/${me.id}`);
  await expect(page.getByText("팔로우하면", { exact: false })).toContainText("할 일을 볼 수 있어요");
});

test("친구 화면에는 아직 안 끝낸 할 일도 보이고, 반응은 끝낸 일에만 보낸다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addTodo(page, "친구가 끝낸 일");
  await addTodo(page, "친구가 아직 안 한 일");
  await page
    .getByRole("listitem")
    .filter({ hasText: "친구가 끝낸 일" })
    .getByRole("button", { name: "완료", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();
  await signOut(page);
  await signIn(page, accounts.me);

  const [me, friend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } }),
  ]);
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  await page.goto(`/feed/u/${friend.id}`);
  const done = page.getByRole("listitem").filter({ hasText: "친구가 끝낸 일" });
  const undone = page.getByRole("listitem").filter({ hasText: "친구가 아직 안 한 일" });
  await expect(done.getByRole("img", { name: "완료" })).toBeVisible();
  await expect(undone.getByRole("img", { name: "아직 안 함" })).toBeVisible();
  await expect(done.getByRole("button", { name: "반응 보내기" })).toBeVisible();
  await expect(undone.getByRole("button", { name: "반응 보내기" })).toHaveCount(0);
  // 내 화면처럼 끝낸 일은 묶음 아래로 간다.
  await expect(page.getByRole("listitem").filter({ hasText: "친구가" })).toHaveText([/아직 안 한 일/, /끝낸 일/]);

  // 소셜 피드에는 여전히 끝낸 일만 흐른다.
  await page.goto("/feed");
  await expect(page.getByText("친구가 끝낸 일")).toBeVisible();
  await expect(page.getByText("친구가 아직 안 한 일")).toHaveCount(0);
});
