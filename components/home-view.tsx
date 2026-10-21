"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef } from "react";

import { Avatar } from "@/components/avatar";
import { CategoryAdder } from "@/components/category-adder";
import { DayRollover } from "@/components/day-rollover";
import { ManageMenu } from "@/components/manage-menu";
import { Dori } from "@/components/dori";
import { type DayEvent, EventSection } from "@/components/event-section";
import { FirstTodoButton } from "@/components/first-todo-button";
import { MonthCalendar } from "@/components/month-calendar";
import { DayNavLink, isModifiedClick, useMonthDay } from "@/components/month-day";
import { BulkMove } from "@/components/move-undone-button";
import { ScheduledRoutineRow } from "@/components/scheduled-routine-row";
import { SwapIn } from "@/components/swap-in";
import { TodoBoard } from "@/components/todo-board";
import { TodoProgress } from "@/components/todo-progress";
import { TodoRow } from "@/components/todo-row";
import { applyTodoChange, type HomeTodo, PENDING_PREFIX, TodoStoreProvider } from "@/components/todo-store";
import { spreadEvents } from "@/lib/calendar-events";
import { summarizeByDate } from "@/lib/day-summary";
import { addDays, daysBetween, endOfMonthKST, formatKST, parseKSTDate, parseKSTMonth, weekdayKST } from "@/lib/date";
import { groupByCategory } from "@/lib/group-by-category";
import type { ScheduledRoutine } from "@/lib/routine-todos";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type { HomeTodo };

export type HomeData = {
  profile: { nickname: string | null; bio: string | null; avatar: string | null };
  today: string;
  // 서버가 그린 날. 주소의 날짜가 받아 둔 기간 밖일 때(잠깐) 대신 보인다.
  initialDate: string;
  month: string;
  from: string;
  to: string;
  todos: HomeTodo[];
  categories: { id: string; name: string; color: string; isPublic: boolean }[];
  scheduled: Record<string, ScheduledRoutine[]>;
  pending: string[];
  events: DayEvent[];
  upcoming: DayEvent[];
};

