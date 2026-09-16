import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addDays,
  formatKST,
  isSameKSTDate,
  parseKSTDate,
  todayKST,
  weekdayKST,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { FeedItem } from "@/components/feed-item";
import { WeekStrip } from "@/components/week-strip";

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

function formatHeading(date: Date): string {
  const [, month, day] = formatKST(date).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(date)]}요일`;
}

export default async function FriendDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const { date: dateParam } = await searchParams;

  const friend = await prisma.user.findFirst({
    where: {
      id,
      nickname: { not: null },
      // 팔로우한 사람만 볼 수 있다. 피드와 같은 규칙이다.
      followers: { some: { followerId: viewer.id } },
    },
    select: { id: true, nickname: true, profileEmoji: true, bio: true },
  });
  if (!friend) notFound();

  const date = readDate(dateParam);
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  // 피드와 같은 조건: 완료했고, 공개 카테고리에 든 할 일만 보인다.
  const visible = { done: true, category: { isPublic: true }, userId: friend.id };

  const [todos, weekCounts] = await Promise.all([
    prisma.todo.findMany({
      where: { ...visible, date },
      orderBy: { order: "asc" },
      include: {
        user: { select: { id: true, nickname: true, profileEmoji: true } },
        category: { select: { name: true, color: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    }),
    prisma.todo.groupBy({
      by: ["date"],
      where: { ...visible, date: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    }),
  ]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = formatKST(day);
    const count =
      weekCounts.find((row) => formatKST(row.date) === key)?._count._all ?? 0;
    // 친구 화면에는 완료한 것만 보이므로 남은 개수라는 개념이 없다. 전부 채운다.
    return { date: day, done: count, total: count };
  });

  const isToday = isSameKSTDate(date, todayKST());
  const basePath = `/feed/u/${friend.id}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/feed" aria-label="피드로" className="text-muted">
          ←
        </Link>
        <span className="text-2xl">{friend.profileEmoji}</span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{friend.nickname}</h1>
          {friend.bio && (
            <p className="truncate text-sm text-muted">{friend.bio}</p>
          )}
        </div>
      </header>

      <WeekStrip
        days={weekDays}
        selected={date}
        today={todayKST()}
        basePath={basePath}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">
          {isToday ? "오늘" : formatHeading(date)}
        </h2>
        {!isToday && (
          <Link href={basePath} className="text-sm text-brand">
            오늘로
          </Link>
        )}
      </div>

      {todos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
          이 날 완료한 할 일이 없다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {todos.map((todo) => (
            <FeedItem
              key={todo.id}
              todo={{
                id: todo.id,
                content: todo.content,
                date: formatKST(todo.date),
                user: todo.user,
                category: todo.category,
                reactions: todo.reactions,
              }}
              viewerId={viewer.id}
              showAuthor={false}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
