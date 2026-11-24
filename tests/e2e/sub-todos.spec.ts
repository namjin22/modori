import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { addTodo, homeReady, openTodo } from "./todo-helpers";

// 세부 할 일(2026-11-20 운영자 요청): 큰 할 일 밑에 꼬리처럼 달린다. 큰 할 일과 같은 날·같은 카테고리, 단계는 둘뿐이다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-subtodo-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

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

/** 가입 직후의 내 계정에 큰 할 일 하나와 세부 할 일들을 오늘 날짜로 만든다. */
async function seed(email: string, subs: { title: string; done?: boolean }[]) {
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const today = todayKST();
  const parent = await prisma.todo.create({ data: { userId: me.id, categoryId: category.id, content: "포트폴리오 완성", date: today, order: 0 } });
  const children = [];
  for (const [index, sub] of subs.entries()) {
    children.push(
      await prisma.todo.create({
        data: { userId: me.id, categoryId: category.id, parentId: parent.id, content: sub.title, date: today, order: index + 1, ...(sub.done && { done: true, doneAt: new Date() }) },
      }),
    );
  }
  return { me, category, parent, children, today };
}

test("큰 할 일 창에서 세부 할 일을 달면 밑에 들여 쓰이고 끝낸 개수가 보이며, 큰 할 일의 체크와는 따로다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `꼬리${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "포트폴리오 완성");

  await openTodo(page, "포트폴리오 완성");
  // 세부 할 일은 창의 "세부 할 일" 줄을 눌러 넘어간 화면에서 적는다(2026-11-24).
  await page.getByRole("dialog").getByRole("button", { name: /^세부 할 일 / }).click();
  const input = page.getByLabel("포트폴리오 완성의 세부 할 일 이름");
  for (const name of ["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"]) {
    await input.fill(name);
    await input.press("Enter");
    // 보내는 순간 칸이 비어 다음 것을 바로 적을 수 있다. 창은 열려 있다.
    await expect(input).toHaveValue("");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  const list = page.getByRole("list", { name: "포트폴리오 완성의 세부 할 일" });
  for (const name of ["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"]) await expect(list.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByLabel("세부 할 일 3개 중 0개 완료")).toBeVisible();

  // DB: 세 개 모두 큰 할 일과 같은 날·같은 카테고리에 달렸다.
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const parent = await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "포트폴리오 완성" } });
  const rows = await prisma.todo.findMany({ where: { userId: me.id, parentId: parent.id }, orderBy: { order: "asc" } });
  expect(rows.map((row) => row.content)).toEqual(["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"]);
  for (const row of rows) {
    expect(row.date.getTime()).toBe(parent.date.getTime());
    expect(row.categoryId).toBe(parent.categoryId);
  }

  // 세부 할 일을 체크하면 개수가 바뀐다. 큰 할 일은 저절로 끝나지 않는다.
  await list.getByRole("listitem").filter({ hasText: "메인 페이지 디자인" }).getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByLabel("세부 할 일 3개 중 1개 완료")).toBeVisible();
  await expect.poll(async () => (await prisma.todo.findUniqueOrThrow({ where: { id: rows[0].id } })).done).toBe(true);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: parent.id } })).done).toBe(false);
});

test("세부 할 일 밑에는 또 달 수 없고, 세부 할 일에는 옮기기·카테고리 칸이 없다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `단계${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await seed(email, [{ title: "세부 하나" }]);
  await page.reload();
  await expect(homeReady(page)).toBeVisible();

  await openTodo(page, "세부 하나");
  const dialog = page.getByRole("dialog", { name: "세부 할 일" });
  await expect(dialog).toBeVisible();
  // 세부 할 일의 창에는 세부 할 일 입력칸도, 날짜 옮기기도, 카테고리도 없다. 글자·메모·지우기만 있다.
  await expect(dialog.getByLabel(/의 세부 할 일 이름/)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "내일 하기" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "다른 날에 하기" })).toHaveCount(0);
  await expect(dialog.getByLabel("할 일 카테고리")).toHaveCount(0);
  await dialog.getByRole("button", { name: /^메모 / }).click();
  await expect(dialog.getByLabel("할 일 메모")).toBeVisible();
});

test("큰 할 일을 내일로 옮기면 안 끝낸 세부 할 일은 같이 가고, 끝낸 세부 할 일은 그 날의 기록으로 남는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `옮김${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const { parent, children, today } = await seed(email, [{ title: "안 끝낸 세부" }, { title: "끝낸 세부", done: true }]);
  await page.reload();
  await expect(homeReady(page)).toBeVisible();

  await openTodo(page, "포트폴리오 완성");
  await page.getByRole("dialog").getByRole("button", { name: "내일 하기" }).click();

  const tomorrow = formatKST(addDays(today, 1));
  const dayOf = async (id: string) => formatKST((await prisma.todo.findUniqueOrThrow({ where: { id } })).date);
  // 큰 할 일이 먼저 옮겨지고 세부 할 일이 바로 뒤에 맞춰지므로(lib/sub-todos.ts) 둘 다 기다린다.
  await expect.poll(() => dayOf(parent.id)).toBe(tomorrow);
  await expect.poll(() => dayOf(children[0].id)).toBe(tomorrow);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: children[0].id } })).parentId).toBe(parent.id);
  // 끝낸 세부 할 일은 오늘에 남고 큰 할 일과의 연결만 끊긴다.
  await expect.poll(async () => (await prisma.todo.findUniqueOrThrow({ where: { id: children[1].id } })).parentId).toBeNull();
  expect(await dayOf(children[1].id)).toBe(formatKST(today));
});

