import { expect } from "@playwright/test";

import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { call, day, makeToken, seedTodo, test, TODAY } from "./mcp-helpers";

// AI 연결(MCP)의 세부 할 일(2026-11-20 운영자 요청). 앱의 규칙과 같다: 큰 할 일과 같은 날·같은 카테고리, 두 단계, 큰 할 일을 옮기면 안 끝낸 세부 할 일이 따라가고,
// 지우면 같이 지워지며 undo_batch가 함께 되살린다.

type Row = { id: string; content: string; parentId?: string; date: string };

const todosOn = async (request: Parameters<typeof call>[0], token: string, from: string, to = from) =>
  ((await call(request, token, "list_todos", { from, to })).data.todos as Row[]).map(({ id, content, parentId, date }) => ({ id, content, parentId, date }));

test("create_todos의 parentId로 세부 할 일을 달면 큰 할 일의 날짜·카테고리를 따르고, list_todos에 parentId가 보인다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const category = await prisma.category.create({ data: { userId: account.id, name: "공부", color: "#2563eb", order: 0 } });
  const parent = await seedTodo(account.id, TODAY, "포트폴리오 완성", { categoryId: category.id });

  // 날짜를 안 적어도 되고, 적으면 큰 할 일과 같아야 한다. 카테고리도 마찬가지다.
  const made = await call(request, token, "create_todos", {
    todos: [{ content: "메인 페이지 디자인", parentId: parent.id }, { content: "배포하기", parentId: parent.id, date: TODAY, category: "공부" }],
  });
  expect(made.failed, made.raw).toBe(false);
  const created = made.data.created as { id: string; parentId?: string }[];
  expect(created.map((todo) => todo.parentId)).toEqual([parent.id, parent.id]);

  const rows = await prisma.todo.findMany({ where: { parentId: parent.id }, orderBy: { order: "asc" } });
  expect(rows.map((row) => row.content)).toEqual(["메인 페이지 디자인", "배포하기"]);
  for (const row of rows) {
    expect(row.categoryId).toBe(category.id);
    expect(formatKST(row.date)).toBe(TODAY);
    expect(row.memoPublic).toBe(false);
  }
  const listed = await todosOn(request, token, TODAY);
  expect(listed.find((todo) => todo.content === "메인 페이지 디자인")?.parentId).toBe(parent.id);
  expect(listed.find((todo) => todo.id === parent.id)?.parentId).toBeUndefined();

  // 되돌리기는 이 호출이 만든 세부 할 일만 지운다. 큰 할 일은 그대로다.
  const undo = await call(request, token, "undo_batch", { batchId: made.data.batchId });
  expect(undo.failed, undo.raw).toBe(false);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(1);
});

test("세부 할 일을 달 수 없는 곳은 아무것도 만들지 않고 이유를 알린다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const parent = await seedTodo(account.id, TODAY, "큰 할 일");
  const child = await prisma.todo.create({ data: { userId: account.id, content: "이미 세부", date: parent.date, parentId: parent.id, order: 1 } });
  const routine = await prisma.routine.create({ data: { userId: account.id, content: "루틴", freq: "DAILY", startDate: parent.date } });
  const fromRoutine = await prisma.todo.create({ data: { userId: account.id, content: "루틴이 만든 일", date: parent.date, routineId: routine.id, order: 2 } });

  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["세부 할 일 밑에는 또 달 수 없다", { content: "손자", parentId: child.id }, /only two levels/i],
    ["루틴이 만든 할 일에는 달 수 없다", { content: "루틴 밑", parentId: fromRoutine.id }, /routine/i],
    ["없는 큰 할 일", { content: "고아", parentId: "does-not-exist" }, /not found/i],
    ["큰 할 일과 다른 날", { content: "다른 날", parentId: parent.id, date: day(1) }, /same day|parent's date/i],
  ];
  for (const [name, todo, pattern] of cases) {
    const result = await call(request, token, "create_todos", { todos: [{ content: "정상", date: TODAY }, todo] });
    expect(result.failed, name).toBe(true);
    expect(result.raw, name).toMatch(pattern);
  }
  // 날짜도 parentId도 없으면 입력 검증에서 막힌다.
  expect((await call(request, token, "create_todos", { todos: [{ content: "날짜 없음" }] })).failed).toBe(true);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(3);
});

