import { expect, type Page } from "@playwright/test";

import { formatKST, parseKSTDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";
import { call, day, deleteOther, makeOther, makeToken, seedTodo, test, toolNames, TODAY } from "./mcp-helpers";

// 모든 권한(FULL) 토큰과 새 조회 도구(2026-11-16, docs/mcp.md): 고치기·지우기·되돌리기, 카테고리·루틴, 프로필·설정, 친구·반응, 친구의 공개 정보 읽기.
// 핵심 도구(만들기·끝내기·옮기기)는 mcp.spec.ts가 시험한다.

const READ = ["get_overview", "get_profile", "list_events", "list_people", "list_routines", "list_todos", "search_users"];
const WRITE = [...READ, "complete_todos", "create_events", "create_todos", "move_todos", "undo_batch"];
const FULL = [
  ...WRITE,
  "create_category",
  "create_routine",
  "delete_category",
  "delete_events",
  "delete_routine",
  "delete_todos",
  "follow_user",
  "remove_follower",
  "set_reaction",
  "unfollow_user",
  "update_category",
  "update_events",
  "update_profile",
  "update_routine",
  "update_settings",
  "update_todos",
  "unfollow_user",
].filter((name, index, all) => all.indexOf(name) === index);
const FRIEND_READS = ["list_friend_events", "list_friend_todos"];

test.beforeEach(() => {
  test.slow();
});

/** 같은 토큰으로 속도 제한(바꾸는 요청 10번, 남에게 닿는 일 5번)을 넘기지 않도록, 단계가 바뀔 때 새 토큰을 쓴다. */
const renew = async (userId: string) => (await makeToken(userId, "FULL")).token;

test("권한마다 보이는 도구가 다르고, 친구 읽기는 따로 켠 토큰에만 보인다", async ({ request, account }) => {
  expect(await toolNames(request, (await makeToken(account.id, "READ")).token)).toEqual([...READ].sort());
  expect(await toolNames(request, (await makeToken(account.id, "WRITE")).token)).toEqual([...WRITE].sort());
  expect(await toolNames(request, (await makeToken(account.id, "FULL")).token)).toEqual([...FULL].sort());
  // 친구 읽기는 권한(scope)과 별개의 허락이다.
  expect(await toolNames(request, (await makeToken(account.id, "READ", { allowFriends: true })).token)).toEqual([...READ, ...FRIEND_READS].sort());
});

test("쓰기 토큰은 모든 권한 도구를 부를 수 없다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const todo = await seedTodo(account.id, TODAY, "지우면 안 되는 일");
  const attempts: [string, unknown][] = [
    ["delete_todos", { ids: [todo.id] }],
    ["update_todos", { updates: [{ id: todo.id, content: "바꿈" }] }],
    ["create_category", { name: "새", color: "#2563eb" }],
    ["update_profile", { bio: "바꿈" }],
  ];
  for (const [name, args] of attempts) expect((await call(request, token, name, args)).failed, name).toBe(true);
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: todo.id } })).toMatchObject({ content: "지우면 안 되는 일" });
});

test("할 일 고치기: 글·메모·카테고리를 바꾸고, 전부 아니면 무이며, 되돌린다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const study = await prisma.category.create({ data: { userId: account.id, name: "공부", color: "#2563eb", order: 0 } });
  const life = await prisma.category.create({ data: { userId: account.id, name: "생활", color: "#16a34a", order: 1 } });
  const a = await seedTodo(account.id, TODAY, "수학", { categoryId: study.id, memo: "p.30" });
  const b = await seedTodo(account.id, TODAY, "청소", { categoryId: life.id, order: 1 });
  await prisma.todo.update({ where: { id: b.id }, data: { color: "#ff0000" } });

  const done = await call(request, token, "update_todos", {
    updates: [
      { id: a.id, content: "수학 3단원", memo: null, category: "생활" },
      { id: b.id, memo: "창문도", memoPublic: true },
    ],
  });
  expect(done.failed).toBe(false);
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ content: "수학 3단원", memo: null, categoryId: life.id });
  // 카테고리를 옮기면 따로 고른 색은 버리지만, 옮기지 않으면 그대로다.
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ memo: "창문도", memoPublic: true, color: "#ff0000", categoryId: life.id });

  // 하나라도 문제면 아무것도 바뀌지 않는다: 없는 id, 없는 카테고리, 같은 id 두 번, 바꿀 칸 없음.
  const before = await prisma.todo.findMany({ where: { userId: account.id }, orderBy: { id: "asc" } });
  for (const bad of [
    { updates: [{ id: a.id, content: "정상" }, { id: "no-such-id", content: "문제" }] },
    { updates: [{ id: a.id, content: "정상" }, { id: b.id, category: "없는 카테고리" }] },
    { updates: [{ id: a.id, content: "하나" }, { id: a.id, content: "둘" }] },
    { updates: [{ id: a.id }] },
    { updates: [{ id: a.id, content: "" }] },
  ]) {
    expect((await call(request, token, "update_todos", bad)).failed).toBe(true);
  }
  expect(await prisma.todo.findMany({ where: { userId: account.id }, orderBy: { id: "asc" } })).toEqual(before);

  // 되돌리기: 글·메모·카테고리가 고치기 전으로 돌아온다.
  const undone = await call(request, token, "undo_batch", { batchId: done.data.batchId });
  expect(undone.failed).toBe(false);
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ content: "수학", memo: "p.30", categoryId: study.id });
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ memo: null, memoPublic: true });
});

