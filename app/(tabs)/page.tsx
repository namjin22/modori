import Link from "next/link";

import {
  addDays,
  endOfMonthKST,
  formatKST,
  isSameKSTDate,
  parseKSTDate,
  parseKSTMonth,
  startOfMonthKST,
  todayKST,
  weekdayKST,
} from "@/lib/date";
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import {
  ensureRoutineTodos,
  listScheduledRoutines,
} from "@/lib/routine-todos";
import { requireUser } from "@/lib/session";

import { CategoryAdder } from "@/components/category-adder";
import { Dori } from "@/components/dori";
import { type DayEvent, EventSection } from "@/components/event-section";
import {
  type CalendarEvent,
  type DaySummary,
  MonthCalendar,
} from "@/components/month-calendar";
import { ScheduledRoutineRow } from "@/components/scheduled-routine-row";
import { SortableTodoList } from "@/components/sortable-todo-list";
import { CalendarIcon } from "@/components/tab-icons";
import { TodoRow } from "@/components/todo-row";
import { TodoProgress } from "@/components/todo-progress";
import { WeekStrip } from "@/components/week-strip";

import { Avatar } from "@/components/avatar";


const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
// 카테고리를 고르지 않은 할 일도 달력에 흔적은 남아야 한다.
const NO_CATEGORY_COLOR = "#8b95a1";

