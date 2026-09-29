import { addDays, formatKST, startOfKSTDayInstant, todayKST, weekdayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

/** 이용한 날(ActiveDay)을 두는 기간. 재방문율(가입 뒤 7일)과 주간 활성에는 넉넉하고, 긴 추이는 DailyStat에 남는다. */
const KEEP_ACTIVE_DAYS = 90;

// 같은 사람을 하루에 한 번만 적어 요청마다 DB에 쓰지 않는다. 서버가 하나라 메모리로 충분하고,
// 재시작해서 잊어도 한 번 더 쓰려다 겹쳐 무시될 뿐이다.
const recordedToday = new Set<string>();
let currentDay: string | null = null;

/**
 * 가입을 마친 사람이 오늘 모도리를 썼다고 적는다(requireUser가 부른다). 하루 합계는 lib/daily.ts가 채운다.
 * 지표를 못 적어도 화면은 그대로 떠야 하므로 오류는 기록만 하고 넘긴다.
 */
export async function recordActiveDay(userId: string): Promise<void> {
  const today = todayKST();
  const key = formatKST(today);
  if (currentDay !== key) {
    currentDay = key;
    recordedToday.clear();
  }
  if (recordedToday.has(userId)) return;

  try {
    await prisma.activeDay.createMany({ data: [{ userId, date: today }], skipDuplicates: true });
    recordedToday.add(userId);
  } catch (error) {
    console.error("[metrics] 이용한 날을 적지 못했다.", error);
  }
}

/** 오늘 포함 최근 90일(오늘~89일 전)의 쓴 날짜만 남긴다. 성공하면 true. */
export async function cleanExpiredActiveDays(today: Date): Promise<boolean> {
  try {
    await prisma.activeDay.deleteMany({ where: { date: { lt: oldestKeptDay(today) } } });
    return true;
  } catch (error) {
    console.error("[metrics] 90일 지난 쓴 날짜를 지우지 못했다.", error);
    return false;
  }
}

function oldestKeptDay(today: Date): Date {
  return addDays(today, 1 - KEEP_ACTIVE_DAYS);
}

/** 한 번에 채우는 날 수. 서버가 오래 꺼져 있었어도 요청 하나가 DB를 오래 붙잡지 않게 나눈다. */
const MAX_SNAPSHOT_DAYS_PER_RUN = 30;

// 합계 채우기의 진행 상태. 서버가 하나라 메모리에 둔다. 재시작하면 처음부터 확인하고, 이미 있는 날은 건너뛴다.
let snapshotsCompleteThrough: string | null = null;
let snapshotRun: Promise<void> | null = null;
let resumeFrom: Date | null = null;

/**
 * 어제까지 빠진 하루 합계를 뒤에서 채운다. 부른 쪽은 기다리지 않는다.
 * 서버가 하루 넘게 꺼져 있었거나 한 날이 실패해도, 다음 요청이 남은 날을 이어서 채운다.
 */
export function ensureSnapshots(yesterday: Date): void {
  const through = formatKST(yesterday);
  if (snapshotsCompleteThrough === through || snapshotRun) return;
  snapshotRun = snapshotMissingDays(yesterday)
    .then((complete) => {
      if (complete) snapshotsCompleteThrough = through;
    })
    .catch((error: unknown) => {
      console.error("[metrics] 하루 합계를 찍지 못했다. 다음 요청 때 다시 한다.", error);
    })
    .finally(() => {
      snapshotRun = null;
    });
}

/**
 * 확인할 첫날: 가장 오래된 합계나 쓴 날짜 가운데 이른 날. 다만 쓴 날짜가 남아 있는 보관 기간(오늘~89일 전)보다
 * 앞은 채우지 않는다. 원본이 지워져 활성 사용자를 셀 수 없다.
 */
async function firstDayToCheck(yesterday: Date): Promise<Date> {
  const [earliestStat, oldestActive] = await Promise.all([
    prisma.dailyStat.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.activeDay.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const known = [earliestStat?.date, oldestActive?.date].filter((date): date is Date => date !== undefined);
  if (known.length === 0) return yesterday;
  const earliest = new Date(Math.min(...known.map((date) => date.getTime())));
  const oldestKept = oldestKeptDay(addDays(yesterday, 1));
  return earliest < oldestKept ? oldestKept : earliest;
}

/** 이번 차례(최대 30일)를 채운다. 어제까지 다 채웠으면 true, 남았으면 false. 한 날이라도 실패하면 던진다. */
async function snapshotMissingDays(yesterday: Date): Promise<boolean> {
  const first = resumeFrom ?? (await firstDayToCheck(yesterday));
  const last = addDays(first, MAX_SNAPSHOT_DAYS_PER_RUN - 1);
  const end = last < yesterday ? last : yesterday;
  const existing = await prisma.dailyStat.findMany({
    where: { date: { gte: first, lte: end } },
    select: { date: true },
  });
  const done = new Set(existing.map(({ date }) => date.getTime()));

  // 한 날이 실패해도 뒤의 날은 채운다. 실패한 날은 다음 요청이 처음부터 다시 확인할 때 채운다.
  let failure: unknown = null;
  for (let day = first; day <= end; day = addDays(day, 1)) {
    if (done.has(day.getTime())) continue;
    try {
      await snapshotDay(day);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== null) {
    resumeFrom = null;
    throw failure;
  }
  if (end < yesterday) {
    resumeFrom = addDays(end, 1);
    return false;
  }
  resumeFrom = null;
  return true;
}

export type Totals = {
  accounts: number;
  users: number;
  withTodo: number;
  withFollow: number;
  withReaction: number;
  follows: number;
};

/** 어느 시각까지의 누적 숫자. 가입 단계별로 몇 명이 남았는지(어디서 멈추는지)를 본다. */
export async function totalsBefore(end: Date): Promise<Totals> {
  const before = { lt: end };
  const joined = { createdAt: before, nickname: { not: null } };
  const [accounts, users, withTodo, withFollow, withReaction, follows] = await Promise.all([
    prisma.user.count({ where: { createdAt: before } }),
    prisma.user.count({ where: joined }),
    prisma.user.count({ where: { ...joined, todos: { some: { createdAt: before } } } }),
    prisma.user.count({ where: { ...joined, following: { some: { createdAt: before } } } }),
    prisma.user.count({ where: { ...joined, reactions: { some: { createdAt: before } } } }),
    prisma.follow.count({ where: { createdAt: before } }),
  ]);
  return { accounts, users, withTodo, withFollow, withReaction, follows };
}

/** 날짜 범위(양 끝 포함)에 한 번이라도 쓴 사람 수. */
export async function activeUsers(from: Date, to: Date, userIds?: string[]): Promise<number> {
  const rows = await prisma.activeDay.groupBy({
    by: ["userId"],
    where: { date: { gte: from, lte: to }, ...(userIds && { userId: { in: userIds } }) },
  });
  return rows.length;
}

/** 그 날 가입한 사람과, 그 가운데 다음 날부터 7일 안에 다시 쓴 사람. 7일이 지나야 셀 수 있다. */
export async function cohortOf(signupDay: Date): Promise<{ size: number; returned: number }> {
  const cohort = await prisma.user.findMany({
    where: {
      nickname: { not: null },
      createdAt: { gte: startOfKSTDayInstant(signupDay), lt: startOfKSTDayInstant(addDays(signupDay, 1)) },
    },
    select: { id: true },
  });
  if (cohort.length === 0) return { size: 0, returned: 0 };
  const returned = await activeUsers(
    addDays(signupDay, 1),
    addDays(signupDay, 7),
    cohort.map((user) => user.id),
  );
  return { size: cohort.length, returned };
}

/** 그 날 하루의 합계를 남긴다. 이미 있으면 먼저 찍은 것을 둔다. */
export async function snapshotDay(day: Date): Promise<void> {
  const start = startOfKSTDayInstant(day);
  const end = startOfKSTDayInstant(addDays(day, 1));
  const [totals, dau, wau, todosCreated, reactionsCreated, cohort] = await Promise.all([
    totalsBefore(end),
    prisma.activeDay.count({ where: { date: day } }),
    activeUsers(addDays(day, -6), day),
    prisma.todo.count({ where: { routineId: null, createdAt: { gte: start, lt: end } } }),
    prisma.reaction.count({ where: { createdAt: { gte: start, lt: end } } }),
    cohortOf(addDays(day, -7)),
  ]);
  await prisma.dailyStat.createMany({
    data: [
      {
        date: day,
        ...totals,
        dau,
        wau,
        todosCreated,
        reactionsCreated,
        cohortSize: cohort.size,
        cohortReturned: cohort.returned,
      },
    ],
    skipDuplicates: true,
  });
}

export type DailyRow = {
  date: Date;
  users: number;
  wau: number;
  todosCreated: number;
  reactionsCreated: number;
  cohortSize: number;
  cohortReturned: number;
};

export type WeekRow = {
  start: Date;
  end: Date;
  users: number;
  wau: number;
  // 앞 주 마지막 누적과의 차이(지운 계정만큼 줄어든 순증). 첫 주는 비교할 것이 없어 null.
  signups: number | null;
  todosCreated: number;
  reactionsCreated: number;
  cohortSize: number;
  cohortReturned: number;
};

/**
 * 날짜별 합계를 주(일요일 시작, 화면의 달력과 같다)로 묶는다. 가입자·주간 활성은 그 주 마지막 기록의 값,
 * 할 일·반응·재방문은 더한다.
 */
export function groupByWeek(rows: DailyRow[]): WeekRow[] {
  const weeks = new Map<string, WeekRow>();
  for (const row of [...rows].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const start = addDays(row.date, -weekdayKST(row.date));
    const key = formatKST(start);
    const week = weeks.get(key) ?? {
      start,
      end: addDays(start, 6),
      users: 0,
      wau: 0,
      signups: null,
      todosCreated: 0,
      reactionsCreated: 0,
      cohortSize: 0,
      cohortReturned: 0,
    };
    week.users = row.users;
    week.wau = row.wau;
    week.todosCreated += row.todosCreated;
    week.reactionsCreated += row.reactionsCreated;
    week.cohortSize += row.cohortSize;
    week.cohortReturned += row.cohortReturned;
    weeks.set(key, week);
  }

  const list = [...weeks.values()];
  list.forEach((week, index) => {
    week.signups = index === 0 ? null : week.users - list[index - 1].users;
  });
  return list;
}

/** 0~100 정수 퍼센트. 분모가 0이면 셀 수 없으니 null. */
export function percent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}
