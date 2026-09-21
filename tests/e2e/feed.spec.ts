import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

type Account = { email: string; nickname: string };

// 피드는 두 사람이 있어야 확인할 수 있다. 테스트마다 계정 두 개를 따로 만든다.
const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-feed-me-${tag}@modori.test`, nickname: `나${tag}` },
      friend: {
        email: `e2e-feed-you-${tag}@modori.test`,
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

  // 로그인 직후 "/"로 갔다가 온보딩으로 다시 튕기므로 URL로 판단하면 안 된다.
  // 둘 중 어느 화면이 떴는지 요소로 기다린다.
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

async function addDoneTodo(page: Page, content: string, category = "공부") {
  await page.goto("/");
  await page.getByLabel("할 일 내용").fill(content);
  await page.getByLabel("카테고리", { exact: true }).selectOption({ label: category });
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();
}

async function follow(page: Page, nickname: string) {
  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(nickname);
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("button", { name: "팔로우", exact: true }).click();
  await expect(page.getByRole("button", { name: "팔로우 중" })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("팔로우하면 친구가 완료한 할 일이 피드에 보인다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "친구의 공부");
  await signOut(page);

  await signIn(page, accounts.me);
  await page.goto("/feed");
  await expect(page.getByText("아직 팔로우한 친구가 없어요")).toBeVisible();

  await follow(page, accounts.friend.nickname);

  await page.goto("/feed");
  await expect(page.getByText("친구의 공부")).toBeVisible();
  await expect(page.getByText(accounts.friend.nickname)).toBeVisible();
});

test("완료하지 않은 할 일은 피드에 보이지 않는다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);
  await page.goto("/");
  await page.getByLabel("할 일 내용").fill("아직 안 한 일");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("1개 중 0개 완료")).toBeVisible();
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);

  await page.goto("/feed");
  await expect(page.getByText("아직 안 한 일")).toBeHidden();
});

test("비공개 카테고리의 할 일은 피드에 보이지 않는다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);

  // 공부 카테고리를 비공개로 바꾼다.
  // 접힌 수정 폼도 DOM에 있으므로 해당 항목 안에서만 찾는다.
  await page.goto("/settings/categories");
  const 공부 = page.getByRole("listitem").filter({ hasText: "공부" });
  await 공부.getByText("수정").click();
  await 공부.getByLabel("친구 피드에 보이기").uncheck();
  await 공부.getByRole("button", { name: "저장" }).click();
  await expect(공부.getByText("비공개")).toBeVisible();

  await addDoneTodo(page, "비밀 공부");
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);

  await page.goto("/feed");
  await expect(page.getByText("비밀 공부")).toBeHidden();
});

test("반응을 누르면 개수가 오르고 다시 누르면 취소된다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "반응 받을 일");
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);
  await page.goto("/feed");

  await page.getByRole("button", { name: "👍 반응" }).click();
  await expect(page.getByRole("button", { name: "👍 반응 취소" })).toBeVisible();

  await page.getByRole("button", { name: "👍 반응 취소" }).click();
  await expect(page.getByRole("button", { name: "👍 반응", exact: true })).toBeVisible();
});

test("받은 반응은 뱃지로 알리고 받은 반응 화면을 열면 사라진다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.me);
  await addDoneTodo(page, "칭찬 받을 일");
  await signOut(page);

  await signIn(page, accounts.friend);
  await follow(page, accounts.me.nickname);
  await page.goto("/feed");
  await page.getByRole("button", { name: "🔥 반응" }).click();
  await expect(page.getByRole("button", { name: "🔥 반응 취소" })).toBeVisible();
  await signOut(page);

  await signIn(page, accounts.me);
  await expect(page.getByLabel("안 읽은 반응 1개")).toBeVisible();

  await page.goto("/feed/reactions");
  await expect(page.getByText("칭찬 받을 일")).toBeVisible();
  await expect(page.getByText("NEW")).toBeVisible();

  await page.goto("/feed");
  await expect(page.getByLabel("안 읽은 반응 1개")).toBeHidden();
});
