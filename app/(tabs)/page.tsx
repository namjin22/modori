import Link from "next/link";

import {
  addDays,
  formatKST,
  isSameKSTDate,
  parseKSTDate,
  todayKST,
  weekdayKST,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  ensureRoutineTodos,
  listScheduledRoutines,
} from "@/lib/routine-todos";
import { requireUser } from "@/lib/session";

import { ScheduledRoutineRow } from "@/components/scheduled-routine-row";
import { SubmitButton } from "@/components/submit-button";
import { TodoRow } from "@/components/todo-row";

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

  const [todos, categories, scheduled] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, date },
      orderBy: { order: "asc" },
      include: { category: { select: { name: true, color: true } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    listScheduledRoutines(user.id, date),
  ]);

  const doneCount = todos.filter((todo) => todo.done).length;

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
              <p className="text-sm text-muted">
                {todos.length}개 중 {doneCount}개 완료
              </p>
              <ul className="flex flex-col gap-2">
                {todos.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} categories={categories} />
                ))}
              </ul>
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
        className="h-11 rounded-xl bg-surface-hover px-3 outline-none"
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
