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
import { NO_CATEGORY_COLOR } from "@/lib/colors";
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
import { LockedProfile } from "@/components/locked-profile";
import { SubmitButton } from "@/components/submit-button";
import { followUser, unfollowUser } from "../../actions";
import { avatarUrl } from "@/lib/avatar";

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

/** 날짜별 요약(전체 수, 끝낸 일의 색). 내 피드 화면과 같은 방식이라 달력이 끝낸 만큼만 찬다. */
function summarizeByDate(
  todos: { date: Date; done: boolean; color: string | null; category: { color: string } | null }[],
): Map<string, DaySummary> {
  const summaries = new Map<string, DaySummary>();
  for (const todo of todos) {
    const key = formatKST(todo.date);
    const summary = summaries.get(key) ?? { total: 0, doneColors: [] };
    summary.total += 1;
    if (todo.done) summary.doneColors.push(todo.color ?? todo.category?.color ?? NO_CATEGORY_COLOR);
    summaries.set(key, summary);
  }
  return summaries;
}

function formatHeading(date: Date): string {
  const [, month, day] = formatKST(date).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(date)]}요일`;
}

/**
 * 친구 한 명의 하루. 내 오늘 화면과 같은 구성으로 본다.
 * 프로필, 주간 줄과 달력, 카테고리별로 묶인 할 일.
 *
 * 팔로우한 사람의 공개 카테고리 할 일은 끝냈든 아니든 다 보인다(투두메이트처럼 무엇을 하려는지까지 본다).
 * 반응은 끝낸 일에만 보낸다. 소셜 피드는 끝낸 일만 흐르고, 일정은 보여주지 않는다.
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
    select: {
      id: true,
      nickname: true,
      profileImage: true,
      bio: true,
      // 가입을 마치지 않은(닉네임 없는) 계정은 목록에도 안 나오므로 세지 않는다.
      _count: {
        select: {
          following: { where: { following: { nickname: { not: null } } } },
          followers: { where: { follower: { nickname: { not: null } } } },
        },
      },
    },
  });
  if (!friend) {
    // 팔로우하지 않은 사람이면 없는 주소가 아니라 "팔로우하면 볼 수 있어요" 안내를 보여준다. 자기 자신과 가입 전 계정은 없는 주소다.
    const stranger =
      id === viewer.id
        ? null
        : await prisma.user.findFirst({
            where: { id, nickname: { not: null } },
            select: { id: true, nickname: true, profileImage: true },
          });
    if (!stranger?.nickname) notFound();
    return (
      <LockedProfile
        nickname={stranger.nickname}
        avatar={avatarUrl(stranger)}
        follow={followUser}
        targetId={stranger.id}
      />
    );
  }

  const today = todayKST();
  const date = readDate(params_.date);
  const monthStart = readMonth(params_.month, date);
  const monthEnd = endOfMonthKST(monthStart);
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  const monthOpen = params_.view === "month";
  const basePath = `/feed/u/${friend.id}`;
  const viewQuery = monthOpen ? "&view=month" : "";

  const visible = { category: { isPublic: true }, userId: friend.id };

  const [todos, weekTodos, monthTodos] = await Promise.all([
    prisma.todo.findMany({
      where: { ...visible, date },
      orderBy: { order: "asc" },
      include: {
        user: { select: { id: true, nickname: true } },
        category: { select: { id: true, name: true, color: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    }),
    prisma.todo.findMany({
      where: { ...visible, date: { gte: weekStart, lte: weekEnd } },
      orderBy: { order: "asc" },
      select: { date: true, done: true, color: true, category: { select: { color: true } } },
    }),
    prisma.todo.findMany({
      where: { ...visible, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { order: "asc" },
      select: { date: true, done: true, color: true, category: { select: { color: true } } },
    }),
  ]);

  const summaries = summarizeByDate(monthTodos);
  const weekSummaries = summarizeByDate(weekTodos);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const summary = weekSummaries.get(formatKST(day)) ?? { total: 0, doneColors: [] };
    return { date: day, done: summary.doneColors.length, ...summary };
  });

  // 내 화면과 같이 끝낸 일은 묶음 아래로 내린다. sort는 안정 정렬이라 같은 쪽 안의 순서는 그대로다.
  const groups = groupByCategory(todos, []).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => Number(a.done) - Number(b.done)),
  }));
  const isToday = isSameKSTDate(date, today);
  const dayHref = (key: string) =>
    `${basePath}?date=${key}&month=${formatMonthKST(monthStart)}${viewQuery}`;
  const monthHref = (month: string) =>
    `${basePath}?date=${formatKST(date)}&month=${month}${monthOpen ? "&view=month" : ""}`;

  return (
    // 내 오늘 화면과 같이, 넓은 화면에서는 왼쪽에 프로필과 달력을 둔다.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      {/* 넓은 화면에서 달력 칸은 제자리에 둔다. 시작 위치(pt-8)와 같은 top-8이라 스크롤을 시작해도 움직이지 않고,
          창이 달력보다 낮으면(노트북) 칸 안에서만 스크롤해 페이지 끝에서 밀려 올라가지 않는다. */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <div className="flex items-center gap-3">
          <BackLink href="/feed" label="소셜로" />
          <Avatar src={avatarUrl(friend)} size={48} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{friend.nickname}</h1>
            {friend.bio && (
              <p className="truncate text-sm text-muted">{friend.bio}</p>
            )}
            <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
              <Link prefetch={false} href={`${basePath}/following`} className="hover:text-foreground">
                팔로우 <b className="font-semibold text-foreground">{friend._count.following}</b>
              </Link>
              <Link prefetch={false} href={`${basePath}/followers`} className="hover:text-foreground">
                팔로워 <b className="font-semibold text-foreground">{friend._count.followers}</b>
              </Link>
              {/* 이미 팔로우한 사람이라 여기서 바로 끊을 수 있다. 끊으면 이 화면이 팔로우 안내로 바뀐다. */}
              <form action={unfollowUser} className="ml-auto">
                <input type="hidden" name="targetId" value={friend.id} />
                <SubmitButton pendingLabel="처리 중" className="h-7 rounded-full bg-surface px-3 text-xs font-medium text-muted">
                  언팔로우
                </SubmitButton>
              </form>
            </p>
          </div>
          {/* 좁은 화면에서 달력 버튼 하나가 한 줄을 차지하지 않게 이름 옆에 둔다. */}
          <Link prefetch={false}
            href={
              monthOpen
                ? `${basePath}?date=${formatKST(date)}`
                : `${basePath}?date=${formatKST(date)}&view=month`
            }
            aria-label={monthOpen ? "달력 접기" : "달력 펼치기"}
            // 320px 폰에서는 글자까지 두면 이름이 몇 글자만 남는다. 좁으면 아이콘만(이름은 aria-label).
            className={`ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm min-[360px]:px-3 lg:hidden ${
              monthOpen ? "bg-brand-subtle text-brand" : "bg-surface text-muted"
            }`}
          >
            <CalendarIcon active={monthOpen} />
            <span className="hidden min-[360px]:inline">달력</span>
          </Link>
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

      <div className="flex flex-col gap-6 lg:pb-12">
        <header className="flex items-center justify-between">
          <Link prefetch={false}
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
          <Link prefetch={false}
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

        {!isToday && (
          <Link prefetch={false}
            href={basePath}
            className="-mt-3 flex h-8 w-fit items-center rounded-full px-3 text-sm text-brand hover:bg-surface-hover"
          >
            오늘로 돌아가기
          </Link>
        )}

        {todos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Dori mood="calm" size={80} />
            <p className="text-sm text-muted">할 일이 없어요</p>
          </div>
        ) : (
          // 내 화면과 같이 카테고리로 묶는다. 쭉 나열하면 무엇을 하는 사람인지 안 보인다.
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CategoryChip name={group.name} color={group.color} />
                <span className="text-xs text-muted">
                  {group.items.filter((todo) => todo.done).length}/{group.items.length}
                </span>
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
                      done: todo.done,
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
