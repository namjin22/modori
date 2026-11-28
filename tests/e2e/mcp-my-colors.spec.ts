import { expect } from "@playwright/test";

import { parseKSTDate } from "@/lib/date";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";

import { call, day, deleteOther, makeOther, makeToken, test, TODAY } from "./mcp-helpers";

// AI 연결(MCP)로 "내 색"(이름 붙은 색, EventCategory)을 읽고 쓴다(2026-11-26 운영자 결정). 도구는 늘리지 않고 kind=event로 카테고리 도구를 쓴다.

test.beforeEach(() => {
  test.slow();
});

/** 같은 토큰으로 속도 제한(바꾸는 요청 10번)을 넘기지 않도록 단계가 바뀔 때 새 토큰을 쓴다. */
const renew = async (userId: string) => (await makeToken(userId, "FULL")).token;

const named = (userId: string, name: string, color: string, order = 0) => prisma.eventCategory.create({ data: { userId, name, color, order } });
const eventOf = (userId: string, title: string, color: string, categoryId: string | null = null) =>
  prisma.event.create({ data: { userId, title, startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), color, categoryId } });

test("읽기 토큰도 내 색 목록과, 일정·반복 일정이 쓰는 색의 이름을 읽는다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "READ");
  const school = await named(account.id, "학교", "#7c3aed");
  await eventOf(account.id, "발표", "#7c3aed", school.id);
  await eventOf(account.id, "이름 없는 일정", "#ffffff");
  await prisma.eventRoutine.create({ data: { userId: account.id, title: "매일 학원", color: "#7c3aed", categoryId: school.id, freq: "DAILY", startDate: parseKSTDate(TODAY) } });

  const overview = await call(request, token, "get_overview", {});
  expect(overview.failed).toBe(false);
  expect(overview.data.eventCategories).toEqual([{ id: school.id, name: "학교", color: "#7c3aed" }]);
  expect((overview.data.limits as { eventCategories: number }).eventCategories).toBe(LIMITS.eventCategories);

  const events = await call(request, token, "list_events", { from: TODAY });
  const rows = events.data.events as { title: string; category: { id: string; name: string } | null }[];
  expect(rows.find((row) => row.title === "발표")?.category).toEqual({ id: school.id, name: "학교" });
  expect(rows.find((row) => row.title === "이름 없는 일정")?.category).toBeNull();

  const routines = await call(request, token, "list_routines", {});
  const repeating = (routines.data.routines as { kind: string; title: string; category?: { name: string } | null }[]).find((row) => row.kind === "event");
  expect(repeating?.category?.name).toBe("학교");

  // 읽기 토큰은 만들 수 없다.
  expect((await call(request, token, "create_category", { kind: "event", name: "새", color: "#2563eb" })).failed).toBe(true);
});

test("쓰기 토큰은 내 색을 이름이나 id로 골라 일정을 만들고, 색과 함께 주거나 없는 이름이면 아무것도 만들지 않는다", async ({ request, account }) => {
  const { token } = await makeToken(account.id, "WRITE");
  const exam = await named(account.id, "시험", "#f97316");

  const made = await call(request, token, "create_events", {
    events: [
      { title: "이름으로", startDate: TODAY, category: "시험" },
      { title: "대소문자 무시", startDate: TODAY, category: " 시험 " },
      { title: "id로", startDate: TODAY, category: exam.id },
    ],
  });
  expect(made.failed).toBe(false);
  const rows = await prisma.event.findMany({ where: { userId: account.id }, orderBy: { title: "asc" } });
  expect(rows).toHaveLength(3);
  for (const row of rows) expect(row).toMatchObject({ color: "#f97316", categoryId: exam.id });

  const before = await prisma.event.count({ where: { userId: account.id } });
  const both = await call(request, token, "create_events", { events: [{ title: "둘 다", startDate: TODAY, color: "#2563eb", category: "시험" }] });
  expect(both.failed).toBe(true);
  expect(both.raw).toContain("either color or category");
  const missing = await call(request, token, "create_events", { events: [{ title: "없는 색", startDate: TODAY, category: "없는 이름" }] });
  expect(missing.failed).toBe(true);
  expect(missing.raw).toContain("시험");
  expect(await prisma.event.count({ where: { userId: account.id } })).toBe(before);

  // 쓰기 토큰은 내 색 도구를 못 쓴다(모든 권한 전용).
  expect((await call(request, token, "update_events", { updates: [{ id: rows[0].id, category: null }] })).failed).toBe(true);
});

