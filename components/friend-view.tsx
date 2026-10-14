"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { CategoryChip } from "@/components/category-chip";
import { Dori } from "@/components/dori";
import { FeedItem } from "@/components/feed-item";
import { MonthCalendar } from "@/components/month-calendar";
import { DayNavLink, isModifiedClick, useMonthDay } from "@/components/month-day";
import { SwapIn } from "@/components/swap-in";
import { addDays, formatKST, parseKSTDate, parseKSTMonth, weekdayKST } from "@/lib/date";
import { summarizeByDate } from "@/lib/day-summary";
import { groupByCategory } from "@/lib/group-by-category";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type FriendTodo = {
  id: string;
  date: string;
  content: string;
  done: boolean;
  color: string | null;
  doneAt: number | null;
  user: { id: string; nickname: string | null };
  category: { id: string; name: string; color: string } | null;
  reactions: { emoji: string; userId: string; user: { nickname: string | null } | null }[];
};

export type FriendData = {
  friendId: string;
  viewerId: string;
  today: string;
  initialDate: string;
  month: string;
  from: string;
  to: string;
  todos: FriendTodo[];
};

function formatHeading(key: string): string {
  const [, month, day] = key.split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(parseKSTDate(key))]}요일`;
}

/**
 * 친구 한 명의 하루. 홈처럼 보이는 달 한 달치(공개 카테고리의 할 일·반응)를 서버가 한 번에 넘기고,
 * 달 안에서 날짜를 바꾸는 것은 여기서 바로 그린다(docs/decisions.md "친구 화면도 한 달치를"). 프로필 줄은 서버가 그려 넘긴다.
 */
export function FriendView({ profile, data }: { profile: ReactNode; data: FriendData }) {
  const basePath = `/feed/u/${data.friendId}`;
  const { selected, inWindow, hrefFor, select } = useMonthDay({ basePath, ...data });
  const date = parseKSTDate(selected);
  const isToday = selected === data.today;
  const monthStart = parseKSTMonth(data.month);

  // 내 화면과 같이 끝낸 일은 묶음 아래로 내린다. sort는 안정 정렬이라 같은 쪽 안의 순서는 그대로다.
  const todos = data.todos.filter((todo) => todo.date === selected);
  const groups = groupByCategory(todos, []).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => Number(a.done) - Number(b.done)),
  }));

  const dayNav = (target: string, label: string, glyph: string) => (
    <DayNavLink href={hrefFor(target)} onSelect={inWindow(target) ? () => select(target) : undefined} label={label}>
      {glyph}
    </DayNavLink>
  );

  return (
    // 내 오늘 화면과 같이, 넓은 화면에서는 왼쪽에 프로필과 달력을 둔다.
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      {/* 넓은 화면에서 달력 칸은 제자리에 둔다. 시작 위치(pt-8)와 같은 top-8이라 스크롤을 시작해도 움직이지 않고,
          창이 달력보다 낮으면(노트북) 칸 안에서만 스크롤해 페이지 끝에서 밀려 올라가지 않는다. */}
      <div className="flex flex-col gap-4 lg:gap-6 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        {profile}

        {/* 홈과 같이 한 달 달력을 모든 화면 폭에서 늘 보인다(주간 줄은 없앴다). */}
        <div>
          <MonthCalendar
            compact
            monthStart={monthStart}
            selected={date}
            today={parseKSTDate(data.today)}
            summaries={summarizeByDate(data.todos)}
            eventsByDate={new Map()}
            dayHref={hrefFor}
            monthHref={(month) => `${basePath}?date=${selected}&month=${month}`}
            onSelectDay={select}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:pb-12">
        <header className="flex items-center justify-between">
          {dayNav(formatKST(addDays(date, -1)), "이전 날", "‹")}
          {/* 날짜를 넘기면 넘긴 쪽에서 미끄러져 들어온다(홈과 같다, components/home-view.tsx). */}
          <SwapIn swapKey={selected} className="text-center">
            <p className="text-xs text-muted">{isToday ? "오늘" : selected}</p>
            <h2 className="text-lg font-bold">{formatHeading(selected)}</h2>
          </SwapIn>
          {dayNav(formatKST(addDays(date, 1)), "다음 날", "›")}
        </header>

        {!isToday && (
          <Link
            prefetch={false}
            href={basePath}
            onClick={(event) => {
              if (!inWindow(data.today) || isModifiedClick(event)) return;
              event.preventDefault();
              select(data.today, basePath);
            }}
            className="-mt-3 flex h-8 w-fit items-center rounded-full px-3 text-sm text-brand hover:bg-surface-hover"
          >
            오늘로 돌아가기
          </Link>
        )}

        <SwapIn swapKey={selected} className="flex flex-col gap-6">
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
                    <FeedItem compact key={todo.id} todo={todo} viewerId={data.viewerId} showAuthor={false} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </SwapIn>
      </div>
    </div>
  );
}
