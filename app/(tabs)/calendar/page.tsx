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
// 한 칸에 이름을 몇 개까지 보여줄지. 넘치면 "+n"으로 접는다.
const MAX_CHIPS = 3;
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
    select: {
      date: true,
      content: true,
      category: { select: { color: true } },
    },
  });

  // 날짜별로 그 날 완료한 할 일을 모은다. 색 점만 찍으면 무엇을 했는지는 알 수 없다.
  const doneByDate = new Map<string, { content: string; color: string }[]>();
  for (const todo of done) {
    const key = formatKST(todo.date);
    const items = doneByDate.get(key) ?? [];
    items.push({
      content: todo.content,
      color: todo.category?.color ?? NO_CATEGORY_COLOR,
    });
    doneByDate.set(key, items);
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

      <div className="rounded-2xl bg-surface p-2">
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

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}

          {days.map((day) => {
            const key = formatKST(day);
            const items = doneByDate.get(key) ?? [];
            const isToday = isSameKSTDate(day, today);

            return (
              <Link
                key={key}
                href={`/?date=${key}`}
                // 한 달치 날짜 칸이 서른 개다. 미리 받으면 달력을 열 때마다
                // 서버가 할 일 화면을 서른 번 그린다.
                prefetch={false}
                aria-label={`${day.getUTCDate()}일, 완료 ${items.length > 0 ? "있음" : "없음"}`}
                className={`flex min-h-16 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors hover:bg-surface-hover ${
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

                {/* 한 일의 이름을 그대로 보여준다. 칸이 좁아 잘리지만,
                    색과 첫 글자만으로도 그 날 뭘 했는지 떠올릴 수 있다. */}
                <span aria-hidden className="flex w-full flex-col gap-px">
                  {items.slice(0, MAX_CHIPS).map((item, index) => (
                    <span
                      key={`${item.content}-${index}`}
                      className="truncate rounded px-0.5 text-[9px] leading-[13px]"
                      style={{
                        color: item.color,
                        backgroundColor: `${item.color}26`,
                      }}
                    >
                      {item.content}
                    </span>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="text-[9px] leading-[13px] text-muted">
                      +{items.length - MAX_CHIPS}
                    </span>
                  )}
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