test("모든 권한: 일정에 내 색을 붙이고 떼고, 색을 손으로 바꾸면 이름이 떨어지며, 되돌리면 그대로 돌아온다", async ({ request, account }) => {
  const token = await renew(account.id);
  const exam = await named(account.id, "시험", "#f97316");
  const trip = await named(account.id, "여행", "#06b6d4", 1);
  const event = await eventOf(account.id, "모의고사", "#ffffff");

  // 붙이면 그 색과 이름이 된다.
  const attach = await call(request, token, "update_events", { updates: [{ id: event.id, category: "시험" }] });
  expect(attach.failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: exam.id, color: "#f97316" });

  // 다른 색으로 옮긴다.
  expect((await call(request, token, "update_events", { updates: [{ id: event.id, category: trip.id }] })).failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: trip.id, color: "#06b6d4" });

  // 색을 손으로 바꾸면 이름이 떨어진다. 둘을 함께 주면 거절한다.
  expect((await call(request, token, "update_events", { updates: [{ id: event.id, color: "#111827", category: "시험" }] })).failed).toBe(true);
  const manual = await call(request, token, "update_events", { updates: [{ id: event.id, color: "#111827" }] });
  expect(manual.failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: null, color: "#111827" });

  // 되돌리면 손으로 바꾸기 전(여행)으로 돌아온다.
  expect((await call(request, token, "undo_batch", { batchId: manual.data.batchId })).failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: trip.id, color: "#06b6d4" });

  // null이면 이름만 떼고 색은 남긴다.
  const detach = await renew(account.id);
  expect((await call(request, detach, "update_events", { updates: [{ id: event.id, category: null }] })).failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: null, color: "#06b6d4" });

  // 지운 일정을 되돌리면 이름이 붙어 있던 일정은 내 색이 아직 있을 때 다시 이어진다.
  await prisma.event.update({ where: { id: event.id }, data: { categoryId: exam.id, color: "#f97316" } });
  const deleted = await call(request, detach, "delete_events", { ids: [event.id] });
  expect(deleted.failed).toBe(false);
  expect((await call(request, detach, "undo_batch", { batchId: deleted.data.batchId })).failed).toBe(false);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ categoryId: exam.id, color: "#f97316" });
});

