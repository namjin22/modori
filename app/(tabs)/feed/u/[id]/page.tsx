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
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { CategoryChip } from "@/components/category-chip";
import { Dori } from "@/components/dori";
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

/**
 * 친구 한 명의 하루. 내 오늘 화면과 같은 구성으로 본다.
 * 프로필, 주간 줄, 카테고리별로 묶인 할 일.
 *
 * 보이는 범위는 피드와 같다. 팔로우한 사람의, 완료한, 공개 카테고리 할 일만이다.
 * 그래서 남은 개수라는 개념이 없고 일정도 보여주지 않는다.
 */
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
    select: { id: true, nickname: true, profileImage: true, bio: true },
  });
  if (!friend) notFound();

  const date = readDate(dateParam);
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  const visible = { done: true, category: { isPublic: true }, userId: friend.id };

  const [todos, weekTodos] = await Promise.all([
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
  ]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = formatKST(day);
    const dayTodos = weekTodos.filter((todo) => formatKST(todo.date) === key);
    // 친구 화면에는 완료한 것만 보이므로 남은 개수라는 개념이 없다. 전부 채운다.
    return {
      date: day,
      done: dayTodos.length,
      total: dayTodos.length,
      doneColors: dayTodos.flatMap((todo) => {
        const color = todo.color ?? todo.category?.color;
        return color ? [color] : [];
      }),
    };
  });

  const groups = groupByCategory(todos, []);
  const isToday = isSameKSTDate(date, todayKST());
  const basePath = `/feed/u/${friend.id}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/feed" aria-label="소셜로" className="shrink-0 text-muted">
          ←
        </Link>
        <Avatar src={friend.profileImage} size={48} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{friend.nickname}</h1>
          <p className="truncate text-sm text-muted">
            {friend.bio || `${WEEKDAY_NAMES[weekdayKST(date)]}요일의 기록`}
          </p>
        </div>
      </header>

      <WeekStrip
        days={weekDays}
        selected={date}
        today={todayKST()}
        basePath={basePath}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {isToday ? "오늘" : formatHeading(date)}
        </h2>
        {isToday ? (
          <span className="text-sm text-muted">{todos.length}개 끝냈어요</span>
        ) : (
          <Link href={basePath} className="text-sm text-brand">
            오늘로
          </Link>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Dori mood="calm" size={80} />
          <p className="text-sm text-muted">이 날 끝낸 할 일이 없어요</p>
        </div>
      ) : (
        // 내 화면과 같이 카테고리로 묶는다. 쭉 나열하면 무엇을 하는 사람인지 안 보인다.
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CategoryChip name={group.name} color={group.color} />
              <span className="text-xs text-muted">{group.items.length}개</span>
            </div>

            <ul className="flex flex-col gap-3">
              {group.items.map((todo) => (
                <FeedItem
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
  );
}