test("할 일 지우기: 루틴이 만든 것은 다시 안 생기고, 되돌리면 그대로 돌아오며, 남의 것은 못 지운다", async ({ request, account }, testInfo) => {
  const { token } = await makeToken(account.id, "FULL");
  const category = await prisma.category.create({ data: { userId: account.id, name: "운동", color: "#ef4444", order: 0 } });
  const routine = await prisma.routine.create({ data: { userId: account.id, content: "줄넘기", freq: "DAILY", startDate: parseKSTDate(TODAY), categoryId: category.id } });
  const fromRoutine = await prisma.todo.create({ data: { userId: account.id, content: "줄넘기", date: parseKSTDate(TODAY), routineId: routine.id, categoryId: category.id, done: true, doneAt: new Date(), memo: "100개" } });
  const plain = await seedTodo(account.id, day(1), "스쿼트", { categoryId: category.id });
  const other = await makeOther(`${testInfo.testId.slice(-6)}`, "남");
  try {
    const theirs = await seedTodo(other.id, TODAY, "남의 일");

    const deleted = await call(request, token, "delete_todos", { ids: [fromRoutine.id, plain.id, theirs.id, "no-such-id"] });
    expect(deleted.failed).toBe(false);
    expect(deleted.data).toMatchObject({ deleted: 2 });
    expect((deleted.data.notFound as string[]).sort()).toEqual([theirs.id, "no-such-id"].sort());
    expect(await prisma.todo.count({ where: { userId: account.id } })).toBe(0);
    expect(await prisma.todo.count({ where: { id: theirs.id } })).toBe(1);
    // 루틴이 만든 할 일을 지웠으니 그 날은 건너뛴다고 남는다(안 남기면 화면을 다시 그릴 때 되살아난다).
    expect(await prisma.routineSkip.count({ where: { routineId: routine.id } })).toBe(1);

    const undone = await call(request, token, "undo_batch", { batchId: deleted.data.batchId });
    expect(undone.failed).toBe(false);
    expect(undone.data).toMatchObject({ restoredTodos: 2, skipped: [] });
    expect(await prisma.todo.findUniqueOrThrow({ where: { id: fromRoutine.id } })).toMatchObject({ content: "줄넘기", done: true, memo: "100개", routineId: routine.id, categoryId: category.id });
    expect(await prisma.todo.findUniqueOrThrow({ where: { id: plain.id } })).toMatchObject({ content: "스쿼트", done: false });
    expect(formatKST((await prisma.todo.findUniqueOrThrow({ where: { id: plain.id } })).date)).toBe(day(1));
    expect(await prisma.routineSkip.count({ where: { routineId: routine.id } })).toBe(0);
    // 한 번 쓴 묶음은 다시 쓸 수 없다.
    expect((await call(request, token, "undo_batch", { batchId: deleted.data.batchId })).failed).toBe(true);
  } finally {
    await deleteOther(other.id);
  }
});

test("지운 할 일을 되돌릴 때 그 날이 이미 꽉 찼으면 되돌리지 못한 것으로 알려 준다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const target = await seedTodo(account.id, TODAY, "지울 일");
  const deleted = await call(request, token, "delete_todos", { ids: [target.id] });
  await prisma.todo.createMany({ data: Array.from({ length: 50 }, (_, index) => ({ userId: account.id, content: `채움 ${index}`, date: parseKSTDate(TODAY), order: index })) });

  const undone = await call(request, token, "undo_batch", { batchId: deleted.data.batchId });
  expect(undone.failed).toBe(false);
  expect(undone.data).toMatchObject({ restoredTodos: 0 });
  expect((undone.data.skipped as { id: string }[]).map((entry) => entry.id)).toEqual([target.id]);
  expect(await prisma.todo.count({ where: { id: target.id } })).toBe(0);
});