test("모든 권한: kind=event 카테고리 도구로 내 색을 만들고, 고치면 같은 색인 일정만 따라가고, 지우면 색은 남고 되돌리면 이어진다", async ({ request, account }) => {
  const token = await renew(account.id);

  const created = await call(request, token, "create_category", { kind: "event", name: "약속", color: "#F97316" });
  expect(created.failed).toBe(false);
  const id = created.data.id as string;
  expect(await prisma.eventCategory.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "약속", color: "#f97316", userId: account.id });
  // 할 일 카테고리와 따로다.
  expect(await prisma.category.count({ where: { userId: account.id } })).toBe(0);

  // 같은 이름(대소문자 무시)과 isPublic은 거절한다.
  expect((await call(request, token, "create_category", { kind: "event", name: " 약속 ", color: "#2563eb" })).failed).toBe(true);
  const publicOne = await call(request, token, "create_category", { kind: "event", name: "공개", color: "#2563eb", isPublic: true });
  expect(publicOne.failed).toBe(true);
  expect(publicOne.raw).toContain("isPublic");

  const same = await eventOf(account.id, "색 같은 일정", "#f97316", id);
  const other = await eventOf(account.id, "색 바꾼 일정", "#111827", id);
  const repeat = await prisma.eventRoutine.create({
    data: { userId: account.id, title: "매일 약속", color: "#f97316", categoryId: id, freq: "DAILY", startDate: parseKSTDate(TODAY) },
  });

  const edited = await call(request, token, "update_category", { kind: "event", id, name: "모임", color: "#22c55e" });
  expect(edited.failed).toBe(false);
  expect(edited.data).toMatchObject({ previous: { name: "약속", color: "#f97316" }, now: { name: "모임", color: "#22c55e" } });
  expect((await prisma.event.findUniqueOrThrow({ where: { id: same.id } })).color).toBe("#22c55e");
  expect((await prisma.event.findUniqueOrThrow({ where: { id: other.id } })).color).toBe("#111827");
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).color).toBe("#22c55e");
  // 바꿀 칸이 없거나 todo용 칸(isPublic)을 주면 거절한다.
  expect((await call(request, token, "update_category", { kind: "event", id })).failed).toBe(true);
  expect((await call(request, token, "update_category", { kind: "event", id, isPublic: true })).failed).toBe(true);
  // kind를 안 주면 할 일 카테고리를 찾는다(기존 동작 그대로): 내 색 id는 못 찾는다.
  expect((await call(request, token, "update_category", { id, name: "엉뚱" })).failed).toBe(true);

  const removeToken = await renew(account.id);
  const removed = await call(request, removeToken, "delete_category", { kind: "event", id });
  expect(removed.failed).toBe(false);
  expect(removed.data).toMatchObject({ deleted: "모임", eventsKeptWithColor: 2, repeatingEventsKeptWithColor: 1 });
  expect(await prisma.eventCategory.count({ where: { userId: account.id } })).toBe(0);
  expect(await prisma.event.findUniqueOrThrow({ where: { id: same.id } })).toMatchObject({ categoryId: null, color: "#22c55e" });
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).categoryId).toBeNull();

  const undone = await call(request, removeToken, "undo_batch", { batchId: removed.data.batchId });
  expect(undone.failed).toBe(false);
  expect(await prisma.eventCategory.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "모임", color: "#22c55e" });
  expect((await prisma.event.findUniqueOrThrow({ where: { id: same.id } })).categoryId).toBe(id);
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).categoryId).toBe(id);
});

test("색을 안 주고 만든 일정과 반복 일정은 색 없음(중립 회색)이다", async ({ request, account }) => {
  const token = await renew(account.id);
  const made = await call(request, token, "create_events", { events: [{ title: "색 없는 일정", startDate: TODAY }] });
  expect(made.failed).toBe(false);
  expect((await prisma.event.findFirstOrThrow({ where: { userId: account.id, title: "색 없는 일정" } })).color).toBe("#8b95a1");
  const routine = await call(request, token, "create_routine", { kind: "event", title: "색 없는 반복", frequency: "DAILY", startDate: TODAY });
  expect(routine.failed).toBe(false);
  expect((await prisma.eventRoutine.findFirstOrThrow({ where: { userId: account.id, title: "색 없는 반복" } })).color).toBe("#8b95a1");
});

test("모든 권한: 내 색은 한 사람 20개까지다", async ({ request, account }) => {
  const token = await renew(account.id);
  await prisma.eventCategory.createMany({
    data: Array.from({ length: LIMITS.eventCategories }, (_, index) => ({ userId: account.id, name: `색${index}`, color: "#2563eb", order: index })),
  });
  const over = await call(request, token, "create_category", { kind: "event", name: "하나 더", color: "#2563eb" });
  expect(over.failed).toBe(true);
  expect(over.raw).toContain(String(LIMITS.eventCategories));
});

