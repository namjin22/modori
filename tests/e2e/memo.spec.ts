import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addEvent, addTodo, homeReady, openTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-memo-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
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

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("할 일에 메모를 적으면 글자 밑에 보이고, 지웠다 되돌려도 남는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `메모${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "수학 숙제");

  await openTodo(page, "수학 숙제");
  await page.getByLabel("할 일 메모").fill("3단원 끝까지\n계산기 챙기기");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  const row = page.getByRole("listitem").filter({ hasText: "수학 숙제" });
  await expect(row).toContainText("3단원 끝까지");
  await expect(row).toContainText("계산기 챙기기");

  // 메모를 비우면 사라진다.
  await row.getByRole("button", { name: /수학 숙제/ }).click();
  await page.getByLabel("할 일 메모").fill("");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(row).not.toContainText("3단원 끝까지");

  // 다시 적고 지웠다 되돌리면 메모도 돌아온다.
  await row.getByRole("button", { name: /수학 숙제/ }).click();
  await page.getByLabel("할 일 메모").fill("준비물 없음");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(row).toContainText("준비물 없음");
  await row.getByRole("button", { name: /수학 숙제/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "수학 숙제" })).toContainText("준비물 없음");
  // 화면은 되돌리기를 먼저 보여준다. 서버에 다시 만들어질 때까지 기다린다(끝나기 전에 계정을 지우면 저장이 실패한다).
  await expect
    .poll(async () => (await prisma.todo.findFirst({ where: { user: { email }, content: "수학 숙제" } }))?.memo)
    .toBe("준비물 없음");
});

test("일정에 메모를 적으면 일정 밑에 보인다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `일메${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByLabel("새 일정 이름").fill("동아리 발표");
  await page.getByLabel("새 일정 메모").fill("노트북 충전기");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  const card = page.getByRole("listitem").filter({ hasText: "동아리 발표" });
  await expect(card).toContainText("노트북 충전기");

  // 고치는 창에도 메모가 들어 있다.
  await card.getByRole("button").click();
  await expect(page.getByLabel("일정 메모", { exact: true })).toHaveValue("노트북 충전기");
});

test("친구 화면에는 할 일 메모가 보이지 않는다", async ({ page, email }, testInfo) => {
  const tag = `${testInfo.testId.slice(-6)}${RUN_TAG}`;
  await signUp(page, email, `메주${tag}`);
  await addTodo(page, "비밀 메모 할 일");
  await openTodo(page, "비밀 메모 할 일");
  await page.getByLabel("할 일 메모").fill("나만 보는 메모");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("나만 보는 메모")).toBeVisible();

  const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const viewerEmail = `e2e-memo-viewer-${tag}@modori.test`;
  await prisma.user.deleteMany({ where: { email: viewerEmail } });
  const viewer = await prisma.user.create({
    data: { email: viewerEmail, nickname: `메보${tag}`, privacyAgreedAt: new Date() },
  });
  try {
    await prisma.follow.create({ data: { followerId: viewer.id, followingId: owner.id } });
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(viewerEmail);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto(`/feed/u/${owner.id}`);
    await expect(page.getByText("비밀 메모 할 일")).toBeVisible();
    await expect(page.getByText("나만 보는 메모")).toHaveCount(0);
  } finally {
    await prisma.user.deleteMany({ where: { email: viewerEmail } });
  }
});

// addEvent를 쓰는 다른 테스트와 같은 모양인지 확인한다(메모 칸이 생겨도 만들기가 그대로 된다).
test("메모 없이 만든 일정도 그대로 된다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `일정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addEvent(page, "체육대회");
  await expect(page.getByRole("listitem").filter({ hasText: "체육대회" })).toBeVisible();
});