function formatHeading(key: string): string {
  const [, month, day] = key.split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(parseKSTDate(key))]}요일`;
}

const overlaps = (event: DayEvent, day: Date) => event.startDate <= day && event.endDate >= day;

/**
 * 홈 화면. 서버가 보이는 달 한 달치(할 일·일정·루틴)를 한 번에 넘겨 주고, 달 안에서 날짜를 바꾸는 것은
 * 서버에 가지 않고 여기서 바로 그린다. 주소는 history.pushState로만 바꾼다(Next가 useSearchParams와 맞춰 준다).
 * 날짜를 누를 때마다 서버를 다녀오느라 0.5~1초씩 멈추던 것을 없앴다(docs/decisions.md "한 달치를 한 번에").
 * 고치는 일(적기·체크·옮기기)은 그대로 서버 액션이 하고, 끝나면 서버가 같은 주소로 한 달치를 다시 보낸다.
 */
export function HomeView({ data }: { data: HomeData }) {
  const router = useRouter();
  // date가 없는 "/"만 자정이 지나면 새 오늘로 넘어간다(DayRollover). 날짜를 고르면 늘 date를 붙인다.
  const { selected, hasDateParam, inWindow, hrefFor, select } = useMonthDay({ basePath: "/", ...data });
  // 적기·체크·고치기·옮기기·지우기는 서버 응답 전에 여기부터 바뀐다(components/todo-store.tsx).
  const [allTodos, applyChange] = useOptimistic(data.todos, applyTodoChange);

  // 지난 날 루틴은 그 날을 열 때 만든다(lib/routine-todos.ts). 아직 안 만든 날을 고르면 서버에 한 번 다녀와 만든다.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!data.pending.includes(selected) || asked.current.has(selected)) return;
    asked.current.add(selected);
    router.refresh();
  }, [selected, data.pending, router]);

  const date = parseKSTDate(selected);
  const today = parseKSTDate(data.today);
  const isToday = selected === data.today;
  const isPast = daysBetween(today, date) < 0;
  // 할 일 창의 한 번에 옮기기: 오늘의 일은 내일로, 오늘이 아닌 날(지난 날·앞날)의 일은 오늘로.
  const quickMove = isPast
    ? { label: "오늘 하기", target: data.today }
    : isToday
      ? { label: "내일 하기", target: formatKST(addDays(date, 1)) }
      : // 앞날의 안 끝낸 일은 "오늘 하기"로 당겨 오는 쪽이 자연스럽다(2026-10-14 요청). 다른 날은 "다른 날에 하기"로 고른다.
        { label: "오늘 하기", target: data.today };

  const monthStart = parseKSTMonth(data.month);
  const todos = allTodos.filter((todo) => todo.date === selected);
  const scheduled = data.scheduled[selected] ?? [];
  const dayEvents = data.events.filter((event) => overlaps(event, date));
  // 고른 날과 겹치는 일정은 빼고 셋. 서버는 넉넉히 보내고 여기서 자른다.
  const upcoming = data.upcoming.filter((event) => !overlaps(event, date)).slice(0, 3);

  // 투두메이트처럼 카테고리마다 칩과 +를 두고, 할 일이 없는 카테고리도 보여준다.
  // 끝낸 일은 묶음 아래로 내린다(남은 일이 위에 모인다). 같은 쪽 안에서는 원래 순서를 지킨다(sort는 안정 정렬).
  const undoneCount = todos.filter((todo) => !todo.done).length;
  const todoGroups = groupByCategory(todos, data.categories, { includeEmpty: true }).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => Number(a.done) - Number(b.done)),
  }));

  const dayNav = (target: string, label: string, glyph: string) => (
    <DayNavLink href={hrefFor(target)} onSelect={inWindow(target) ? () => select(target) : undefined} label={label}>
      {glyph}
    </DayNavLink>
  );

  return (
    // 넓은 화면에서는 왼쪽에 프로필과 달력, 오른쪽에 고른 날의 목록을 둔다.
    <TodoStoreProvider value={applyChange}>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        {!hasDateParam && <DayRollover day={data.today} />}
        {/* 넓은 화면에서는 달력이 먼저 와서 할 일까지 Tab을 서른 번 넘게 눌러야 한다.
            첫 Tab에 나타나는 건너뛰기 링크를 둔다. */}
        <a
          href="#day-list"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-contrast"
        >
          할 일로 건너뛰기
        </a>
        {/* 넓은 화면에서 달력 칸은 제자리에 둔다. 시작 위치(pt-8)와 같은 top-8이라 스크롤을 시작해도 움직이지 않고,
            창이 달력보다 낮으면(노트북) 칸 안에서만 스크롤해 페이지 끝에서 밀려 올라가지 않는다. */}
        <div className="flex flex-col gap-4 lg:gap-6 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          <Link prefetch={false} href="/settings/profile" className="flex items-center gap-3">
            <Avatar src={data.profile.avatar} size={48} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{data.profile.nickname}</span>
              <span className="block truncate text-sm text-muted">{data.profile.bio || "한 줄 소개를 적어보세요"}</span>
            </span>
          </Link>

          <div>
            <MonthCalendar
              monthStart={monthStart}
              selected={date}
              today={today}
              summaries={summarizeByDate(allTodos)}
              eventsByDate={spreadEvents(data.events, monthStart, endOfMonthKST(monthStart))}
              dayHref={hrefFor}
              monthHref={(month) => `/?date=${selected}&month=${month}`}
              onSelectDay={select}
              editableEvents
            />
          </div>
        </div>

        {/* 아래 여백을 이 칸에 둔다(PageFrame은 두 칸 화면에서 빼 준다). 달력 칸이 머물 수 있는 줄 높이가 페이지 끝까지 닿게. */}
        <div id="day-list" tabIndex={-1} className="flex flex-col gap-6 outline-none lg:pb-12">
          <header className="flex items-center justify-between">
            {dayNav(formatKST(addDays(date, -1)), "이전 날", "‹")}
            {/* 날짜를 넘기면 제목과 아래 목록이 넘긴 쪽에서 미끄러져 들어온다. ‹ › 버튼은 제자리에 둔다(연달아 누를 때 움직이면 빗나간다). */}
            <SwapIn swapKey={selected} className="text-center">
              <p className="text-xs text-muted">{isToday ? "오늘" : selected}</p>
              <h1 className="text-lg font-bold">{formatHeading(selected)}</h1>
            </SwapIn>
            {dayNav(formatKST(addDays(date, 1)), "다음 날", "›")}
          </header>

          <SwapIn swapKey={selected} className="flex flex-col gap-6">
            {/* 카테고리와 루틴은 할 일을 적다가 바로 손보는 것이라 설정이 아니라 여기 둔다. */}
            {/* 가장 좁은 폰(320px)에서 달력 버튼만 다음 줄로 떨어지지 않게 여백을 줄인다. */}
            {/* 관리·기록은 오른쪽에 둔다(2026-10-21 요청). 다른 날을 볼 때만 생기는 "오늘로 돌아가기"는 왼쪽 끝. */}
            <nav aria-label="할 일 관리" className="flex flex-wrap items-center justify-end gap-1.5 min-[360px]:gap-2">
              {!isToday && (
                <Link
                  prefetch={false}
                  href="/"
                  onClick={(event) => {
                    if (!inWindow(data.today) || isModifiedClick(event)) return;
                    event.preventDefault();
                    select(data.today, "/");
                  }}
                  className="mr-auto flex h-8 items-center rounded-full px-3 text-sm text-brand hover:bg-surface-hover"
                >
                  오늘로 돌아가기
                </Link>
              )}
              {/* 카테고리·일정·루틴은 메뉴 하나로 묶는다(2026-10-19 요청). 기록은 따로 둔다. */}
              <ManageMenu />
              <Link
                prefetch={false}
                href="/stats"
                className="flex h-8 items-center rounded-full bg-surface px-3 text-sm text-muted hover:text-foreground min-[360px]:px-3.5"
              >
                기록
              </Link>
            </nav>

            <EventSection events={dayEvents} upcoming={upcoming} date={selected} today={data.today} />

            {data.categories.length === 0 && (
              // 카테고리 칩이 곧 할 일을 적는 자리다. 하나도 없으면 적을 곳이 없어진다.
              <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-5">
                <p className="text-sm font-medium">카테고리를 먼저 만들어주세요</p>
                <p className="text-sm text-muted">할 일은 카테고리 안에 적어요. 하나만 만들어도 바로 쓸 수 있어요.</p>
                <Link
                  prefetch={false}
                  href="/categories"
                  className="mt-1 flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
                >
                  카테고리 만들기
                </Link>
              </div>
            )}

            {/* 앞날짜에 아직 "예정"인 루틴이 남아 있으면 다 끝낸 게 아니다. 축하 배너는 TodoProgress가 띄운다. */}
            <TodoProgress
              key={selected}
              // 막대는 끝낸 일의 색으로 찬다. 화면에 보이는 묶음 순서대로 넘겨 같은 색이 붙어 서게 한다.
              items={todoGroups.flatMap((group) =>
                group.items.map((todo) => ({ id: todo.id, done: todo.done, color: todo.color ?? todo.category?.color ?? null })),
              )}
              canCelebrate={scheduled.length === 0}
            >
              <TodoBoard
                date={selected}
                groups={todoGroups.map((group) => ({
                  key: group.key,
                  categoryId: group.categoryId,
                  label: group.name,
                  droppable: !group.archived,
                  header: (
                    <CategoryAdder
                      categoryId={group.categoryId}
                      name={group.name}
                      color={group.color}
                      isPublic={group.isPublic}
                      archived={group.archived || group.categoryId === null}
                      date={selected}
                      count={group.items.length > 0 ? `${group.items.filter((todo) => todo.done).length}/${group.items.length}` : null}
                    />
                  ),
                  items: group.items.map((todo) => ({
                    id: todo.id,
                    label: todo.content,
                    done: todo.done,
                    node: (
                      <TodoRow
                        todo={todo}
                        date={selected}
                        quickMove={quickMove}
                        received={todo.received}
                        saving={todo.id.startsWith(PENDING_PREFIX)}
                        categories={data.categories}
                      />
                    ),
                  })),
                }))}
              />
            </TodoProgress>

            {data.categories.length > 0 && todos.length === 0 && scheduled.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-2 text-center">
                {/* 지난 날은 느긋하게, 오늘과 앞날은 반갑게. */}
                <Dori mood={isPast ? "calm" : "hello"} size={80} />
                <p className="text-sm text-muted">아직 할 일이 없어요</p>
                {/* 지난 날은 쓰는 날이 아니라 오늘·앞날에만 큰 버튼을 둔다. */}
                {!isPast && <FirstTodoButton />}
                <p className="mt-3 text-xs text-muted">
                  카테고리 이름을 눌러 적어보세요.{" "}
                  <Link prefetch={false} href="/routines" className="text-brand">
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
                    <ScheduledRoutineRow key={routine.id} routine={routine} categories={data.categories} date={selected} />
                  ))}
                </ul>
              </section>
            )}

            {/* 안 끝낸 일을 한꺼번에 옮기는 곳은 가장 밑의 할 일 아래에 접어 둔다. 눌러야 옮기는 버튼이 나온다. */}
            <BulkMove date={selected} today={data.today} count={undoneCount} />
          </SwapIn>
        </div>
      </div>
    </TodoStoreProvider>
  );
}