test("모든 권한: 반복 일정을 내 색으로 만들고 고치며, 할 일 루틴에는 null 카테고리를 거절한다", async ({ request, account }) => {
  const token = await renew(account.id);
  const school = await named(account.id, "학교", "#7c3aed");
  const todoCategory = await prisma.category.create({ data: { userId: account.id, name: "공부", color: "#2563eb", order: 0 } });

  const made = await call(request, token, "create_routine", { kind: "event", title: "매일 수업", frequency: "DAILY", category: "학교", startDate: TODAY });
  expect(made.failed).toBe(false);
  const routineId = made.data.id as string;
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ categoryId: school.id, color: "#7c3aed" });

  // 색과 내 색을 함께 주거나 없는 이름이면 거절한다.
  expect((await call(request, token, "create_routine", { kind: "event", title: "둘 다", frequency: "DAILY", category: "학교", color: "#2563eb" })).failed).toBe(true);
  expect((await call(request, token, "create_routine", { kind: "event", title: "없는 색", frequency: "DAILY", category: "없음" })).failed).toBe(true);

  // 색을 손으로 바꾸면 이름이 떨어지고, 내 색으로 옮기면 다시 붙으며, null은 이름만 뗀다.
  expect((await call(request, token, "update_routine", { id: routineId, color: "#111827" })).failed).toBe(false);
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ categoryId: null, color: "#111827" });
  const again = await renew(account.id);
  expect((await call(request, again, "update_routine", { id: routineId, category: school.id })).failed).toBe(false);
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ categoryId: school.id, color: "#7c3aed" });
  expect((await call(request, again, "update_routine", { id: routineId, category: null })).failed).toBe(false);
  expect(await prisma.eventRoutine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ categoryId: null, color: "#7c3aed" });

  // 할 일 루틴의 카테고리는 null로 비울 수 없다(카테고리 없이 돌면 적을 칸이 없다).
  const todoRoutine = await prisma.routine.create({ data: { userId: account.id, content: "책 읽기", freq: "DAILY", startDate: parseKSTDate(TODAY), categoryId: todoCategory.id } });
  const nullTodo = await call(request, again, "update_routine", { id: todoRoutine.id, category: null });
  expect(nullTodo.failed).toBe(true);
  expect((await prisma.routine.findUniqueOrThrow({ where: { id: todoRoutine.id } })).categoryId).toBe(todoCategory.id);

  // 반복 일정을 지우고 되돌리면 내 색도 다시 이어진다.
  await prisma.eventRoutine.update({ where: { id: routineId }, data: { categoryId: school.id } });
  const deleted = await call(request, again, "delete_routine", { id: routineId });
  expect(deleted.failed).toBe(false);
  expect((await call(request, again, "undo_batch", { batchId: deleted.data.batchId })).failed).toBe(false);
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: routineId } })).categoryId).toBe(school.id);
});

test("친구의 일정을 읽어도 내 색의 이름과 id는 나가지 않는다", async ({ request, account }, testInfo) => {
  const { token } = await makeToken(account.id, "READ", { allowFriends: true });
  const friend = await makeOther(testInfo.testId.slice(-6), "친");
  try {
    const secret = await named(friend.id, "비밀이름색", "#7c3aed");
    await prisma.event.create({
      data: { userId: friend.id, title: "공개 일정", startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), color: "#7c3aed", categoryId: secret.id, isPublic: true },
    });
    await prisma.eventRoutine.create({
      data: { userId: friend.id, title: "공개 반복", color: "#7c3aed", categoryId: secret.id, freq: "DAILY", startDate: parseKSTDate(day(-1)), isPublic: true },
    });
    await prisma.follow.create({ data: { followerId: account.id, followingId: friend.id } });

    const result = await call(request, token, "list_friend_events", { nickname: friend.nickname, from: TODAY });
    expect(result.failed).toBe(false);
    expect((result.data.events as unknown[]).length).toBe(2);
    expect(result.raw).not.toContain("비밀이름색");
    expect(result.raw).not.toContain(secret.id);
  } finally {
    await deleteOther(friend.id);
  }
});
