import Link from "next/link";

import { CategoryChip } from "@/components/category-chip";
import { RoutineForm } from "@/components/routine-form";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { formatKST, todayKST } from "@/lib/date";
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import {
  deleteRoutine,
  endRoutineToday,
  restoreRoutine,
  toggleRoutinePause,
} from "./actions";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function describeRule(routine: {
  freq: string;
  byWeekday: number[];
  byMonthday: number[];
}): string {
  if (routine.freq === "DAILY") return "매일";
  if (routine.freq === "WEEKLY") {
    return `매주 ${routine.byWeekday
      .slice()
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_NAMES[day])
      .join("·")}`;
  }
  return `매월 ${routine.byMonthday
    .slice()
    .sort((a, b) => a - b)
    .join("·")}일`;
}

export default async function RoutinesPage() {
  const user = await requireUser();

  const [routines, categories] = await Promise.all([
    prisma.routine.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  // 오늘 화면과 같은 방식으로 묶는다. 루틴이 열 개를 넘으면 쭉 나열된 목록은 읽기 힘들다.
  const groups = groupByCategory(routines, categories);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="피드로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">루틴</h1>
      </header>

      <p className="text-sm text-muted">
        정해둔 날이 오면 할 일로 들어와요. 아직 안 온 날에는 예정으로만 보여요.
      </p>

      {categories.length === 0 ? (
        // 루틴은 카테고리 안에 묶인다. 카테고리가 없으면 만들어도 갈 곳이 없다.
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-5">
          <p className="text-sm font-medium">카테고리를 먼저 만들어주세요</p>
          <p className="text-sm text-muted">
            루틴은 카테고리 안에 들어가요. 하나만 만들어도 바로 쓸 수 있어요.
          </p>
          <Link
            href="/categories"
            className="mt-1 flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
          >
            카테고리 만들기
          </Link>
        </div>
      ) : (
      /* 브라우저 기본 삼각형 대신 + 표시를 쓰고, 열리면 ×로 돌린다. */
      <details className="group rounded-2xl bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-full bg-brand text-brand-contrast transition-transform group-open:rotate-45"
          >
            +
          </span>
          루틴 만들기
        </summary>
        <div className="px-4 pb-4">
          <RoutineForm categories={categories} today={formatKST(todayKST())} />
        </div>
      </details>
      )}

      {routines.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          아직 루틴이 없어요
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CategoryChip name={group.name} color={group.color} />
              <span className="text-xs text-muted">{group.items.length}개</span>
            </div>

            <ul className="flex flex-col gap-3">
              {group.items.map((routine) => (
                <li key={routine.id} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">
                      {routine.content}
                    </span>
                    {routine.pausedAt && (
                      <span className="text-xs text-muted">멈춤</span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted">
                    {describeRule(routine)}
                    {routine.endDate && ` · ${formatKST(routine.endDate)}까지`}
                  </p>

                  <div className="mt-2 flex gap-3">
                    <form action={toggleRoutinePause}>
                      <input type="hidden" name="id" value={routine.id} />
                      <button type="submit" className="text-xs text-muted">
                        {routine.pausedAt ? "다시 시작" : "잠시 멈춤"}
                      </button>
                    </form>

                    {!routine.endDate && (
                      <form action={endRoutineToday}>
                        <input type="hidden" name="id" value={routine.id} />
                        <button type="submit" className="text-xs text-muted">
                          오늘까지만
                        </button>
                      </form>
                    )}

                    {/* 이미 만들어진 할 일은 남는다. 되돌리면 그 할 일들에 다시 이어진다. */}
                    <UndoableDeleteButton
                      id={routine.id}
                      remove={deleteRoutine}
                      restore={restoreRoutine}
                      message="루틴을 지웠어요. 만들어진 할 일은 남아요"
                      className="text-xs text-red-500"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