test("일정 고치기·지우기: 시각 규칙·하루 상한을 지키고, 숨기면 메모도 숨으며, 되돌린다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const event = await prisma.event.create({
    data: { userId: account.id, title: "동아리", startDate: parseKSTDate(day(2)), endDate: parseKSTDate(day(2)), startTime: 16 * 60, endTime: 18 * 60, color: "#2563eb", memo: "회의실", isPublic: true, memoPublic: true },
  });

  const changed = await call(request, token, "update_events", { updates: [{ id: event.id, title: "동아리 모임", endDate: day(3), isPublic: false }] });
  expect(changed.failed).toBe(false);
  const row = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(row).toMatchObject({ title: "동아리 모임", isPublic: false, memoPublic: false, startTime: 16 * 60, endTime: 18 * 60 });
  expect(formatKST(row.endDate)).toBe(day(3));

  // 시작 시각을 지우면(하루 종일) 끝 시각도 같이 지워진다.
  expect((await call(request, token, "update_events", { updates: [{ id: event.id, startTime: null }] })).failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ startTime: null, endTime: null });

  // 규칙을 어기면 하나도 바뀌지 않는다: 시작 시각 없이 끝 시각만, 끝 날짜가 시작보다 이름, 366일 초과.
  for (const bad of [{ endTime: "10:00" }, { endDate: day(1) }, { endDate: day(500) }]) {
    expect((await call(request, token, "update_events", { updates: [{ id: event.id, ...bad }] })).failed, JSON.stringify(bad)).toBe(true);
  }
  expect(formatKST((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).endDate)).toBe(day(3));

  // 하루 5개 상한: 이미 다섯이 찬 날로 옮기면 막힌다(자기 자신은 세지 않는다).
  await prisma.event.createMany({ data: Array.from({ length: 5 }, (_, index) => ({ userId: account.id, title: `꽉 ${index}`, startDate: parseKSTDate(day(10)), endDate: parseKSTDate(day(10)), color: "#ef4444" })) });
  expect((await call(request, token, "update_events", { updates: [{ id: event.id, startDate: day(10), endDate: day(10) }] })).failed).toBe(true);

  // 첫 고치기를 되돌리면 글·기간·공개 여부가 처음으로 돌아온다(두 번째 고치기 전의 모습이므로 시각은 지금 값이다).
  const undone = await call(request, token, "undo_batch", { batchId: changed.data.batchId });
  expect(undone.failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ title: "동아리", isPublic: true, memoPublic: true });
  expect(formatKST((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).endDate)).toBe(day(2));

  const deleted = await call(request, token, "delete_events", { ids: [event.id, "no-such-id"] });
  expect(deleted.data).toMatchObject({ deleted: 1, notFound: ["no-such-id"] });
  expect(await prisma.event.count({ where: { id: event.id } })).toBe(0);
  const back = await call(request, token, "undo_batch", { batchId: deleted.data.batchId });
  expect(back.data).toMatchObject({ restoredEvents: 1, skipped: [] });
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ title: "동아리", memo: "회의실" });
});

test("카테고리: 만들고 고치고 지우고 되돌린다(지우면 할 일은 남고 루틴은 멈춘다)", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");

  const made = await call(request, token, "create_category", { name: "독서", color: "#9333EA" });
  expect(made.failed).toBe(false);
  const id = made.data.id as string;
  // AI가 만든 카테고리는 기본이 비공개다.
  expect(await prisma.category.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "독서", color: "#9333ea", isPublic: false });

  const fixed = await call(request, token, "update_category", { id, name: "책 읽기", isPublic: true });
  expect(fixed.data).toMatchObject({ previous: { name: "독서", visibleToFollowers: false }, now: { name: "책 읽기", visibleToFollowers: true } });
  expect((await call(request, token, "update_category", { id })).failed).toBe(true);
  expect((await call(request, token, "update_category", { id: "no-such-id", name: "x" })).failed).toBe(true);

  const routine = await prisma.routine.create({ data: { userId: account.id, content: "30분 읽기", freq: "DAILY", startDate: parseKSTDate(TODAY), categoryId: id } });
  const todo = await seedTodo(account.id, TODAY, "1장", { categoryId: id });

  const deleted = await call(request, token, "delete_category", { id });
  expect(deleted.data).toMatchObject({ todosKeptWithoutCategory: 1, routinesPaused: 1 });
  expect(await prisma.category.count({ where: { id } })).toBe(0);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: todo.id } })).categoryId).toBeNull();
  expect((await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } })).pausedAt).not.toBeNull();

  const undone = await call(request, token, "undo_batch", { batchId: deleted.data.batchId });
  expect(undone.failed).toBe(false);
  expect(await prisma.category.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "책 읽기", isPublic: true });
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: todo.id } })).categoryId).toBe(id);
  expect(await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } })).toMatchObject({ categoryId: id, pausedAt: null });
});

test("카테고리는 열 개까지만 만들 수 있다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  await prisma.category.createMany({ data: Array.from({ length: 10 }, (_, index) => ({ userId: account.id, name: `칸${index}`, color: "#2563eb", order: index })) });
  expect((await call(request, token, "create_category", { name: "열한째", color: "#2563eb" })).failed).toBe(true);
  expect(await prisma.category.count({ where: { userId: account.id } })).toBe(10);
});

