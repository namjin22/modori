import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

import { generateApiToken } from "@/lib/api-token-secret";
import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 모도리의 MCP 서버(2026-11-15, docs/mcp.md): 외부 AI가 접근 토큰으로 /mcp를 불러 할 일·일정을 한꺼번에 읽고 쓴다.
// 이 시험이 MCP 클라이언트 역할을 한다(JSON-RPC를 직접 보낸다).

type Rpc = { status: number; body: { result?: { content?: { text: string }[]; isError?: boolean; tools?: { name: string }[] }; error?: { message: string } } };

type Account = { id: string; email: string; nickname: string };

const test = base.extend<{ account: Account }>({
  account: async ({}, provide, testInfo) => {
    const tag = `${testInfo.testId.slice(-6)}${RUN_TAG}`;
    const email = `e2e-mcp-${tag}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({ data: { email, nickname: `엠씨피${tag}`, privacyAgreedAt: new Date() } });
    await provide({ id: user.id, email, nickname: user.nickname ?? "" });
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

const TODAY = formatKST(todayIn("Asia/Seoul"));
const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

async function makeToken(userId: string, scope: "READ" | "WRITE", expiresAt: Date | null = new Date(Date.now() + 30 * 86_400_000)) {
  const { token, hash, hint } = generateApiToken();
  const row = await prisma.apiToken.create({ data: { userId, name: "시험", scope, tokenHash: hash, hint, expiresAt } });
  return { token, id: row.id };
}

async function rpc(request: APIRequestContext, token: string | null, method: string, params?: unknown): Promise<Rpc> {
  const response = await request.post("/mcp", {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const text = await response.text();
  return { status: response.status(), body: text ? JSON.parse(text) : {} };
}

/** 도구를 부르고 결과 글(JSON)을 풀어 준다. 도구가 거절했거나 검증에서 막혔으면 failed. */
async function call(request: APIRequestContext, token: string, name: string, args: unknown) {
  const { status, body } = await rpc(request, token, "tools/call", { name, arguments: args });
  const text = body.result?.content?.[0]?.text;
  const failed = status !== 200 || body.error !== undefined || body.result?.isError === true;
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text ?? body.error?.message ?? "" };
  }
  return { failed, data, raw: text ?? body.error?.message ?? "" };
}

async function seedTodo(userId: string, date: string, content: string, order = 0) {
  return prisma.todo.create({ data: { userId, content, date: parseKSTDate(date), order } });
}

test("토큰 없이, 모양이 틀린 토큰으로, 없는 토큰으로 부르면 401이다", async ({ request }) => {
  const none = await rpc(request, null, "tools/list");
  expect(none.status).toBe(401);
  const headers = (await request.post("/mcp", { headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, data: {} })).headers();
  expect(headers["www-authenticate"]).toContain("Bearer");

  expect((await rpc(request, "abc", "tools/list")).status).toBe(401);
  // 모양은 맞지만 DB에 없는 토큰.
  expect((await rpc(request, generateApiToken().token, "tools/list")).status).toBe(401);
});

test("GET과 DELETE는 405다(세션을 두지 않는다)", async ({ request }) => {
  expect((await request.get("/mcp")).status()).toBe(405);
  expect((await request.delete("/mcp")).status()).toBe(405);
});

test("읽기 토큰에는 읽는 도구만 보이고 바꾸는 도구는 부를 수 없다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "READ");
  const list = await rpc(request, token, "tools/list");
  expect(list.status).toBe(200);
  // 읽는 도구만 보인다(2026-11-16에 루틴·프로필·사람 찾기 조회 도구가 늘었다. 바꾸는 도구가 없다는 것은 그대로다).
  expect(list.body.result?.tools?.map((tool) => tool.name).sort()).toEqual(["get_overview", "get_profile", "list_events", "list_people", "list_routines", "list_todos", "search_users"]);

  await seedTodo(account.id, TODAY, "읽기 시험");
  const read = await call(request, token, "list_todos", { from: TODAY });
  expect(read.failed).toBe(false);
  expect((read.data.todos as { content: string }[]).map((todo) => todo.content)).toEqual(["읽기 시험"]);

  const write = await call(request, token, "create_todos", { todos: [{ content: "몰래 쓰기", date: TODAY }] });
  expect(write.failed).toBe(true);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(1);
});

test("쓰기 토큰: 한 번에 만들고, 읽고, 끝내고, 옮기고, 되돌린다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const list = await rpc(request, token, "tools/list");
  // 만들기·끝내기·옮기기·메모 달기·되돌리기까지. 고치기·지우기 도구는 모든 권한 토큰에만 있다(tests/e2e/mcp-full.spec.ts).
  expect(list.body.result?.tools?.map((tool) => tool.name).sort()).toEqual([
    "add_todo_memos",
    "complete_todos",
    "create_events",
    "create_todos",
    "get_overview",
    "get_profile",
    "list_events",
    "list_people",
    "list_routines",
    "list_todos",
    "move_todos",
    "search_users",
    "undo_batch",
  ]);

  const category = await prisma.category.create({ data: { userId: account.id, name: "공부", color: "#2563eb", order: 0 } });
  const overview = await call(request, token, "get_overview", {});
  expect(overview.data.today).toBe(TODAY);
  expect((overview.data.categories as { name: string }[]).map((each) => each.name)).toEqual(["공부"]);

  // 카테고리는 이름이나 id로 고른다. 메모는 팔로워에게 보이지 않게 저장된다.
  const made = await call(request, token, "create_todos", {
    todos: [
      { content: "수학 3단원", date: TODAY, category: "공부", memo: "p.30~45" },
      { content: "영어 단어 50개", date: day(1), category: category.id },
      { content: "카테고리 없는 일", date: day(1) },
    ],
  });
  expect(made.failed).toBe(false);
  const created = made.data.created as { id: string; content: string }[];
  expect(created).toHaveLength(3);
  const rows = await prisma.todo.findMany({ where: { userId: account.id }, orderBy: { createdAt: "asc" } });
  expect(rows.map((row) => row.content).sort()).toEqual(["수학 3단원", "영어 단어 50개", "카테고리 없는 일"].sort());
  expect(rows.find((row) => row.content === "수학 3단원")).toMatchObject({ categoryId: category.id, memo: "p.30~45", memoPublic: false, done: false });
  expect(rows.find((row) => row.content === "카테고리 없는 일")?.categoryId).toBeNull();
  // 같은 날의 둘은 만든 차례대로 놓인다.
  const tomorrow = rows.filter((row) => formatKST(row.date) === day(1)).sort((a, b) => a.order - b.order);
  expect(tomorrow.map((row) => row.content)).toEqual(["영어 단어 50개", "카테고리 없는 일"]);

  const listed = await call(request, token, "list_todos", { from: TODAY, to: day(1), includeMemo: true });
  expect((listed.data.todos as { content: string; memo?: string }[]).find((todo) => todo.content === "수학 3단원")?.memo).toBe("p.30~45");
  const withoutMemo = await call(request, token, "list_todos", { from: TODAY });
  expect((withoutMemo.data.todos as { memo?: string }[])[0].memo).toBeUndefined();

  // 끝내기: 이미 그 상태인 것은 건드리지 않는다.
  const [first, second] = created;
  const done = await call(request, token, "complete_todos", { ids: [first.id, second.id] });
  expect(done.data).toMatchObject({ changed: 2, alreadyInThatState: 0, notFound: [] });
  const again = await call(request, token, "complete_todos", { ids: [first.id] });
  expect(again.data).toMatchObject({ changed: 0, alreadyInThatState: 1 });
  expect(await prisma.todo.findMany({ where: { id: { in: [first.id, second.id] } }, select: { done: true, doneAt: true } })).toEqual([
    { done: true, doneAt: expect.any(Date) },
    { done: true, doneAt: expect.any(Date) },
  ]);

  // 옮기기
  const third = created[2];
  const moved = await call(request, token, "move_todos", { ids: [third.id], date: day(3) });
  expect(moved.data).toMatchObject({ moved: 1, to: day(3) });
  expect(formatKST((await prisma.todo.findUniqueOrThrow({ where: { id: third.id } })).date)).toBe(day(3));

  // 되돌리기: 내가 끝낸 것(first, second)은 남기고 나머지만 지운다.
  const undone = await call(request, token, "undo_batch", { batchId: made.data.batchId });
  expect(undone.data).toMatchObject({ deletedTodos: 1, keptBecauseDone: 2 });
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(2);
  // 한 번 쓴 묶음은 다시 쓸 수 없다.
  expect((await call(request, token, "undo_batch", { batchId: made.data.batchId })).failed).toBe(true);
});

test("한 번 부르면 전부 되거나 하나도 안 된다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");

  // 없는 카테고리 이름 하나 때문에 둘 다 만들어지지 않는다.
  const badCategory = await call(request, token, "create_todos", { todos: [{ content: "정상", date: TODAY }, { content: "문제", date: TODAY, category: "없는 카테고리" }] });
  expect(badCategory.failed).toBe(true);
  expect(badCategory.raw).toContain("없는 카테고리");

  // 진짜 날짜가 아니다(형식은 맞다).
  expect((await call(request, token, "create_todos", { todos: [{ content: "2월 30일", date: "2026-02-30" }] })).failed).toBe(true);
  // 오늘에서 10년(3650일)을 넘는다(2026-11-17에 366일에서 넓혔다).
  expect((await call(request, token, "create_todos", { todos: [{ content: "먼 훗날", date: day(3651) }] })).failed).toBe(true);
  // 20개를 넘는다.
  expect((await call(request, token, "create_todos", { todos: Array.from({ length: 21 }, (_, index) => ({ content: `일 ${index}`, date: TODAY })) })).failed).toBe(true);

  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(0);
});

test("하루 상한(50개)을 새로 만들 개수까지 합쳐서 막는다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  await prisma.todo.createMany({ data: Array.from({ length: 49 }, (_, index) => ({ userId: account.id, content: `채움 ${index}`, date: parseKSTDate(TODAY), order: index })) });

  const over = await call(request, token, "create_todos", { todos: [{ content: "하나", date: TODAY }, { content: "둘", date: TODAY }] });
  expect(over.failed).toBe(true);
  expect(await prisma.todo.count({ where: { userId: account.id, date: parseKSTDate(TODAY) } })).toBe(49);

  const one = await call(request, token, "create_todos", { todos: [{ content: "하나", date: TODAY }] });
  expect(one.failed).toBe(false);
  expect(await prisma.todo.count({ where: { userId: account.id, date: parseKSTDate(TODAY) } })).toBe(50);

  // 옮기기도 같은 상한을 지킨다.
  const other = await seedTodo(account.id, day(1), "옮길 일");
  const move = await call(request, token, "move_todos", { ids: [other.id], date: TODAY });
  expect(move.failed).toBe(true);
  expect(formatKST((await prisma.todo.findUniqueOrThrow({ where: { id: other.id } })).date)).toBe(day(1));
});

test("남의 할 일은 보이지도, 바뀌지도, 지워지지도 않는다", async ({ request, account }, testInfo) => {
  const other = await prisma.user.create({
    data: { email: `e2e-mcp-other-${testInfo.testId.slice(-6)}${RUN_TAG}@modori.test`, nickname: `남${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  try {
    const theirs = await seedTodo(other.id, TODAY, "남의 할 일");
    const { token } = await makeToken(account.id, "WRITE");

    expect((await call(request, token, "list_todos", { from: TODAY })).data.todos).toEqual([]);
    const done = await call(request, token, "complete_todos", { ids: [theirs.id] });
    expect(done.data).toMatchObject({ changed: 0, notFound: [theirs.id] });
    const moved = await call(request, token, "move_todos", { ids: [theirs.id], date: day(2) });
    expect(moved.data).toMatchObject({ moved: 0, notFound: [theirs.id] });

    const row = await prisma.todo.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(row.done).toBe(false);
    expect(formatKST(row.date)).toBe(TODAY);

    // 남이 만든 묶음은 되돌릴 수 없다.
    const batch = await prisma.mcpBatch.create({ data: { userId: other.id, todoIds: [theirs.id] } });
    expect((await call(request, token, "undo_batch", { batchId: batch.id })).failed).toBe(true);
    expect(await prisma.todo.count({ where: { id: theirs.id } })).toBe(1);
  } finally {
    await prisma.user.delete({ where: { id: other.id } });
  }
});

test("일정은 기본이 비공개이고, 시각·하루 상한 규칙을 지킨다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");

  const made = await call(request, token, "create_events", {
    events: [
      { title: "중간고사", startDate: day(5), endDate: day(7), color: "#EF4444" },
      { title: "동아리 모임", startDate: day(2), startTime: "16:30", endTime: "18:00", isPublic: true },
    ],
  });
  expect(made.failed).toBe(false);
  const rows = await prisma.event.findMany({ where: { userId: account.id }, orderBy: { startDate: "asc" } });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ title: "동아리 모임", isPublic: true, memoPublic: false, startTime: 16 * 60 + 30, endTime: 18 * 60 });
  expect(rows[1]).toMatchObject({ title: "중간고사", isPublic: false, memoPublic: false, startTime: null, color: "#ef4444" });
  expect(formatKST(rows[1].endDate)).toBe(day(7));

  const listed = await call(request, token, "list_events", { from: day(6), to: day(6) });
  expect((listed.data.events as { title: string; visibleToFollowers: boolean }[]).map((event) => [event.title, event.visibleToFollowers])).toEqual([["중간고사", false]]);

  // 끝 시각만 있거나, 같은 날인데 끝이 시작보다 빠르거나, 끝 날짜가 시작보다 이르면 하나도 만들지 않는다.
  for (const bad of [
    { title: "나쁨1", startDate: day(10), endTime: "10:00" },
    { title: "나쁨2", startDate: day(10), startTime: "10:00", endTime: "09:00" },
    { title: "나쁨3", startDate: day(10), endDate: day(9) },
  ]) {
    expect((await call(request, token, "create_events", { events: [{ title: "정상", startDate: day(10) }, bad] })).failed, bad.title).toBe(true);
  }
  expect(await prisma.event.count({ where: { userId: account.id } })).toBe(2);

  // 하루 일정은 5개까지(기존 규칙). 이번에 만드는 것끼리 겹쳐도 센다.
  const six = await call(request, token, "create_events", { events: Array.from({ length: 6 }, (_, index) => ({ title: `겹침 ${index}`, startDate: day(20) })) });
  expect(six.failed).toBe(true);
  expect(await prisma.event.count({ where: { userId: account.id, startDate: parseKSTDate(day(20)) } })).toBe(0);
});

