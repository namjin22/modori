import Link from "next/link";

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
import {
  ensureRoutineTodos,
  listScheduledRoutines,
} from "@/lib/routine-todos";
import { requireUser } from "@/lib/session";

import { CategoryChip } from "@/components/category-chip";
import { ScheduledRoutineRow } from "@/components/scheduled-routine-row";
import { SortableTodoList } from "@/components/sortable-todo-list";
import { SubmitButton } from "@/components/submit-button";
import { TodoRow } from "@/components/todo-row";
import { WeekStrip } from "@/components/week-strip";

import { addTodo } from "./actions";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function readDate(raw: string | undefined): Date {
  if (!raw) return todayKST();

  try {
    return parseKSTDate(raw);
  } catch (error) {
    // 주소창을 손으로 고친 경우. 오늘로 돌린다.
    console.error("[today] 날짜 형식이 잘못됐다.", error);
    return todayKST();
  }
}

function formatHeading(date: Date): string {
  const [, month, day] = formatKST(date).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(date)]}요일`;
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam } = await searchParams;
  const date = readDate(dateParam);
  const isToday = isSameKSTDate(date, todayKST());

  // 이 날짜를 여는 순간 루틴 할 일이 없으면 만든다. 미래 날짜에는 만들지 않는다.
  await ensureRoutineTodos(user, date);

  // 이번 주 일요일부터 토요일까지. 주간 스트립에 쓴다.
  const weekStart = addDays(date, -weekdayKST(date));
  const weekEnd = addDays(weekStart, 6);

  const [todos, categories, scheduled, weekCounts] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, date },
      orderBy: { order: "asc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    listScheduledRoutines(user.id, date),
    // 날짜별 완료 수를 한 번에 가져온다. 7일을 따로 세면 질의가 일곱 번이다.
    prisma.todo.groupBy({
      by: ["date", "done"],
      where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    }),
  ]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = formatKST(day);
    const rows = weekCounts.filter((row) => formatKST(row.date) === key);
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const done = rows
      .filter((row) => row.done)
      .reduce((sum, row) => sum + row._count._all, 0);
    return { date: day, done, total };
  });

  const doneCount = todos.filter((todo) => todo.done).length;

  // 카테고리별로 묶어서 보여준다. 색 점 하나보다 이쪽이 훨씬 잘 읽힌다.
  const todoGroups = groupByCategory(todos, categories);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link
          href={`/?date=${formatKST(addDays(date, -1))}`}
          aria-label="이전 날"
          className="rounded-lg px-2 py-1 text-muted hover:bg-surface-hover"
        >
          ←
        </Link>

        <div className="text-center">
          <p className="text-sm text-muted">{isToday ? "오늘" : formatKST(date)}</p>
          <h1 className="text-xl font-bold">{formatHeading(date)}</h1>
        </div>

        <Link
          href={`/?date=${formatKST(addDays(date, 1))}`}
          aria-label="다음 날"
          className="rounded-lg px-2 py-1 text-muted hover:bg-surface-hover"
        >
          →
        </Link>
      </header>

      <WeekStrip days={weekDays} selected={date} today={todayKST()} />

      {!isToday && (
        <Link href="/" className="text-center text-sm text-brand">
          오늘로 돌아가기
        </Link>
      )}

      <AddTodoForm categories={categories} date={formatKST(date)} />

      {todos.length === 0 && scheduled.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-2xl">🌱</p>
          <p className="mt-2 text-sm text-muted">아직 할 일이 없다</p>
          <Link
            href="/settings/routines"
            className="mt-3 inline-block text-sm text-brand"
          >
            반복되는 일이라면 루틴으로 →
          </Link>
        </div>
      ) : (
        <>
          {todos.length > 0 && (
            <>
              {/* 숫자만으로는 얼마나 남았는지 한눈에 안 들어온다. */}
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted">
                  {todos.length}개 중 {doneCount}개 완료
                </p>
                <div
                  role="progressbar"
                  aria-label="오늘 완료율"
                  aria-valuemin={0}
                  aria-valuemax={todos.length}
                  aria-valuenow={doneCount}
                  className="h-1.5 overflow-hidden rounded-full bg-surface"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-300"
                    style={{
                      width: `${Math.round((doneCount / todos.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              {todoGroups.map((group) => (
                <section key={group.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <CategoryChip name={group.name} color={group.color} />
                    <span className="text-xs text-muted">
                      {group.items.filter((todo) => todo.done).length}/
                      {group.items.length}
                    </span>
                  </div>

                  <SortableTodoList
                    date={formatKST(date)}
                    items={group.items.map((todo) => ({
                      id: todo.id,
                      node: <TodoRow todo={todo} categories={categories} />,
                    }))}
                  />
                </section>
              ))}
            </>
          )}

          {scheduled.length > 0 && (
            <>
              <p className="text-sm text-muted">예정된 루틴</p>
              <ul className="flex flex-col gap-2">
                {scheduled.map((routine) => (
                  <ScheduledRoutineRow
                    key={routine.id}
                    routine={routine}
                    categories={categories}
                    date={formatKST(date)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AddTodoForm({
  categories,
  date,
}: {
  categories: { id: string; name: string; color: string }[];
  date: string;
}) {
  return (
    <form
      action={addTodo}
      className="flex flex-col gap-2 rounded-2xl bg-surface p-3"
    >
      <input type="hidden" name="date" value={date} />
      <input
        name="content"
        required
        maxLength={200}
        placeholder="할 일 추가"
        aria-label="할 일 내용"
        className="h-11 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="flex gap-2">
        <select
          name="categoryId"
          aria-label="카테고리"
          className="h-11 flex-1 rounded-xl bg-surface-hover px-3 text-sm"
        >
          <option value="">카테고리 없음</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <SubmitButton
          pendingLabel="추가 중"
          className="h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast"
        >
          추가
        </SubmitButton>
      </div>
    </form>
  );
}