test("루틴: 규칙을 검사하고, 고치고, 멈추고, 지우고 되돌린다(할 일 루틴과 반복 일정)", async ({ request, account }) => {
  let token = await renew(account.id);
  const category = await prisma.category.create({ data: { userId: account.id, name: "운동", color: "#ef4444", order: 0 } });
  const other = await prisma.category.create({ data: { userId: account.id, name: "공부", color: "#2563eb", order: 1 } });

  // 규칙 검사: 요일·날짜 없는 주간·월간, 카테고리 없는 할 일 루틴, 끝 날짜가 시작보다 이름.
  for (const bad of [
    { title: "나쁨1", category: "운동", frequency: "WEEKLY" },
    { title: "나쁨2", category: "운동", frequency: "MONTHLY" },
    { title: "나쁨3", frequency: "DAILY" },
    { title: "나쁨4", category: "운동", frequency: "DAILY", startDate: day(5), endDate: day(1) },
  ]) {
    expect((await call(request, token, "create_routine", bad)).failed, bad.title).toBe(true);
  }
  expect(await prisma.routine.count({ where: { userId: account.id } })).toBe(0);

  const made = await call(request, token, "create_routine", { title: "러닝", category: "운동", frequency: "WEEKLY", weekdays: [3, 1, 1] });
  expect(made.failed).toBe(false);
  const id = made.data.id as string;
  expect(await prisma.routine.findUniqueOrThrow({ where: { id } })).toMatchObject({ content: "러닝", freq: "WEEKLY", byWeekday: [1, 3], byMonthday: [], categoryId: category.id });

  // 오늘 이후의 안 끝낸 할 일은 새 이름·카테고리로 따라 바뀐다. 끝낸 일은 기록이라 그대로다.
  const future = await prisma.todo.create({ data: { userId: account.id, content: "러닝", date: parseKSTDate(day(2)), routineId: id, categoryId: category.id } });
  const finished = await prisma.todo.create({ data: { userId: account.id, content: "러닝", date: parseKSTDate(day(3)), routineId: id, categoryId: category.id, done: true, doneAt: new Date() } });
  const edited = await call(request, token, "update_routine", { id, title: "조깅", category: "공부", frequency: "MONTHLY", monthdays: [5, 20] });
  expect(edited.data).toMatchObject({ kind: "todo", previous: { title: "러닝", frequency: "WEEKLY", weekdays: [1, 3] } });
  expect(await prisma.routine.findUniqueOrThrow({ where: { id } })).toMatchObject({ content: "조깅", freq: "MONTHLY", byWeekday: [], byMonthday: [5, 20], categoryId: other.id });
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: future.id } })).toMatchObject({ content: "조깅", categoryId: other.id });
  expect(await prisma.todo.findUniqueOrThrow({ where: { id: finished.id } })).toMatchObject({ content: "러닝", categoryId: category.id });
  // 요일 없이 주간으로 바꾸면 막힌다.
  expect((await call(request, token, "update_routine", { id, frequency: "WEEKLY" })).failed).toBe(true);

  expect((await call(request, token, "update_routine", { id, paused: true })).failed).toBe(false);
  expect((await prisma.routine.findUniqueOrThrow({ where: { id } })).pausedAt).not.toBeNull();
  expect((await call(request, token, "update_routine", { id, paused: false })).failed).toBe(false);
  expect((await prisma.routine.findUniqueOrThrow({ where: { id } })).pausedAt).toBeNull();

  // 반복 일정
  token = await renew(account.id);
  const eventMade = await call(request, token, "create_routine", { kind: "event", title: "스터디", frequency: "WEEKLY", weekdays: [2], startTime: "19:00", endTime: "21:00", color: "#16A34A" });
  expect(eventMade.failed).toBe(false);
  const eventId = eventMade.data.id as string;
  // 기본은 비공개다.
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ title: "스터디", isPublic: false, startTime: 19 * 60, endTime: 21 * 60, color: "#16a34a" });
  const eventEdited = await call(request, token, "update_routine", { id: eventId, startTime: null, isPublic: true });
  expect(eventEdited.failed).toBe(false);
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ startTime: null, endTime: null, isPublic: true });
  expect((await call(request, token, "update_routine", { id: eventId, category: "운동" })).failed).toBe(true);

  const listed = await call(request, token, "list_routines", {});
  expect((listed.data.routines as { id: string; kind: string }[]).map((row) => [row.id, row.kind]).sort()).toEqual([[eventId, "event"], [id, "todo"]].sort());

  // 지우면 이미 만든 할 일은 남고, 되돌리면 루틴과 다시 이어진다.
  const deleted = await call(request, token, "delete_routine", { id });
  expect(deleted.data).toMatchObject({ kind: "todo", todosKept: 2 });
  expect(await prisma.routine.count({ where: { id } })).toBe(0);
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: future.id } })).routineId).toBeNull();
  expect((await call(request, token, "undo_batch", { batchId: deleted.data.batchId })).failed).toBe(false);
  expect(await prisma.routine.findUniqueOrThrow({ where: { id } })).toMatchObject({ content: "조깅", categoryId: other.id });
  expect((await prisma.todo.findUniqueOrThrow({ where: { id: future.id } })).routineId).toBe(id);

  const eventDeleted = await call(request, token, "delete_routine", { id: eventId });
  expect(eventDeleted.data).toMatchObject({ kind: "event" });
  expect(await prisma.eventRoutine.count({ where: { id: eventId } })).toBe(0);
  expect((await call(request, token, "undo_batch", { batchId: eventDeleted.data.batchId })).failed).toBe(false);
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ title: "스터디" });
});

test("루틴은 할 일 루틴과 반복 일정을 합쳐 쉰 개까지다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "FULL");
  const category = await prisma.category.create({ data: { userId: account.id, name: "운동", color: "#ef4444", order: 0 } });
  await prisma.routine.createMany({ data: Array.from({ length: 30 }, (_, index) => ({ userId: account.id, content: `루${index}`, freq: "DAILY" as const, startDate: parseKSTDate(TODAY), categoryId: category.id })) });
  await prisma.eventRoutine.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ userId: account.id, title: `반${index}`, color: "#2563eb", freq: "DAILY" as const, startDate: parseKSTDate(TODAY) })) });
  expect((await call(request, token, "create_routine", { title: "쉰한째", category: "운동", frequency: "DAILY" })).failed).toBe(true);
  expect((await call(request, token, "create_routine", { kind: "event", title: "쉰한째", frequency: "DAILY" })).failed).toBe(true);
});

