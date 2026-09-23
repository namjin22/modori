import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addDays,
  endOfMonthKST,
  formatKST,
  formatMonthKST,
  isSameKSTDate,
  parseKSTDate,
  parseKSTMonth,
  startOfMonthKST,
  todayKST,
  weekdayKST,
} from "@/lib/date";
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { CalendarIcon } from "@/components/tab-icons";
import { CategoryChip } from "@/components/category-chip";
import { Dori } from "@/components/dori";
import { FeedItem } from "@/components/feed-item";
import { MonthCalendar, type DaySummary } from "@/components/month-calendar";
import { WeekStrip } from "@/components/week-strip";
import { BackLink } from "@/components/back-link";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function readDate(raw: string | undefined): Date {
  if (!raw) return todayKST();

  try {
    return parseKSTDate(raw);
  } catch (error) {
    console.error("[친구] 날짜 형식이 잘못됐다.", error);
    return todayKST();
  }
}

function readMonth(raw: string | undefined, fallback: Date): Date {
  if (!raw) return startOfMonthKST(fallback);

  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[친구] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(fallback);
  }
}

function formatHeading(date: Date): string {
  const [, month, day] = formatKST(date).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(date)]}요일`;
}

/**
 * 친구 한 명의 하루. 내 오늘 화면과 같은 구성으로 본다.
 * 프로필, 주간 줄과 달력, 카테고리별로 묶인 할 일.
 *
 * 보이는 범위는 피드와 같다. 팔로우한 사람의, 완료한, 공개 카테고리 할 일만이다.
 * 그래서 남은 개수라는 개념이 없고 일정도 보여주지 않는다.
 */
export default async function FriendDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; month?: string; view?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const params_ = await searchParams;

  const friend = await prisma.user.findFirst({
    where: {
      id,
      nickname: { not: null },
      // 팔로우한 사람만 볼 수 있다. 피드와 같은 규칙이다.
      followers: { some: { followerId: viewer.id } },
    },
    select: { id: true, nickname: true, profileImage: true, bio: true },
  });
  if (!friend) notFound();

  const today = todayKST();
  const date = readDate(params_.date);
  const monthStart = readMonth(params_.month, date);
  const monthEnd = endOfMonthKST(monthStart);
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  const monthOpen = params_.view === "month";
  const basePath = `/feed/u/${friend.id}`;
  const viewQuery = monthOpen ? "&view=month" : "";

  const visible = { done: true, category: { isPublic: true }, userId: friend.id };

  const [todos, weekTodos, monthTodos] = await Promise.all([
    prisma.todo.findMany({
      where: { ...visible, date },
      orderBy: { order: "asc" },
      include: {
        user: { select: { id: true, nickname: true, profileImage: true } },
        category: { select: { id: true, name: true, color: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    }),
    prisma.todo.findMany({
      where: { ...visible, date: { gte: weekStart, lte: weekEnd } },
      orderBy: { order: "asc" },
      select: { date: true, color: true, category: { select: { color: true } } },
    }),
    prisma.todo.findMany({
      where: { ...visible, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { order: "asc" },
      select: { date: true, color: true, category: { select: { color: true } } },
    }),
  ]);

  function summarize(rows: typeof weekTodos, day: Date) {
    const key = formatKST(day);
    const rowsOfDay = rows.filter((todo) => formatKST(todo.date) === key);
    // 친구 화면에는 완료한 것만 보이므로 남은 개수라는 개념이 없다. 전부 채운다.
    return {
      total: rowsOfDay.length,
      doneColors: rowsOfDay.flatMap((todo) => {
        const color = todo.color ?? todo.category?.color;
        return color ? [color] : [];
      }),
    };
  }

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const summary = summarize(weekTodos, day);
    return { date: day, done: summary.total, ...summary };
  });

  const summaries = new Map<string, DaySummary>();
  for (const todo of monthTodos) {
    const key = formatKST(todo.date);
    const summary = summaries.get(key) ?? { total: 0, doneColors: [] };
    summary.total += 1;
    const color = todo.color ?? todo.category?.color;
    if (color) summary.doneColors.push(color);
    summaries.set(key, summary);
  }

  const groups = groupByCategory(todos, []);
  const isToday = isSameKSTDate(date, today);
  const dayHref = (key: string) =>
    `${basePath}?date=${key}&month=${formatMonthKST(monthStart)}${viewQuery}`;
  const monthHref = (month: string) =>
    `${basePath}?date=${formatKST(date)}&month=${month}${monthOpen ? "&view=month" : ""}`;

  return (
    // 내 오늘 화면과 같이, 넓은 화면에서는 왼쪽에 프로필과 달력을 둔다.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-3">
          <BackLink href="/feed" label="소셜로" />
          <Avatar src={friend.profileImage} size={48} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{friend.nickname}</h1>
            {friend.bio && (
              <p className="truncate text-sm text-muted">{friend.bio}</p>
            )}
          </div>
        </div>

        <div className={monthOpen ? "" : "hidden lg:block"}>
          <MonthCalendar
            compact
            monthStart={monthStart}
            selected={date}
            today={today}
            summaries={summaries}
            eventsByDate={new Map()}
            dayHref={dayHref}
            monthHref={monthHref}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <Link
            href={`${basePath}?date=${formatKST(addDays(date, -1))}${viewQuery}`}
            aria-label="이전 날"
            className="flex size-9 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-hover"
          >
            ‹
          </Link>
          <div className="text-center">
            <p className="text-xs text-muted">
              {isToday ? "오늘" : formatKST(date)}
            </p>
            <h2 className="text-lg font-bold">{formatHeading(date)}</h2>
          </div>
          <Link
            href={`${basePath}?date=${formatKST(addDays(date, 1))}${viewQuery}`}
            aria-label="다음 날"
            className="flex size-9 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-hover"
          >
            ›
          </Link>
        </header>

        {!monthOpen && (
          <div className="lg:hidden">
            <WeekStrip
              days={weekDays}
              selected={date}
              today={today}
              basePath={basePath}
            />
          </div>
        )}

        <nav aria-label="보기" className="flex items-center gap-2">
          {!isToday && (
            <Link
              href={basePath}
              className="flex h-8 items-center rounded-full px-3 text-sm text-brand hover:bg-surface-hover"
            >
              오늘로 돌아가기
            </Link>
          )}
          <Link
            href={
              monthOpen
                ? `${basePath}?date=${formatKST(date)}`
                : `${basePath}?date=${formatKST(date)}&view=month`
            }
            aria-label={monthOpen ? "달력 접기" : "달력 펼치기"}
            className={`ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-sm lg:hidden ${
              monthOpen ? "bg-brand-subtle text-brand" : "bg-surface text-muted"
            }`}
          >
            <CalendarIcon active={monthOpen} />
            달력
          </Link>
        </nav>

        {todos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Dori mood="calm" size={80} />
            <p className="text-sm text-muted">끝낸 할 일이 없어요</p>
          </div>
        ) : (
          // 내 화면과 같이 카테고리로 묶는다. 쭉 나열하면 무엇을 하는 사람인지 안 보인다.
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CategoryChip name={group.name} color={group.color} />
                <span className="text-xs text-muted">{group.items.length}개</span>
              </div>

              <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-4">
                {group.items.map((todo) => (
                  <FeedItem
                    compact
                    key={todo.id}
                    todo={{
                      id: todo.id,
                      content: todo.content,
                      date: formatKST(todo.date),
                      user: todo.user,
                      color: todo.color,
                      category: todo.category,
                      reactions: todo.reactions,
                    }}
                    viewerId={viewer.id}
                    showAuthor={false}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
