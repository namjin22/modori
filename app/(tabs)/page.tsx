import { HomeView, type HomeData } from "@/components/home-view";
import { avatarUrl } from "@/lib/avatar";
import {
  daysBetween,
  endOfMonthKST,
  formatKST,
  formatMonthKST,
  parseKSTDate,
  parseKSTMonth,
  startOfMonthKST,
  todayIn,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { groupReceivedReactions } from "@/lib/reactions";
import { ensureRoutineTodos, listRoutineRange } from "@/lib/routine-todos";
import { requireUser } from "@/lib/session";

function readDate(raw: string | undefined, today: Date): Date {
  if (!raw) return today;

  try {
    return parseKSTDate(raw);
  } catch (error) {
    // 주소창을 손으로 고친 경우. 오늘로 돌린다.
    console.error("[feed] 날짜 형식이 잘못됐다.", error);
    return today;
  }
}

/** 달력에 보여줄 달. 주소에 없거나 잘못됐으면 고른 날이 속한 달. */
function readMonth(raw: string | undefined, fallback: Date): Date {
  if (!raw) return startOfMonthKST(fallback);

  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[feed] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(fallback);
  }
}

const EVENT_SELECT = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  color: true,
  memo: true,
  dday: true,
} as const;

const EVENT_ORDER = [
  // 손으로 바꾼 순서가 먼저다(components/event-section.tsx). 안 바꾼 일정은 모두 0이라 아래 순서를 따른다.
  { sortOrder: "asc" },
  { startDate: "asc" },
  { startTime: { sort: "asc", nulls: "first" } },
  { createdAt: "asc" },
] as const;

/**
 * 홈. 보이는 달 한 달치(와 고른 날)를 한 번에 받아 HomeView에 넘긴다. 달 안에서 날짜를 바꾸는 것은 브라우저가 한다.
 * 고른 날마다 서버를 다녀오던 때는 날짜를 누를 때마다 0.5~1초씩 기다렸다(docs/decisions.md "한 달치를 한 번에").
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayIn(user.timezone);
  const date = readDate(params.date, today);
  // 한 달 달력을 모든 화면 폭에서 늘 보인다. 예전 주소의 view=month는 무시한다.
  const monthStart = readMonth(params.month, date);
  const monthEnd = endOfMonthKST(monthStart);
  // 받아 둘 기간: 보이는 달, 그리고 달 밖의 날을 골라 둔 경우 그 날까지.
  const from = daysBetween(date, monthStart) > 0 ? date : monthStart;
  const to = daysBetween(monthEnd, date) > 0 ? date : monthEnd;

  // 이 날짜를 여는 순간 루틴 할 일이 없으면 만든다. 미래 날짜에는 만들지 않는다.
  await ensureRoutineTodos(user, date);

  const [todos, categories, routines, events, upcoming] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: { order: "asc" },
      select: {
        id: true,
        date: true,
        content: true,
        done: true,
        doneAt: true,
        color: true,
        memo: true,
        category: { select: { id: true, name: true, color: true } },
        // 친구가 보낸 반응. 할 일 밑에 투두메이트처럼 보여준다(내가 내 일에 보낼 수는 없다).
        reactions: {
          where: { userId: { not: user.id } },
          orderBy: { createdAt: "asc" },
          select: { emoji: true, user: { select: { nickname: true } } },
        },
      },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, isPublic: true },
    }),
    listRoutineRange(user, from, to),
    // 기간에 조금이라도 걸쳐 있는 일정. 고른 날의 일정도 여기서 고른다.
    prisma.event.findMany({
      where: { userId: user.id, startDate: { lte: to }, endDate: { gte: from } },
      orderBy: [...EVENT_ORDER],
      select: EVENT_SELECT,
    }),
    // 아직 오지 않은 일정. 그 날짜를 열어보지 않아도 시험이 며칠 남았는지 보인다.
    // 보고 있는 날이 아니라 오늘을 기준으로 센다. 고른 날과 겹치는 것을 빼고 셋을 보여주는데,
    // 고른 날이 브라우저에서 바뀌므로 넉넉히 보내고 HomeView가 자른다.
    prisma.event.findMany({
      // D-day를 끈 일정은 "다가오는 일정"에 올리지 않는다(사용자가 고른 것만 남긴다).
      where: { userId: user.id, startDate: { gt: today }, dday: true },
      orderBy: [...EVENT_ORDER],
      select: EVENT_SELECT,
      take: 20,
    }),
  ]);

  const data: HomeData = {
    profile: { nickname: user.nickname, bio: user.bio, avatar: avatarUrl(user) },
    today: formatKST(today),
    initialDate: formatKST(date),
    month: formatMonthKST(monthStart),
    from: formatKST(from),
    to: formatKST(to),
    todos: todos.map(({ reactions, date: day, doneAt, ...todo }) => ({
      ...todo,
      date: formatKST(day),
      doneAt: doneAt?.getTime() ?? null,
      received: groupReceivedReactions(
        reactions.map((reaction) => ({ emoji: reaction.emoji, nickname: reaction.user.nickname })),
      ),
    })),
    categories,
    scheduled: routines.scheduled,
    pending: routines.pending,
    events,
    upcoming,
  };

  return <HomeView data={data} />;
}