test("만료된 토큰과 지운 토큰은 바로 막힌다", async ({ request, account }) => {
  const expired = await makeToken(account.id, "WRITE", new Date(Date.now() - 1000));
  expect((await rpc(request, expired.token, "tools/list")).status).toBe(401);

  const forever = await makeToken(account.id, "WRITE", null);
  expect((await rpc(request, forever.token, "tools/list")).status).toBe(200);

  const live = await makeToken(account.id, "WRITE");
  expect((await rpc(request, live.token, "tools/list")).status).toBe(200);
  await prisma.apiToken.delete({ where: { id: live.id } });
  expect((await rpc(request, live.token, "tools/list")).status).toBe(401);
});

test("쓰기 토큰은 이미 있는 할 일에 메모를 달 수 있다: 덧붙이기·바꾸기·되돌리기, 팔로워에게는 숨긴다", async ({ request, account }) => {
  const read = await makeToken(account.id, "READ");
  expect((await rpc(request, read.token, "tools/list")).body.result?.tools?.map((tool) => tool.name)).not.toContain("add_todo_memos");

  const { token } = await makeToken(account.id, "WRITE");
  const names = (await rpc(request, token, "tools/list")).body.result?.tools?.map((tool) => tool.name);
  expect(names).toContain("add_todo_memos");
  // 글·카테고리를 고치는 도구는 여전히 모든 권한 토큰에만 있다.
  expect(names).not.toContain("update_todos");

  const plain = await seedTodo(account.id, TODAY, "수학 숙제", 0);
  const withMemo = await prisma.todo.create({ data: { userId: account.id, content: "영어 단어", date: parseKSTDate(TODAY), order: 1, memo: "Day 3", memoPublic: true } });
  const memoOf = async (id: string) => prisma.todo.findUniqueOrThrow({ where: { id }, select: { content: true, memo: true, memoPublic: true } });

  // 메모가 없던 것은 그대로 달리고, 있던 것은 뒤에 줄을 바꿔 덧붙는다. 둘 다 팔로워에게 보이지 않는다.
  const added = await call(request, token, "add_todo_memos", { memos: [{ id: plain.id, memo: "p.30~45" }, { id: withMemo.id, memo: "틀린 것만" }] });
  expect(added.failed).toBe(false);
  expect(await memoOf(plain.id)).toEqual({ content: "수학 숙제", memo: "p.30~45", memoPublic: false });
  expect(await memoOf(withMemo.id)).toEqual({ content: "영어 단어", memo: "Day 3\n틀린 것만", memoPublic: false });
  const listed = await call(request, token, "list_todos", { from: TODAY, includeMemo: true });
  expect((listed.data.todos as { content: string; memo?: string }[]).find((todo) => todo.content === "영어 단어")?.memo).toBe("Day 3\n틀린 것만");

  // 되돌리면 메모도, 공개 여부도 달기 전으로 돌아간다.
  expect((await call(request, token, "undo_batch", { batchId: added.data.batchId })).failed).toBe(false);
  expect(await memoOf(plain.id)).toEqual({ content: "수학 숙제", memo: null, memoPublic: true });
  expect(await memoOf(withMemo.id)).toEqual({ content: "영어 단어", memo: "Day 3", memoPublic: true });

  // replace=true면 있던 메모를 바꾼다.
  const replaced = await call(request, token, "add_todo_memos", { memos: [{ id: withMemo.id, memo: "새 메모" }], replace: true });
  expect(replaced.failed).toBe(false);
  expect((await memoOf(withMemo.id)).memo).toBe("새 메모");

  // 덧붙이면 500자를 넘는 것, 없는 id, 같은 id 두 번은 전부 거절하고 아무것도 바꾸지 않는다.
  await prisma.todo.update({ where: { id: plain.id }, data: { memo: "가".repeat(490) } });
  const tooLong = await call(request, token, "add_todo_memos", { memos: [{ id: plain.id, memo: "나".repeat(20) }] });
  expect(tooLong.failed).toBe(true);
  expect((await memoOf(plain.id)).memo).toBe("가".repeat(490));
  const missing = await call(request, token, "add_todo_memos", { memos: [{ id: withMemo.id, memo: "들어가면 안 됨" }, { id: "no-such-id", memo: "없는 할 일" }] });
  expect(missing.failed).toBe(true);
  expect((await memoOf(withMemo.id)).memo).toBe("새 메모");
  const twice = await call(request, token, "add_todo_memos", { memos: [{ id: withMemo.id, memo: "하나" }, { id: withMemo.id, memo: "둘" }] });
  expect(twice.failed).toBe(true);
  expect((await memoOf(withMemo.id)).memo).toBe("새 메모");
});