function readDate(raw: string | undefined): Date {
  if (!raw) return todayKST();

  try {
    return parseKSTDate(raw);
  } catch (error) {
    // 주소창을 손으로 고친 경우. 오늘로 돌린다.
    console.error("[feed] 날짜 형식이 잘못됐다.", error);
    return todayKST();
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

function formatHeading(date: Date): string {
  const [, month, day] = formatKST(date).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(date)]}요일`;
}

type RangeTodo = {
  date: Date;
  done: boolean;
  color: string | null;
  category: { color: string } | null;
};

/** 기간 안의 할 일을 날짜별 요약(전체 수, 완료한 일의 색)으로 접는다. */
function summarizeByDate(todos: RangeTodo[]): Map<string, DaySummary> {
  const summaries = new Map<string, DaySummary>();
  for (const todo of todos) {
    const key = formatKST(todo.date);
    const summary = summaries.get(key) ?? { total: 0, doneColors: [] };
    summary.total += 1;
    if (todo.done) {
      // 할 일에 따로 고른 색이 있으면 그것, 없으면 카테고리 색.
      summary.doneColors.push(
        todo.color ?? todo.category?.color ?? NO_CATEGORY_COLOR,
      );
    }
    summaries.set(key, summary);
  }
  return summaries;
}

/** 여러 날에 걸친 일정을 달력의 각 날짜에 펼쳐 놓는다. 이번 달 밖은 버린다. */
function spreadEvents(
  events: DayEvent[],
  monthStart: Date,
  monthEnd: Date,
): Map<string, CalendarEvent[]> {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    let day = event.startDate < monthStart ? monthStart : event.startDate;
    const last = event.endDate > monthEnd ? monthEnd : event.endDate;
    while (day <= last) {
      const key = formatKST(day);
      byDate.set(key, [
        ...(byDate.get(key) ?? []),
        { id: event.id, title: event.title, color: event.color },
      ]);
      day = addDays(day, 1);
    }
  }
  return byDate;
}

const RANGE_SELECT = {
  date: true,
  done: true,
  color: true,
  category: { select: { color: true } },
} as const;

const EVENT_SELECT = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  color: true,
} as const;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; view?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const date = readDate(params.date);
  const today = todayKST();
  const isToday = isSameKSTDate(date, today);
  const monthStart = readMonth(params.month, date);

  // 좁은 화면에서는 주간 줄이 기본이고, 달력은 눌렀을 때만 편다.
  // 넓은 화면에서는 이 값과 상관없이 왼쪽에 늘 달력이 있다.
  const monthOpen = params.view === "month";
  const viewQuery = monthOpen ? "&view=month" : "";
  const dayHref = (key: string) => `/?date=${key}${viewQuery}`;
  const monthHref = (month: string) =>
    `/?date=${formatKST(date)}&month=${month}${viewQuery}`;
  const toggleHref = monthOpen
    ? `/?date=${formatKST(date)}`
    : `/?date=${formatKST(date)}&view=month`;

  // 이 날짜를 여는 순간 루틴 할 일이 없으면 만든다. 미래 날짜에는 만들지 않는다.
  await ensureRoutineTodos(user, date);

  // 이번 주 일요일부터 토요일까지. 주간 줄에 쓴다.
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  const monthEnd = endOfMonthKST(monthStart);

  const [
    todos,
    categories,
    scheduled,
    weekTodos,
    monthTodos,
    dayEvents,
    monthEvents,
    upcomingEvents,
  ] = await Promise.all([
      prisma.todo.findMany({
        where: { userId: user.id, date },
        orderBy: { order: "asc" },
        include: {
          category: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.category.findMany({
        where: { userId: user.id, archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, name: true, color: true, isPublic: true },
      }),
      listScheduledRoutines(user.id, date),
      prisma.todo.findMany({
        where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } },
        orderBy: { order: "asc" },
        select: RANGE_SELECT,
      }),
      prisma.todo.findMany({
        where: {
          userId: user.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { order: "asc" },
        select: RANGE_SELECT,
      }),
      // 고른 날에 걸쳐 있는 일정
      prisma.event.findMany({
        where: { userId: user.id, startDate: { lte: date }, endDate: { gte: date } },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: EVENT_SELECT,
      }),
      // 이번 달에 조금이라도 걸쳐 있는 일정
      prisma.event.findMany({
        where: {
          userId: user.id,
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: EVENT_SELECT,
      }),
      // 아직 오지 않은 일정. 그 날짜를 열어보지 않아도 시험이 며칠 남았는지 보인다.
      prisma.event.findMany({
        where: { userId: user.id, startDate: { gt: date } },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: EVENT_SELECT,
        take: 3,
      }),
    ]);

  const weekSummaries = summarizeByDate(weekTodos);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const summary = weekSummaries.get(formatKST(day));
    return {
      date: day,
      total: summary?.total ?? 0,
      done: summary?.doneColors.length ?? 0,
      doneColors: summary?.doneColors ?? [],
    };
  });

  const doneCount = todos.filter((todo) => todo.done).length;

  // 투두메이트처럼 카테고리마다 칩과 +를 두고, 할 일이 없는 카테고리도 보여준다.
  const todoGroups = groupByCategory(todos, categories, { includeEmpty: true });

  return (
    // 넓은 화면에서는 왼쪽에 프로필과 달력, 오른쪽에 고른 날의 목록을 둔다.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <Link href="/settings/profile" className="flex items-center gap-3">
          <Avatar src={user.profileImage} size={48} />
          <span className="min-w-0">
            <span className="block truncate font-bold">{user.nickname}</span>
            <span className="block truncate text-sm text-muted">
              {user.bio || "한 줄 소개를 적어보세요"}
            </span>
          </span>
        </Link>

        <div className={monthOpen ? "" : "hidden lg:block"}>
          <MonthCalendar
            monthStart={monthStart}
            selected={date}
            today={today}
            summaries={summarizeByDate(monthTodos)}
            eventsByDate={spreadEvents(monthEvents, monthStart, monthEnd)}
            dayHref={dayHref}
            monthHref={monthHref}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <Link
            href={`/?date=${formatKST(addDays(date, -1))}${viewQuery}`}
            aria-label="이전 날"
            className="flex size-9 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-hover"
          >
            ‹
          </Link>

          <div className="text-center">
            <p className="text-xs text-muted">
              {isToday ? "오늘" : formatKST(date)}
            </p>
            <h1 className="text-lg font-bold">{formatHeading(date)}</h1>
          </div>

          <Link
            href={`/?date=${formatKST(addDays(date, 1))}${viewQuery}`}
            aria-label="다음 날"
            className="flex size-9 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-hover"
          >
            ›
          </Link>
        </header>

        {!monthOpen && (
          <div className="lg:hidden">
            <WeekStrip days={weekDays} selected={date} today={today} />
          </div>
        )}

        {/* 카테고리와 루틴은 할 일을 적다가 바로 손보는 것이라 설정이 아니라 여기 둔다. */}
        <nav aria-label="할 일 관리" className="flex flex-wrap items-center gap-2">
          <Link
            href="/categories"
            className="flex h-8 items-center rounded-full bg-surface px-3.5 text-sm text-muted hover:text-foreground"
          >
            카테고리
          </Link>
          <Link
            href="/routines"
            className="flex h-8 items-center rounded-full bg-surface px-3.5 text-sm text-muted hover:text-foreground"
          >
            루틴
          </Link>
          <Link
            href="/stats"
            className="flex h-8 items-center rounded-full bg-surface px-3.5 text-sm text-muted hover:text-foreground"
          >
            기록
          </Link>
          {!isToday && (
            <Link
              href={monthOpen ? "/?view=month" : "/"}
              className="flex h-8 items-center rounded-full px-3 text-sm text-brand hover:bg-surface-hover"
            >
              오늘로 돌아가기
            </Link>
          )}
          <Link
            href={toggleHref}
            aria-label={monthOpen ? "달력 접기" : "달력 펼치기"}
            className={`ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-sm lg:hidden ${
              monthOpen ? "bg-brand-subtle text-brand" : "bg-surface text-muted"
            }`}
          >
            <CalendarIcon active={monthOpen} />
            달력
          </Link>
        </nav>

        <EventSection
          events={dayEvents}
          upcoming={upcomingEvents}
          date={formatKST(date)}
          today={formatKST(today)}
        />

        {todos.length > 0 && doneCount === todos.length && (
          // 다 끝낸 날은 알아봐 준다. 마지막 하나를 체크할 동기가 된다.
          <div className="flex items-center gap-3 rounded-2xl bg-brand-subtle px-4 py-3">
            <Dori mood="party" size={56} />
            <div>
              <p className="font-semibold text-brand">할 일을 다 끝냈어요</p>
              <p className="text-xs text-muted">도리가 대신 박수 쳐줄게요</p>
            </div>
          </div>
        )}

        {categories.length === 0 && (
          // 카테고리 칩이 곧 할 일을 적는 자리다. 하나도 없으면 적을 곳이 없어진다.
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-5">
            <p className="text-sm font-medium">카테고리를 먼저 만들어주세요</p>
            <p className="text-sm text-muted">
              할 일은 카테고리 안에 적어요. 하나만 만들어도 바로 쓸 수 있어요.
            </p>
            <Link
              href="/categories"
              className="mt-1 flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
            >
              카테고리 만들기
            </Link>
          </div>
        )}

        <TodoProgress key={formatKST(date)} total={todos.length} done={doneCount}>
          {todoGroups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1">
              <CategoryAdder
                categoryId={group.categoryId}
                name={group.name}
                color={group.color}
                isPublic={group.isPublic}
                archived={group.archived}
                date={formatKST(date)}
                count={
                  group.items.length > 0
                    ? `${group.items.filter((todo) => todo.done).length}/${group.items.length}`
                    : null
                }
              />

              {group.items.length > 0 && (
                <SortableTodoList
                  date={formatKST(date)}
                  items={group.items.map((todo) => ({
                    id: todo.id,
                    label: todo.content,
                    node: <TodoRow todo={todo} />,
                  }))}
                />
              )}
            </section>
          ))}
        </TodoProgress>

        {categories.length > 0 && todos.length === 0 && scheduled.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <Dori mood="calm" size={80} />
            <p className="text-sm text-muted">아직 할 일이 없어요</p>
            <p className="text-xs text-muted">
              카테고리 이름을 눌러 적어보세요.{" "}
              <Link href="/routines" className="text-brand">
                반복되는 일이라면 루틴으로 →
              </Link>
            </p>
          </div>
        )}

        {scheduled.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-muted">예정된 루틴</p>
            <ul className="flex flex-col gap-1">
              {scheduled.map((routine) => (
                <ScheduledRoutineRow
                  key={routine.id}
                  routine={routine}
                  categories={categories}
                  date={formatKST(date)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
