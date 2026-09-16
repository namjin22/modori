import Link from "next/link";

import { formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import {
  createRoutine,
  deleteRoutine,
  endRoutineToday,
  toggleRoutinePause,
} from "./actions";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

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
      include: { category: { select: { name: true, color: true } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="설정으로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">루틴</h1>
      </header>

      <p className="text-sm text-muted">
        해당 날짜를 열 때 할 일이 자동으로 만들어진다. 앞으로의 날짜는 예정으로만
        보이다가 체크할 때 생긴다.
      </p>

      <details className="rounded-2xl bg-surface p-4">
        <summary className="cursor-pointer font-medium">루틴 만들기</summary>

        <form action={createRoutine} className="mt-4 flex flex-col gap-3">
          <input
            name="content"
            required
            maxLength={200}
            placeholder="반복할 할 일"
            aria-label="루틴 내용"
            className="h-11 rounded-xl bg-surface-hover px-3"
          />

          <select
            name="categoryId"
            aria-label="루틴 카테고리"
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm"
          >
            <option value="">카테고리 없음</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            name="freq"
            defaultValue="DAILY"
            aria-label="반복 주기"
            className="h-11 rounded-xl bg-surface-hover px-3 text-sm"
          >
            <option value="DAILY">매일</option>
            <option value="WEEKLY">매주</option>
            <option value="MONTHLY">매월</option>
          </select>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-sm text-muted">
              매주일 때 고를 요일
            </legend>
            {WEEKDAY_NAMES.map((name, index) => (
              <label key={name} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="byWeekday" value={index} />
                {name}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-wrap gap-x-2 gap-y-1">
            <legend className="mb-1 text-sm text-muted">
              매월일 때 고를 날짜
            </legend>
            {MONTH_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-0.5 text-xs">
                <input type="checkbox" name="byMonthday" value={day} />
                {day}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm text-muted">
            시작일
            <input
              type="date"
              name="startDate"
              defaultValue={formatKST(todayKST())}
              className="h-11 rounded-xl bg-surface-hover px-3 text-foreground"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted">
            종료일 (비워두면 계속)
            <input
              type="date"
              name="endDate"
              className="h-11 rounded-xl bg-surface-hover px-3 text-foreground"
            />
          </label>

          <button
            type="submit"
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            루틴 추가
          </button>
        </form>
      </details>

      {routines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
          아직 루틴이 없다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => (
            <li key={routine.id} className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-2">
                {routine.category && (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: routine.category.color }}
                  />
                )}
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
                  <button type="submit" className="text-xs text-red-500">
                    삭제
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
