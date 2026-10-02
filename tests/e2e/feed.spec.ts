import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FIRST_CATEGORY, addTodo, homeReady, openCategory } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

type Account = { email: string; nickname: string };

// 피드는 두 사람이 있어야 확인할 수 있다. 테스트마다 계정 두 개를 따로 만든다.
const test = base.extend<{ accounts: { me: Account; friend: Account } }>({
  accounts: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const accounts = {
      me: { email: `e2e-feed-me-${tag}-${RUN_TAG}@modori.test`, nickname: `나${tag}${RUN_TAG}` },
      friend: {
        email: `e2e-feed-you-${tag}-${RUN_TAG}@modori.test`,
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

  // 로그인 직후 "/"로 갔다가 온보딩으로 다시 튕기므로 URL로 판단하면 안 된다.
  // 둘 중 어느 화면이 떴는지 요소로 기다린다.
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

async function addDoneTodo(page: Page, content: string, category = FIRST_CATEGORY) {
  await page.goto("/");
  await addTodo(page, content, category);
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
  // 위쪽 친구 줄에도 이름이 있다. 할 일이 든 피드 카드 안의 이름을 본다.
  await expect(
    page.getByRole("listitem").filter({ hasText: "친구의 공부" }).getByText(accounts.friend.nickname),
  ).toBeVisible();
});

test("완료하지 않은 할 일은 피드에 보이지 않는다", async ({
  page,
  accounts,
}) => {
  await signIn(page, accounts.friend);
  await page.goto("/");
  await addTodo(page, "아직 안 한 일");
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

  // 기본 카테고리를 비공개로 바꾼다. 저장 버튼 없이 끄는 순간 저장된다.
  await page.goto("/categories");
  await openCategory(page, FIRST_CATEGORY);
  // 만들기 폼에도 같은 스위치가 있어서 고치는 창 안에서 찾는다.
  await page.getByRole("dialog").getByLabel("친구 피드에 보이기").uncheck();
  await expect(page.getByText("저장했어요")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: `${FIRST_CATEGORY} 고치기` }),
  ).toContainText("비공개");

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

  // 보낼 때는 창에서 고른다. 열둘을 늘 늘어놓으면 할 일보다 반응 줄이 길어진다.
  await page.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  const chip = page.getByRole("button", { name: /^좋아요 1개, 내가 누름/ });
  await expect(chip).toBeVisible();

  // 칩을 누르면 같이 눌러지는 게 아니라 누가 눌렀는지 보인다. 반응은 그대로다.
  await chip.click();
  const who = page.getByRole("dialog", { name: "누가 눌렀어요" });
  await expect(who).toContainText("좋아요");
  await expect(who).toContainText("나");
  await page.keyboard.press("Escape");
  await expect(chip).toBeVisible();

  // 취소는 "누가 눌렀어요" 창에서 "나"를 눌러 한다. 아무도 안 누른 반응은 줄에서 빠진다.
  await chip.click();
  await who.getByRole("button", { name: "좋아요 내 반응 취소" }).click();
  await expect(page.getByRole("button", { name: /^좋아요 \d+개/ })).toHaveCount(0);
  await expect(who).toHaveCount(0);
  expect(await prisma.reaction.count({ where: { emoji: "👍", user: { email: accounts.me.email } } })).toBe(0);
});

test("고르는 창에서 이미 누른 반응을 다시 눌러도 취소된다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "고르는 창에서 취소할 일");
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);
  await page.goto("/feed");
  await page.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByRole("button", { name: /^좋아요 1개, 내가 누름/ })).toBeVisible();

  await page.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByRole("button", { name: /^좋아요 \d+개/ })).toHaveCount(0);
});

test("도리 표정도 반응으로 보내고 받은 반응 화면에서 본다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "도리 받을 일");
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);
  await page.goto("/feed");
  await page.getByRole("button", { name: "반응 보내기" }).click();
  // 이모지 "불타요"와 이름이 겹치지 않게 도리 반응은 "도리"를 붙여 부른다.
  await page.getByRole("button", { name: "도리 표정 7", exact: true }).click();
  await expect(page.getByRole("button", { name: /^도리 표정 7 1개/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^불타요 \d+개/ })).toHaveCount(0);
  await signOut(page);

  await signIn(page, accounts.friend);
  await page.goto("/feed/reactions");
  await expect(page.getByText("도리 받을 일")).toBeVisible();
  await expect(page.getByRole("img", { name: "도리 표정 7" })).toBeVisible();
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
  await page.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("button", { name: "불타요", exact: true }).click();
  await expect(page.getByRole("button", { name: /^불타요 1개, 내가 누름/ })).toBeVisible();
  await signOut(page);

  await signIn(page, accounts.me);
  // 친구가 나를 팔로우한 것도 알림이라 반응과 합쳐 둘이다.
  await expect(page.getByLabel("안 읽은 알림 2개")).toBeVisible();

  await page.goto("/feed/reactions");
  await expect(page.getByText("칭찬 받을 일")).toBeVisible();
  await expect(page.getByText("NEW", { exact: true })).toHaveCount(2);

  await page.goto("/feed");
  await expect(page.getByLabel(/안 읽은 알림/)).toHaveCount(0);
});