test("프로필과 설정: 규칙을 지키고, 바꾸기 전 값을 돌려준다", async ({ request, account }, testInfo) => {
  let token = await renew(account.id);
  const other = await makeOther(`${testInfo.testId.slice(-6)}`, "남");
  try {
    const profile = await call(request, token, "get_profile", {});
    expect(profile.data).toMatchObject({ nickname: account.nickname, timezone: "Asia/Seoul", notifyFriendDone: true, eventDigestMinute: 360, eventDigestTime: "06:00" });

    const edited = await call(request, token, "update_profile", { bio: "안녕하세요", avatarCharacter: "dori" });
    expect(edited.data).toMatchObject({ previous: { bio: null }, now: { bio: "안녕하세요", avatarCharacter: "dori" } });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ bio: "안녕하세요", avatarCharacter: "dori" });
    // 빈 문자열은 소개를 지운다.
    expect((await call(request, token, "update_profile", { bio: "" })).failed).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).bio).toBeNull();

    // 닉네임: 남이 쓰는 이름(대소문자 달라도), 너무 긴 이름, 없는 캐릭터는 안 된다.
    expect((await call(request, token, "update_profile", { nickname: other.nickname?.toUpperCase() })).failed).toBe(true);
    expect((await call(request, token, "update_profile", { nickname: "가".repeat(21) })).failed).toBe(true);
    expect((await call(request, token, "update_profile", { avatarCharacter: "없는캐릭터" })).failed).toBe(true);
    expect((await call(request, token, "update_profile", {})).failed).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).nickname).toBe(account.nickname);
    const renamed = await call(request, token, "update_profile", { nickname: `새${account.tag}` });
    expect(renamed.failed).toBe(false);

    token = await renew(account.id);
    const settings = await call(request, token, "update_settings", { timezone: "America/New_York", notifyFriendDone: false, hideFromRecommend: true, eventDigestMinute: 480 });
    expect(settings.data).toMatchObject({ previous: { timezone: "Asia/Seoul", notifyFriendDone: true, hideFromRecommend: false, eventDigestMinute: 360 } });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ timezone: "America/New_York", notifyFriendDone: false, hideFromRecommend: true, eventDigestMinute: 480 });
    // 5분 단위가 아니거나, 모르는 시간대이거나, 바꿀 것이 없으면 거절한다.
    for (const bad of [{ eventDigestMinute: 481 }, { timezone: "Mars/Olympus" }, {}]) expect((await call(request, token, "update_settings", bad)).failed, JSON.stringify(bad)).toBe(true);
    // null은 오늘 일정 알림을 끈다.
    expect((await call(request, token, "update_settings", { eventDigestMinute: null })).failed).toBe(false);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ eventDigestMinute: null, eventDigestSentOn: null });
  } finally {
    await deleteOther(other.id);
  }
});

test("친구: 찾고, 팔로우하고, 끊고, 목록을 본다(차단한 사람은 없는 사람이다)", async ({ request, account }, testInfo) => {
  let token = await renew(account.id);
  const tag = testInfo.testId.slice(-6);
  const friend = await makeOther(tag, "친구");
  const stranger = await makeOther(tag, "낯선");
  const blocked = await makeOther(tag, "차단");
  try {
    await prisma.block.create({ data: { blockerId: account.id, blockedId: blocked.id } });

    // 공유 시험 DB에는 다른 실행이 만든 "친구…" 사용자가 많아, 이 시험이 만든 사람의 전체 닉네임으로 찾는다.
    const found = await call(request, token, "search_users", { query: friend.nickname });
    expect((found.data.users as { nickname: string; following: boolean }[]).map((user) => [user.nickname, user.following])).toEqual([[friend.nickname, false]]);
    expect(((await call(request, token, "search_users", { query: blocked.nickname })).data.users as unknown[]).length).toBe(0);

    const followed = await call(request, token, "follow_user", { nickname: friend.nickname?.toUpperCase() });
    expect(followed.data).toMatchObject({ following: friend.nickname, alreadyFollowing: false });
    expect(await prisma.follow.count({ where: { followerId: account.id, followingId: friend.id } })).toBe(1);
    expect((await call(request, token, "follow_user", { nickname: friend.nickname })).data).toMatchObject({ alreadyFollowing: true });
    // 차단한 사람·없는 사람·나 자신은 팔로우할 수 없다.
    for (const nickname of [blocked.nickname, "없는사람", account.nickname]) expect((await call(request, token, "follow_user", { nickname })).failed, String(nickname)).toBe(true);

    // 나를 따르는 사람을 끊는다.
    token = await renew(account.id);
    await prisma.follow.create({ data: { followerId: stranger.id, followingId: account.id } });
    expect(((await call(request, token, "list_people", { kind: "followers" })).data.people as { nickname: string }[]).map((person) => person.nickname)).toEqual([stranger.nickname]);
    expect((await call(request, token, "remove_follower", { nickname: stranger.nickname })).data).toMatchObject({ removed: true });
    expect(await prisma.follow.count({ where: { followingId: account.id } })).toBe(0);

    expect(((await call(request, token, "list_people", { kind: "following" })).data.people as { nickname: string }[]).map((person) => person.nickname)).toEqual([friend.nickname]);
    expect((await call(request, token, "unfollow_user", { nickname: friend.nickname })).data).toMatchObject({ unfollowed: true });
    expect(await prisma.follow.count({ where: { followerId: account.id } })).toBe(0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [friend.id, stranger.id, blocked.id] } } });
  }
});