test("큰 할 일을 옮기면 안 끝낸 세부 할 일이 따라가고, 세부 할 일만은 옮기지 못한다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const parent = await seedTodo(account.id, TODAY, "큰 할 일");
  const open = await prisma.todo.create({ data: { userId: account.id, content: "안 끝낸 세부", date: parent.date, parentId: parent.id, order: 1 } });
  const done = await prisma.todo.create({ data: { userId: account.id, content: "끝낸 세부", date: parent.date, parentId: parent.id, order: 2, done: true, doneAt: new Date() } });

  // 세부 할 일만 옮기려 하면 옮기지 않고 알린다.
  const alone = await call(request, token, "move_todos", { ids: [open.id], date: day(2) });
  expect(alone.failed, alone.raw).toBe(false);
  expect(alone.data.moved).toBe(0);
  expect(alone.data.subTodosNotMoved).toEqual([open.id]);
  expect(formatKST((await prisma.todo.findUniqueOrThrow({ where: { id: open.id } })).date)).toBe(TODAY);

  const moved = await call(request, token, "move_todos", { ids: [parent.id], date: day(2) });
  expect(moved.failed, moved.raw).toBe(false);
  expect(moved.data.moved).toBe(1);
  expect(moved.data.subTodosMovedAlong).toBe(1);
  const after = Object.fromEntries((await prisma.todo.findMany({ where: { userId: account.id } })).map((row) => [row.id, row]));
  expect(formatKST(after[parent.id].date)).toBe(day(2));
  expect(formatKST(after[open.id].date)).toBe(day(2));
  expect(after[open.id].parentId).toBe(parent.id);
  // 끝낸 세부 할 일은 그 날의 기록이라 남고 연결만 끊긴다.
  expect(formatKST(after[done.id].date)).toBe(TODAY);
  expect(after[done.id].parentId).toBeNull();
});

test("큰 할 일을 지우면 세부 할 일도 같이 지워지고, undo_batch가 함께 되살린다. 세부 할 일만 지우면 큰 할 일은 그대로다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const parent = await seedTodo(account.id, TODAY, "큰 할 일");
  const a = await prisma.todo.create({ data: { userId: account.id, content: "세부 가", date: parent.date, parentId: parent.id, order: 1 } });
  const b = await prisma.todo.create({ data: { userId: account.id, content: "세부 나", date: parent.date, parentId: parent.id, order: 2, done: true, doneAt: new Date() } });

  // 세부 할 일 하나만 지우고 되돌리면 같은 큰 할 일 밑으로 돌아온다.
  const one = await call(request, token, "delete_todos", { ids: [a.id] });
  expect(one.failed, one.raw).toBe(false);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(2);
  expect((await call(request, token, "undo_batch", { batchId: one.data.batchId })).failed).toBe(false);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: a.id } })).parentId).toBe(parent.id);

  // 큰 할 일을 지우면 세부 할 일도 사라진다.
  const all = await call(request, token, "delete_todos", { ids: [parent.id] });
  expect(all.failed, all.raw).toBe(false);
  expect(all.data.deleted).toBe(3);
  expect(all.data.subTodosDeletedAlong).toBe(2);
  expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(0);

  const undo = await call(request, token, "undo_batch", { batchId: all.data.batchId });
  expect(undo.failed, undo.raw).toBe(false);
  const rows = await prisma.todo.findMany({ where: { userId: account.id }, orderBy: { order: "asc" } });
  expect(rows.map((row) => [row.id, row.parentId, row.done])).toEqual([
    [parent.id, null, false],
    [a.id, parent.id, false],
    [b.id, parent.id, true],
  ]);
});

test("세부 할 일의 카테고리는 따로 바꿀 수 없고, 큰 할 일의 카테고리를 바꾸면 세부 할 일도 따라간다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const first = await prisma.category.create({ data: { userId: account.id, name: "가", color: "#2563eb", order: 0 } });
  const second = await prisma.category.create({ data: { userId: account.id, name: "나", color: "#dc2626", order: 1 } });
  const parent = await seedTodo(account.id, TODAY, "큰 할 일", { categoryId: first.id });
  const child = await prisma.todo.create({ data: { userId: account.id, content: "세부", date: parent.date, parentId: parent.id, categoryId: first.id, order: 1 } });

  const alone = await call(request, token, "update_todos", { updates: [{ id: child.id, category: "나" }] });
  expect(alone.failed).toBe(true);
  expect(alone.raw).toMatch(/sub-todo/i);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: child.id } })).categoryId).toBe(first.id);

  const moved = await call(request, token, "update_todos", { updates: [{ id: parent.id, category: "나" }] });
  expect(moved.failed, moved.raw).toBe(false);
  const rows = await prisma.todo.findMany({ where: { id: { in: [parent.id, child.id] } } });
  expect(rows.map((row) => row.categoryId)).toEqual([second.id, second.id]);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: child.id } })).parentId).toBe(parent.id);

  // 글만 고치는 것은 세부 할 일에도 된다.
  const edited = await call(request, token, "update_todos", { updates: [{ id: child.id, content: "고친 세부" }] });
  expect(edited.failed, edited.raw).toBe(false);
});