test("누가 나를 팔로우하면 알림으로 오고, 거기서 맞팔로우한다", async ({ page, accounts }) => {
  await signIn(page, accounts.me);
  await signOut(page);

  await signIn(page, accounts.friend);
  await follow(page, accounts.me.nickname);
  await signOut(page);

  await signIn(page, accounts.me);
  await expect(page.getByLabel("안 읽은 알림 1개")).toBeVisible();
  await page.goto("/feed/reactions");
  await expect(page.getByRole("heading", { name: "알림" })).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: "나를 팔로우했어요" });
  await expect(item).toContainText(accounts.friend.nickname);
  await expect(item).toContainText("NEW");

  await item.getByRole("button", { name: "맞팔로우" }).click();
  await expect(item.getByRole("button", { name: "맞팔로우" })).toHaveCount(0);

  // 알림 화면을 열었으니 뱃지는 사라진다.
  await page.goto("/feed");
  await expect(page.getByLabel(/안 읽은 알림/)).toHaveCount(0);
});

test("친구가 보낸 반응은 내 홈 화면의 그 할 일 밑에 보인다", async ({ page, accounts }) => {
  await signIn(page, accounts.me);
  await addDoneTodo(page, "칭찬 받을 운동");
  // 반응을 받지 않은 할 일도 하나 둔다(도우미는 한 화면에 할 일이 하나라고 보고 체크해서 DB로 만든다).
  const me = await prisma.user.findUniqueOrThrow({ where: { email: accounts.me.email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id } });
  await prisma.todo.create({
    data: { userId: me.id, categoryId: category.id, content: "반응 없는 일", date: todayKST(), done: true, doneAt: new Date(), order: 9 },
  });
  await signOut(page);

  await signIn(page, accounts.friend);
  await follow(page, accounts.me.nickname);
  await page.goto("/feed");
  const card = page.getByRole("listitem").filter({ hasText: "칭찬 받을 운동" }).last();
  await card.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("button", { name: "불타요", exact: true }).click();
  await expect(page.getByRole("button", { name: /^불타요 1개, 내가 누름/ })).toBeVisible();
  await signOut(page);

  await signIn(page, accounts.me);
  await page.goto("/");
  const row = page.getByRole("listitem").filter({ hasText: "칭찬 받을 운동" });
  // 칩을 누르면 누가 보냈는지 창으로 보인다.
  await row.getByRole("button", { name: "불타요 1개, 누가 보냈는지 보기" }).click();
  const dialog = page.getByRole("dialog", { name: "받은 반응" });
  await expect(dialog).toContainText("불타요");
  await expect(dialog).toContainText(accounts.friend.nickname);
  await expect(
    page.getByRole("listitem").filter({ hasText: "반응 없는 일" }).getByRole("list", { name: "받은 반응" }),
  ).toHaveCount(0);
});

test("반응 칩을 누르면 다른 사람이 누른 이름이 보이고, 내 반응은 생기지 않는다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "누가 눌렀나 볼 일");
  await signOut(page);

  const friend = await prisma.user.findUniqueOrThrow({ where: { email: accounts.friend.email } });
  const todo = await prisma.todo.findFirstOrThrow({ where: { userId: friend.id, content: "누가 눌렀나 볼 일" } });
  const otherEmail = `e2e-feed-other-${RUN_TAG}-${todo.id.slice(-6)}@modori.test`;
  const other = await prisma.user.create({
    data: { email: otherEmail, nickname: `구경${todo.id.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  await prisma.reaction.create({ data: { userId: other.id, todoId: todo.id, todoUserId: friend.id, emoji: "🔥" } });

  try {
    await signIn(page, accounts.me);
    await follow(page, accounts.friend.nickname);
    await page.goto("/feed");
    const chip = page.getByRole("button", { name: /^불타요 1개, 누가 눌렀는지 보기/ });
    await chip.click();
    const who = page.getByRole("dialog", { name: "누가 눌렀어요" });
    await expect(who).toContainText(other.nickname ?? "");
    // 같이 눌러지지 않았다: 내 반응은 없고 개수도 그대로다.
    expect(await prisma.reaction.count({ where: { todoId: todo.id } })).toBe(1);
    await page.keyboard.press("Escape");
    await expect(chip).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email: otherEmail } });
  }
});

test("반응 창의 캐릭터 탭에서 다른 캐릭터의 표정도 보낼 수 있고, 프로필 캐릭터와 상관없다", async ({ page, accounts }) => {
  await signIn(page, accounts.friend);
  await addDoneTodo(page, "캐릭터 반응 받을 일");
  await signOut(page);

  await signIn(page, accounts.me);
  await follow(page, accounts.friend.nickname);
  await page.goto("/feed");
  await page.getByRole("button", { name: "반응 보내기" }).click();

  // 탭: 도리·몽이·하루·펭이. 각 캐릭터는 표정 열 개를 가진다.
  const dialog = page.getByRole("dialog", { name: "반응 보내기" });
  await expect(dialog.getByRole("tab")).toHaveCount(4);
  await dialog.getByRole("tab", { name: "몽이" }).click();
  await expect(dialog.getByRole("tabpanel").getByRole("button")).toHaveCount(10);
  await dialog.getByRole("button", { name: "몽이 표정 7", exact: true }).click();
  await expect(page.getByRole("button", { name: /^몽이 표정 7 1개, 내가 누름/ })).toBeVisible();
  // 저장은 화면이 바뀐 뒤에 끝난다.
  await expect
    .poll(() => prisma.reaction.count({ where: { emoji: "mong:pant", user: { email: accounts.me.email } } }))
    .toBe(1);
});