test("친구의 공개 정보 읽기: 토큰에서 켜야 하고, 팔로우한 사람의 공개된 것만 나온다", async ({ request, account }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  const friend = await makeOther(tag, "친구");
  const stranger = await makeOther(tag, "낯선");
  const blocker = await makeOther(tag, "나를차단");
  try {
    const open = await prisma.category.create({ data: { userId: friend.id, name: "공개", color: "#2563eb", order: 0, isPublic: true } });
    const secret = await prisma.category.create({ data: { userId: friend.id, name: "비밀", color: "#ef4444", order: 1, isPublic: false } });
    await prisma.todo.createMany({
      data: [
        { userId: friend.id, content: "공개 할 일", date: parseKSTDate(TODAY), categoryId: open.id, memo: "공개 메모", memoPublic: true, order: 0 },
        { userId: friend.id, content: "메모 숨김", date: parseKSTDate(TODAY), categoryId: open.id, memo: "숨긴 메모", memoPublic: false, order: 1 },
        { userId: friend.id, content: "비공개 카테고리", date: parseKSTDate(TODAY), categoryId: secret.id, order: 2 },
        { userId: friend.id, content: "카테고리 없음", date: parseKSTDate(TODAY), order: 3 },
      ],
    });
    await prisma.event.createMany({
      data: [
        { userId: friend.id, title: "공개 일정", startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), color: "#2563eb", isPublic: true, memo: "일정 메모", memoPublic: true },
        { userId: friend.id, title: "비공개 일정", startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), color: "#2563eb", isPublic: false },
      ],
    });
    await prisma.eventRoutine.create({ data: { userId: friend.id, title: "공개 반복", color: "#16a34a", freq: "DAILY", startDate: parseKSTDate(TODAY), isPublic: true } });
    await prisma.eventRoutine.create({ data: { userId: friend.id, title: "비공개 반복", color: "#16a34a", freq: "DAILY", startDate: parseKSTDate(TODAY), isPublic: false } });

    // 허락하지 않은 토큰에는 도구가 보이지도 않고, 불러도 거절한다(권한이 FULL이어도 마찬가지).
    const closed = await makeToken(account.id, "FULL");
    expect((await toolNames(request, closed.token)).filter((name) => name.startsWith("list_friend"))).toEqual([]);
    expect((await call(request, closed.token, "list_friend_todos", { nickname: friend.nickname, from: TODAY })).failed).toBe(true);

    const { token } = await makeToken(account.id, "READ", { allowFriends: true });
    // 팔로우하지 않은 사람은 볼 수 없다.
    const notFollowing = await call(request, token, "list_friend_todos", { nickname: friend.nickname, from: TODAY });
    expect(notFollowing.failed).toBe(true);
    expect(notFollowing.raw).toContain("follow");

    await prisma.follow.create({ data: { followerId: account.id, followingId: friend.id } });
    const todos = await call(request, token, "list_friend_todos", { nickname: friend.nickname, from: TODAY });
    expect(todos.failed).toBe(false);
    const rows = todos.data.todos as { content: string; memo?: string; category: string | null }[];
    // 공개 카테고리의 할 일만, 메모는 공개로 켠 것만.
    expect(rows.map((row) => row.content).sort()).toEqual(["공개 할 일", "메모 숨김"]);
    expect(rows.find((row) => row.content === "공개 할 일")).toMatchObject({ memo: "공개 메모", category: "공개" });
    expect(rows.find((row) => row.content === "메모 숨김")?.memo).toBeUndefined();
    expect(JSON.stringify(todos.data)).not.toContain("숨긴 메모");

    const events = await call(request, token, "list_friend_events", { nickname: friend.nickname, from: TODAY });
    const titles = (events.data.events as { title: string; memo?: string; repeats: boolean }[]);
    expect(titles.map((event) => event.title).sort()).toEqual(["공개 반복", "공개 일정"]);
    expect(titles.find((event) => event.title === "공개 일정")?.memo).toBe("일정 메모");
    expect(titles.find((event) => event.title === "공개 반복")?.repeats).toBe(true);

    // 기간 규칙은 내 것과 같다. 나를 차단한 사람은 없는 사람이다.
    expect((await call(request, token, "list_friend_todos", { nickname: friend.nickname, from: TODAY, to: day(100) })).failed).toBe(true);
    await prisma.block.create({ data: { blockerId: blocker.id, blockedId: account.id } });
    await prisma.follow.create({ data: { followerId: account.id, followingId: blocker.id } });
    expect((await call(request, token, "list_friend_todos", { nickname: blocker.nickname, from: TODAY })).failed).toBe(true);
    expect((await call(request, token, "list_friend_todos", { nickname: stranger.nickname, from: TODAY })).failed).toBe(true);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [friend.id, stranger.id, blocker.id] } } });
  }
});