test("큰 할 일을 지우면 세부 할 일도 같이 지워지고, 되돌리면 함께 돌아온다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `지움${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const { me, parent } = await seed(email, [{ title: "세부 가" }, { title: "세부 나", done: true }]);
  await page.reload();
  await expect(homeReady(page)).toBeVisible();

  await openTodo(page, "포트폴리오 완성");
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect.poll(() => prisma.todo.count({ where: { userId: me.id } })).toBe(0);
  await expect(page.getByRole("button", { name: "세부 가", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect.poll(() => prisma.todo.count({ where: { userId: me.id } })).toBe(3);
  const restored = await prisma.todo.findMany({ where: { userId: me.id, parentId: parent.id }, orderBy: { order: "asc" } });
  expect(restored.map((row) => [row.content, row.done])).toEqual([
    ["세부 가", false],
    ["세부 나", true],
  ]);
  await expect(page.getByRole("list", { name: "포트폴리오 완성의 세부 할 일" })).toBeVisible();
});

test("친구 화면에서도 큰 할 일 밑에 세부 할 일이 들여 보이고, 비공개 카테고리의 것은 보이지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `친구${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const owner = await prisma.user.create({ data: { email: `owner-${email}`, nickname: `주인${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() } });
  try {
    await prisma.follow.create({ data: { followerId: me.id, followingId: owner.id } });
    const open = await prisma.category.create({ data: { userId: owner.id, name: "공개칸", color: "#2563eb", isPublic: true, order: 0 } });
    const closed = await prisma.category.create({ data: { userId: owner.id, name: "비공개칸", color: "#dc2626", isPublic: false, order: 1 } });
    const today = todayKST();
    const bigOpen = await prisma.todo.create({ data: { userId: owner.id, categoryId: open.id, content: "공개 큰 일", date: today, order: 0 } });
    await prisma.todo.create({ data: { userId: owner.id, categoryId: open.id, parentId: bigOpen.id, content: "공개 세부 일", date: today, order: 1, done: true, doneAt: new Date() } });
    const bigClosed = await prisma.todo.create({ data: { userId: owner.id, categoryId: closed.id, content: "비공개 큰 일", date: today, order: 2 } });
    await prisma.todo.create({ data: { userId: owner.id, categoryId: closed.id, parentId: bigClosed.id, content: "비공개 세부 일", date: today, order: 3 } });

    await page.goto(`/feed/u/${owner.id}`);
    const bigRow = page.getByText("공개 큰 일", { exact: true }).locator("xpath=ancestor::li[1]");
    const subRow = page.getByText("공개 세부 일", { exact: true }).locator("xpath=ancestor::li[1]");
    await expect(bigRow).toBeVisible();
    await expect(subRow).toBeVisible();
    // 세부 할 일은 큰 할 일 밑에 들여 쓴다(줄 왼쪽 여백이 더 크다).
    const [big, small] = await Promise.all([
      bigRow.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft)),
      subRow.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft)),
    ]);
    expect(small).toBeGreaterThan(big);
    await expect(page.getByText("비공개 큰 일")).toHaveCount(0);
    await expect(page.getByText("비공개 세부 일")).toHaveCount(0);
  } finally {
    await prisma.user.deleteMany({ where: { id: owner.id } });
  }
});

test("루틴이 만든 할 일에도 세부 할 일을 달 수 있고, 루틴의 카테고리를 고치면 세부 할 일도 따라간다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `루틴${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const first = await prisma.category.findFirstOrThrow({ where: { userId: me.id }, orderBy: { order: "asc" } });
  const exercise = await prisma.category.create({ data: { userId: me.id, name: "운동", color: "#dc2626", order: 5 } });
  const routine = await prisma.routine.create({ data: { userId: me.id, content: "물 마시기", freq: "DAILY", startDate: todayKST(), categoryId: first.id } });

  // 오늘 화면을 열면 루틴 할 일이 만들어진다. 그 할 일 창에서 세부 할 일을 단다.
  await page.reload();
  await expect(homeReady(page)).toBeVisible();
  await openTodo(page, "물 마시기");
  await page.getByRole("dialog").getByRole("button", { name: /^세부 할 일 / }).click();
  const input = page.getByLabel("물 마시기의 세부 할 일 이름");
  await input.fill("아침 한 컵");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  const parent = await prisma.todo.findFirstOrThrow({ where: { userId: me.id, routineId: routine.id, date: todayKST() } });
  const child = await prisma.todo.findFirstOrThrow({ where: { userId: me.id, parentId: parent.id } });
  expect(child.categoryId).toBe(first.id);

  // 루틴을 고쳐 카테고리를 옮기면 오늘의 루틴 할 일과 그 세부 할 일이 함께 옮겨 간다.
  await page.goto("/routines");
  await page.getByRole("listitem").filter({ hasText: "물 마시기" }).getByRole("button", { name: "고치기" }).click();
  const dialog = page.getByRole("dialog", { name: "루틴 고치기" });
  await dialog.getByRole("button", { name: "루틴 카테고리 수정" }).click();
  await page.getByRole("dialog", { name: "루틴 카테고리 수정" }).getByRole("radio", { name: "운동" }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => (await prisma.todo.findUniqueOrThrow({ where: { id: parent.id } })).categoryId).toBe(exercise.id);
  await expect.poll(async () => (await prisma.todo.findUniqueOrThrow({ where: { id: child.id } })).categoryId).toBe(exercise.id);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: child.id } })).parentId).toBe(parent.id);
});
