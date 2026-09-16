import Link from "next/link";

import {
  addMonths,
  daysInMonthKST,
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
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_DOTS = 4;
// 카테고리를 고르지 않은 할 일도 완료했다는 표시는 남아야 한다.
const NO_CATEGORY_COLOR = "#c7ccd1";

function readMonth(raw: string | undefined): Date {
  if (!raw) return startOfMonthKST(todayKST());

  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[calendar] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(todayKST());
  }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;

  const monthStart = readMonth(monthParam);
  const monthEnd = endOfMonthKST(monthStart);
  const today = todayKST();

  const done = await prisma.todo.findMany({
    where: {
      userId: user.id,
      done: true,
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { order: "asc" },
    select: { date: true, category: { select: { color: true } } },
  });

  // 날짜별로 그 날 완료한 할 일의 색을 모은다. 같은 색은 한 번만 찍는다.
  const colorsByDate = new Map<string, string[]>();
  for (const todo of done) {
    const key = formatKST(todo.date);
    const colors = colorsByDate.get(key) ?? [];
    const color = todo.category?.color ?? NO_CATEGORY_COLOR;
    if (!colors.includes(color)) colors.push(color);
    colorsByDate.set(key, colors);
  }

  const [year, month] = formatMonthKST(monthStart).split("-");
  const leadingBlanks = weekdayKST(monthStart);
  const days = Array.from({ length: daysInMonthKST(monthStart) }, (_, index) =>
    parseKSTDate(`${formatMonthKST(monthStart)}-${String(index + 1).padStart(2, "0")}`),
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link
          href={`/calendar?month=${formatMonthKST(addMonths(monthStart, -1))}`}
          aria-label="이전 달"
          className="rounded-lg px-2 py-1 text-muted hover:bg-surface-hover"
        >
          ←
        </Link>

        <h1 className="text-xl font-bold">
          {Number(year)}년 {Number(month)}월
        </h1>

        <Link
          href={`/calendar?month=${formatMonthKST(addMonths(monthStart, 1))}`}
          aria-label="다음 달"
          className="rounded-lg px-2 py-1 text-muted hover:bg-surface-hover"
        >
          →
        </Link>
      </header>

      <div className="rounded-2xl bg-surface p-3">
        <div className="grid grid-cols-7 text-center text-xs">
          {WEEKDAY_NAMES.map((name, index) => (
            <div
              key={name}
              className={`py-2 ${
                index === 0
                  ? "text-red-400"
                  : index === 6
                    ? "text-blue-400"
                    : "text-muted"
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}

          {days.map((day) => {
            const key = formatKST(day);
            const colors = colorsByDate.get(key) ?? [];
            const isToday = isSameKSTDate(day, today);

            return (
              <Link
                key={key}
                href={`/?date=${key}`}
                aria-label={`${day.getUTCDate()}일, 완료 ${colors.length > 0 ? "있음" : "없음"}`}
                className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl transition-colors hover:bg-surface-hover ${
                  isToday ? "bg-brand-subtle" : ""
                }`}
              >
                <span
                  className={`text-sm ${
                    isToday ? "font-bold text-brand" : "text-foreground"
                  }`}
                >
                  {day.getUTCDate()}
                </span>

                <span className="flex flex-wrap justify-center gap-0.5">
                  {colors.slice(0, MAX_DOTS).map((color) => (
                    <span
                      key={color}
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted">이번 달 완료 {done.length}개</p>
        {formatMonthKST(monthStart) !== formatMonthKST(today) && (
          <Link href="/calendar" className="text-sm text-brand">
            이번 달로 돌아가기
          </Link>
        )}
      </div>
    </div>
  );
}