test("반응: 팔로우한 사람의 끝낸 공개 할 일에만 보낼 수 있고, 취소할 수 있다", async ({ request, account }, testInfo) => {
  let token = await renew(account.id);
  const friend = await makeOther(testInfo.testId.slice(-6), "친구");
  try {
    const open = await prisma.category.create({ data: { userId: friend.id, name: "공개", color: "#2563eb", order: 0, isPublic: true } });
    const secret = await prisma.category.create({ data: { userId: friend.id, name: "비밀", color: "#ef4444", order: 1, isPublic: false } });
    const done = await seedTodo(friend.id, TODAY, "끝낸 공개 일", { categoryId: open.id, done: true });
    const notDone = await seedTodo(friend.id, TODAY, "안 끝낸 일", { categoryId: open.id });
    const hidden = await seedTodo(friend.id, TODAY, "끝낸 비공개 일", { categoryId: secret.id, done: true });

    // 팔로우하지 않았으면 안 된다.
    expect((await call(request, token, "set_reaction", { todoId: done.id, emoji: "👍" })).failed).toBe(true);
    await prisma.follow.create({ data: { followerId: account.id, followingId: friend.id } });

    // 안 끝낸 일, 비공개 카테고리의 일, 목록 밖의 글자는 안 된다.
    for (const bad of [{ todoId: notDone.id, emoji: "👍" }, { todoId: hidden.id, emoji: "👍" }, { todoId: done.id, emoji: "x" }, { todoId: "no-such-id", emoji: "👍" }]) {
      expect((await call(request, token, "set_reaction", bad)).failed, JSON.stringify(bad)).toBe(true);
    }
    expect(await prisma.reaction.count({ where: { userId: account.id } })).toBe(0);

    token = await renew(account.id);
    expect((await call(request, token, "set_reaction", { todoId: done.id, emoji: "🔥" })).data).toMatchObject({ reacted: true });
    expect(await prisma.reaction.findMany({ where: { userId: account.id }, select: { emoji: true, todoUserId: true } })).toEqual([{ emoji: "🔥", todoUserId: friend.id }]);
    // 같은 반응을 또 보내도 하나뿐이다.
    expect((await call(request, token, "set_reaction", { todoId: done.id, emoji: "🔥" })).data).toMatchObject({ alreadyReacted: true });
    expect(await prisma.reaction.count({ where: { userId: account.id } })).toBe(1);

    // 취소는 언팔로우한 뒤에도 된다.
    await prisma.follow.deleteMany({ where: { followerId: account.id } });
    expect((await call(request, token, "set_reaction", { todoId: done.id, emoji: "🔥", on: false })).data).toMatchObject({ reacted: false, removed: true });
    expect(await prisma.reaction.count({ where: { userId: account.id } })).toBe(0);
  } finally {
    await deleteOther(friend.id);
  }
});

test("남의 데이터는 모든 권한 도구로도 못 건드린다", async ({ request, account }, testInfo) => {
  const { token } = await makeToken(account.id, "FULL");
  const other = await makeOther(testInfo.testId.slice(-6), "남");
  try {
    const category = await prisma.category.create({ data: { userId: other.id, name: "남의 칸", color: "#2563eb", order: 0 } });
    const todo = await seedTodo(other.id, TODAY, "남의 일", { categoryId: category.id });
    const event = await prisma.event.create({ data: { userId: other.id, title: "남의 일정", startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), color: "#2563eb" } });
    const routine = await prisma.routine.create({ data: { userId: other.id, content: "남의 루틴", freq: "DAILY", startDate: parseKSTDate(TODAY), categoryId: category.id } });

    const attempts: [string, unknown][] = [
      ["update_todos", { updates: [{ id: todo.id, content: "해킹" }] }],
      ["update_events", { updates: [{ id: event.id, title: "해킹" }] }],
      ["update_category", { id: category.id, name: "해킹" }],
      ["delete_category", { id: category.id }],
      ["update_routine", { id: routine.id, title: "해킹" }],
      ["delete_routine", { id: routine.id }],
    ];
    for (const [name, args] of attempts) expect((await call(request, token, name, args)).failed, name).toBe(true);
    expect((await call(request, token, "delete_todos", { ids: [todo.id] })).data).toMatchObject({ deleted: 0, notFound: [todo.id] });
    expect((await call(request, token, "delete_events", { ids: [event.id] })).data).toMatchObject({ deleted: 0, notFound: [event.id] });
    // 남이 만든 묶음은 되돌릴 수 없다.
    const batch = await prisma.mcpBatch.create({ data: { userId: other.id, snapshot: { kind: "todos-deleted", rows: [] } } });
    expect((await call(request, token, "undo_batch", { batchId: batch.id })).failed).toBe(true);

    expect(await prisma.todo.findUniqueOrThrow({ where: { id: todo.id } })).toMatchObject({ content: "남의 일" });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ title: "남의 일정" });
    expect(await prisma.category.findUniqueOrThrow({ where: { id: category.id } })).toMatchObject({ name: "남의 칸" });
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } })).toMatchObject({ content: "남의 루틴" });
  } finally {
    await deleteOther(other.id);
  }
});

test("모든 권한 도구도 바꾸는 요청의 속도 제한을 받고, 남에게 닿는 일은 더 좁게 센다", async ({ request, account }, testInfo) => {
  const { token } = await makeToken(account.id, "FULL");
  const people = await Promise.all(["가", "나", "다", "라", "마", "바", "사"].map((label) => makeOther(`${testInfo.testId.slice(-6)}${label}`, "팔")));
  try {
    // 팔로우는 5번까지 한꺼번에, 그다음은 막힌다.
    const results = await Promise.all(people.map((person) => call(request, token, "follow_user", { nickname: person.nickname })));
    const failed = results.filter((result) => result.failed);
    expect(failed.length).toBeGreaterThanOrEqual(2);
    expect(failed[0].raw).toMatch(/Too many/);
    expect(await prisma.follow.count({ where: { followerId: account.id } })).toBe(results.length - failed.length);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: people.map((person) => person.id) } } });
  }
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