test("남의 할 일에는 메모를 달 수 없다", async ({ request, account }, testInfo) => {
  const email = `e2e-mcp-other-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
  await prisma.user.deleteMany({ where: { email } });
  const other = await prisma.user.create({ data: { email, nickname: `남${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() } });
  try {
    const theirs = await seedTodo(other.id, TODAY, "남의 할 일");
    const { token } = await makeToken(account.id, "WRITE");
    const result = await call(request, token, "add_todo_memos", { memos: [{ id: theirs.id, memo: "몰래" }] });
    expect(result.failed).toBe(true);
    expect((await prisma.todo.findUniqueOrThrow({ where: { id: theirs.id } })).memo).toBeNull();
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

test("만료 없는 토큰은 막히지 않고, 설정에서 만료 없음으로 만들 수 있다", async ({ page, request }, testInfo) => {
  const email = `e2e-mcp-forever-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
  await prisma.user.deleteMany({ where: { email } });
  try {
    await signUp(page, email, `무기한${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.goto("/settings/ai");

    await page.getByLabel("이름 (어디에 쓰는지)").fill("오래 쓸 토큰");
    // 만료 없음을 고르면 경고가 뜨고, 모든 권한이면 한 줄이 더 붙는다. 다른 기간으로 바꾸면 사라진다.
    await expect(page.getByRole("note")).toHaveCount(0);
    await page.getByLabel("유효 기간").selectOption({ label: "만료 없음" });
    await expect(page.getByRole("note")).toContainText("직접 지우기 전까지");
    await expect(page.getByRole("note")).not.toContainText("할 일·일정을 지울 수도");
    await page.getByRole("radio", { name: /모든 권한/ }).check();
    await expect(page.getByRole("note")).toContainText("할 일·일정을 지울 수도");
    await page.getByRole("radio", { name: /읽기·쓰기/ }).check();
    await expect(page.getByRole("note")).not.toContainText("할 일·일정을 지울 수도");
    await page.getByLabel("유효 기간").selectOption("90");
    await expect(page.getByRole("note")).toHaveCount(0);
    await page.getByLabel("유효 기간").selectOption({ label: "만료 없음" });

    await page.getByRole("button", { name: "토큰 만들기" }).click();
    await expect(page.getByRole("heading", { name: "토큰이 만들어졌어요" })).toBeVisible();
    const token = await page.getByLabel("접근 토큰", { exact: true }).inputValue();

    // 만료 시각은 비어 있고, 그 토큰은 바로 쓸 수 있다.
    const stored = await prisma.apiToken.findFirstOrThrow({ where: { user: { email } } });
    expect(stored.expiresAt).toBeNull();
    expect((await rpc(request, token, "tools/list")).status).toBe(200);

    // 폼은 비워졌고(경고도 사라졌고), 목록에는 만료일 대신 "만료 없음"이 보인다.
    await page.getByRole("button", { name: "복사했어요, 닫기" }).click();
    await page.reload();
    await expect(page.getByRole("note")).toHaveCount(0);
    const row = page.getByRole("listitem").filter({ hasText: "오래 쓸 토큰" });
    await expect(row).toContainText("만료 없음");
    await expect(row).not.toContainText("만료됨");
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

test("1년을 넘는 먼 날짜의 할 일도 10년 안이면 만들고 옮길 수 있다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const overview = await call(request, token, "get_overview", {});
  expect((overview.data.limits as { maxDaysFromToday: number }).maxDaysFromToday).toBe(3650);

  // 앞날도 지난날도 10년까지(366일에 막혀 있다고 AI가 사용자에게 말하던 문제의 재발 방지).
  const made = await call(request, token, "create_todos", {
    todos: [
      { content: "내년 이맘때", date: day(400) },
      { content: "5년 뒤", date: day(1826) },
      { content: "딱 10년 뒤", date: day(3650) },
      { content: "2년 전", date: day(-730) },
    ],
  });
  expect(made.failed).toBe(false);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(4);

  // 옮기기도 같은 범위다.
  const target = await seedTodo(account.id, TODAY, "옮길 할 일");
  expect((await call(request, token, "move_todos", { ids: [target.id], date: day(3650) })).failed).toBe(false);
  expect((await call(request, token, "move_todos", { ids: [target.id], date: day(3651) })).failed).toBe(true);
});

test("토큰마다 바꾸는 요청의 속도를 제한한다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const results = await Promise.all(Array.from({ length: 14 }, (_, index) => call(request, token, "create_todos", { todos: [{ content: `빠른 ${index}`, date: TODAY }] })));
  const failed = results.filter((result) => result.failed);
  expect(failed.length).toBeGreaterThanOrEqual(3);
  expect(failed[0].raw).toContain("Too many changes");
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(results.length - failed.length);
});

test("24시간이 지난 묶음은 되돌릴 수 없고, 7일이 지난 묶음 기록은 다음에 만들 때 지운다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const hours = (count: number) => new Date(Date.now() - count * 3_600_000);
  const todo = await seedTodo(account.id, TODAY, "묵은 묶음의 할 일");
  const yesterday = await prisma.mcpBatch.create({ data: { userId: account.id, todoIds: [todo.id], createdAt: hours(25) } });
  const weekOld = await prisma.mcpBatch.create({ data: { userId: account.id, createdAt: hours(24 * 8) } });

  const undo = await call(request, token, "undo_batch", { batchId: yesterday.id });
  expect(undo.failed).toBe(true);
  expect(await prisma.todo.count({ where: { id: todo.id } })).toBe(1);

  // 만들기가 끝나면 7일 넘은 기록만 지워진다(25시간 된 것은 아직 남는다).
  expect((await call(request, token, "create_todos", { todos: [{ content: "새 묶음", date: TODAY }] })).failed).toBe(false);
  expect(await prisma.mcpBatch.count({ where: { id: weekOld.id } })).toBe(0);
  expect(await prisma.mcpBatch.count({ where: { id: yesterday.id } })).toBe(1);
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

test("설정에서 토큰을 만들면 값이 한 번만 보이고, 그 값으로 /mcp를 쓰고, 지우면 막힌다", async ({ page, request }, testInfo) => {
  const email = `e2e-mcp-ui-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
  await prisma.user.deleteMany({ where: { email } });
  try {
    await signUp(page, email, `엠씨${testInfo.testId.slice(-6)}${RUN_TAG}`);

    await page.goto("/settings/preferences");
    await page.getByRole("link", { name: /AI 연결/ }).click();
    await expect(page.getByRole("heading", { name: "AI 연결" })).toBeVisible();
    await expect(page.getByText("아직 만든 토큰이 없어요")).toBeVisible();
    // 서버 주소는 브라우저가 보고 있는 주소를 쓴다.
    await expect(page.getByLabel("서버 주소")).toHaveValue(/\/mcp$/);

    await page.getByLabel("이름 (어디에 쓰는지)").fill("노트북 Claude Code");
    await page.getByRole("radio", { name: /읽기·쓰기/ }).check();
    await page.getByRole("button", { name: "토큰 만들기" }).click();

    await expect(page.getByRole("heading", { name: "토큰이 만들어졌어요" })).toBeVisible();
    const token = await page.getByLabel("접근 토큰", { exact: true }).inputValue();
    expect(token).toMatch(/^mdr_[A-Za-z0-9_-]{43}$/);
    await expect(page.getByLabel("Claude Code라면 이렇게 넣어요")).toHaveValue(new RegExp(`Authorization: Bearer ${token}`));

    // DB에는 값이 아니라 해시만 있다.
    const stored = await prisma.apiToken.findFirstOrThrow({ where: { user: { email } } });
    expect(stored.tokenHash).not.toContain(token);
    expect(stored).toMatchObject({ name: "노트북 Claude Code", scope: "WRITE", hint: token.slice(0, 8) });

    const made = await call(request, token, "create_todos", { todos: [{ content: "AI가 만든 할 일", date: TODAY }] });
    expect(made.failed).toBe(false);

    // 닫으면 값은 다시 볼 수 없고, 목록에는 이름·권한·앞 8자만 보인다.
    await page.getByRole("button", { name: "복사했어요, 닫기" }).click();
    await page.reload();
    await expect(page.getByLabel("접근 토큰", { exact: true })).toHaveCount(0);
    const row = page.getByRole("listitem").filter({ hasText: "노트북 Claude Code" });
    await expect(row).toContainText("읽기·쓰기");
    await expect(row).toContainText(stored.hint);
    await expect(row).not.toContainText(token);

    // 지우기는 한 번 더 묻고, 지우면 그 토큰은 바로 막힌다.
    await row.getByRole("button", { name: "지우기" }).click();
    await page.getByRole("alert").getByRole("button", { name: "지우기" }).click();
    await expect(page.getByText("아직 만든 토큰이 없어요")).toBeVisible();
    expect((await rpc(request, token, "tools/list")).status).toBe(401);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});
