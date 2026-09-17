import Link from "next/link";

import { ConfirmButton } from "@/components/confirm-button";
import { CategoryChip } from "@/components/category-chip";
import { RoutineForm } from "@/components/routine-form";
import { formatKST, todayKST } from "@/lib/date";
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { deleteRoutine, endRoutineToday, toggleRoutinePause } from "./actions";

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
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="설정으로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">루틴</h1>
      </header>

      <p className="text-sm text-muted">
        해당 날짜를 열 때 할 일이 자동으로 만들어진다. 앞으로의 날짜는
        예정으로만 보이다가 체크할 때 생긴다.
      </p>

      <details className="rounded-2xl bg-surface p-4">
        <summary className="cursor-pointer font-medium">루틴 만들기</summary>
        <div className="mt-4">
          <RoutineForm categories={categories} today={formatKST(todayKST())} />
        </div>
      </details>

      {routines.length === 0 ? (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-muted">
          아직 루틴이 없다
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CategoryChip name={group.name} color={group.color} />
              <span className="text-xs text-muted">{group.items.length}개</span>
            </div>

            <ul className="flex flex-col gap-2">
              {group.items.map((routine) => (
                <li key={routine.id} className="rounded-2xl bg-surface p-3">
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

                    <form action={deleteRoutine}>
                      <input type="hidden" name="id" value={routine.id} />
                      <ConfirmButton
                        message="이 루틴을 지울까요? 이미 만들어진 할 일은 남습니다."
                        className="text-xs text-red-500"
                      >
                        삭제
                      </ConfirmButton>
                    </form>
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