test("설정에서 모든 권한 토큰을 만들 때 친구 읽기는 따로 고르고 기본은 꺼져 있다", async ({ page, request }, testInfo) => {
  const email = `e2e-mcpf-ui-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
  await prisma.user.deleteMany({ where: { email } });
  try {
    await signUp(page, email, `엠화${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.goto("/settings/ai");
    await expect(page.getByRole("heading", { name: "AI 연결" })).toBeVisible();

    // 권한은 읽기만이 기본이고, 친구 읽기는 꺼져 있다. 모든 권한에는 위험을 알리는 설명이 붙는다.
    await expect(page.getByRole("radio", { name: /^읽기만/ })).toBeChecked();
    const friends = page.getByRole("checkbox", { name: /친구의 공개 할 일·일정 읽기/ });
    await expect(friends).not.toBeChecked();
    await expect(page.getByText("토큰이 새면 가장 위험해요")).toBeVisible();

    // 모든 권한 + 친구 읽기 끔
    await page.getByLabel("이름 (어디에 쓰는지)").fill("모든 권한 시험");
    await page.getByRole("radio", { name: /모든 권한/ }).check();
    await page.getByRole("button", { name: "토큰 만들기" }).click();
    await expect(page.getByRole("heading", { name: "토큰이 만들어졌어요" })).toBeVisible();
    const first = await page.getByLabel("접근 토큰", { exact: true }).inputValue();
    expect(await prisma.apiToken.findFirstOrThrow({ where: { user: { email }, name: "모든 권한 시험" }, select: { scope: true, allowFriends: true } })).toEqual({ scope: "FULL", allowFriends: false });
    expect((await toolNames(request, first)).includes("update_todos")).toBe(true);
    expect((await toolNames(request, first)).includes("list_friend_todos")).toBe(false);
    await page.getByRole("button", { name: "복사했어요, 닫기" }).click();

    // 읽기만 + 친구 읽기 켬
    await page.getByLabel("이름 (어디에 쓰는지)").fill("친구 읽기 시험");
    await page.getByRole("radio", { name: /^읽기만/ }).check();
    await friends.check();
    await page.getByRole("button", { name: "토큰 만들기" }).click();
    await expect(page.getByRole("heading", { name: "토큰이 만들어졌어요" })).toBeVisible();
    const second = await page.getByLabel("접근 토큰", { exact: true }).inputValue();
    expect(await prisma.apiToken.findFirstOrThrow({ where: { user: { email }, name: "친구 읽기 시험" }, select: { scope: true, allowFriends: true } })).toEqual({ scope: "READ", allowFriends: true });
    const names = await toolNames(request, second);
    expect(names.includes("list_friend_todos")).toBe(true);
    expect(names.includes("update_todos")).toBe(false);
    await page.getByRole("button", { name: "복사했어요, 닫기" }).click();

    // 목록에는 권한과 친구 읽기 표시가 보인다.
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "모든 권한 시험" })).toContainText("모든 권한");
    await expect(page.getByRole("listitem").filter({ hasText: "모든 권한 시험" })).not.toContainText("친구 정보 읽기");
    await expect(page.getByRole("listitem").filter({ hasText: "친구 읽기 시험" })).toContainText("친구 정보 읽기");
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

// 2026-11-16 요청: 이름은 "AI 연결(MCP)"이고, 들어가자마자 긴 설명이 아니라 연결 방법·서버 주소·토큰 만들기·내 토큰이 보이며, 설명·도움말은 아래에서 눌러야 펴진다.
test("AI 연결(MCP) 화면은 핵심 기능이 위에 있고, 긴 설명은 아래에서 눌러야 펴진다", async ({ page }, testInfo) => {
  const email = `e2e-mcpf-help-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
  await prisma.user.deleteMany({ where: { email } });
  try {
    await signUp(page, email, `도움${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.goto("/settings/preferences");
    await page.getByRole("link", { name: /AI 연결\(MCP\)/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "AI 연결(MCP)" })).toBeVisible();

    // 핵심: 연결 방법과 서버 주소, 토큰 만들기, 내 토큰이 이 순서로 바로 보인다.
    const sections = ["연결하는 방법", "새 토큰 만들기", "내 접근 토큰", "자세한 설명과 도움말"];
    const tops: number[] = [];
    for (const name of sections) {
      const heading = page.getByRole("heading", { level: 2, name, exact: true });
      await expect(heading).toBeVisible();
      tops.push((await heading.boundingBox())?.y ?? -1);
    }
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    await expect(page.getByLabel("서버 주소")).toBeVisible();
    await expect(page.getByRole("button", { name: "토큰 만들기" })).toBeVisible();

    // 긴 설명은 접혀 있다: 열린 칸이 없고, 설명 글이 보이지 않는다.
    await expect(page.locator("details")).toHaveCount(7);
    await expect(page.locator("details[open]")).toHaveCount(0);
    const about = page.getByText("모도리가 AI를 돌리는 게 아니라");
    await expect(about).toBeHidden();

    // 제목을 누르면 펴지고, 다시 누르면 접힌다. 키보드(Enter)로도 된다.
    const summary = page.getByText("AI 연결(MCP)이 뭐예요?", { exact: true });
    await summary.click();
    await expect(about).toBeVisible();
    await expect(page.locator("details[open]")).toHaveCount(1);
    await summary.click();
    await expect(about).toBeHidden();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(about).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});
