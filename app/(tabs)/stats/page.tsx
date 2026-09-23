import Link from "next/link";

import { Dori } from "@/components/dori";
import {
  addDays,
  addMonths,
  endOfMonthKST,
  formatKST,
  formatMonthKST,
  parseKSTMonth,
  startOfMonthKST,
  todayKST,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { countByCategory, countByWeekday, streakDays } from "@/lib/stats";
import { BackLink } from "@/components/back-link";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 주소의 month가 엉터리여도 화면은 열려야 한다. 그럴 때는 이번 달을 본다. */
function readMonth(raw: string | undefined, fallback: Date): Date {
  if (!raw) return startOfMonthKST(fallback);
  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[stats] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(fallback);
  }
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const today = todayKST();

  const { month } = await searchParams;
  const monthStart = readMonth(month, today);
  const monthEnd = endOfMonthKST(monthStart);

  const [monthTodos, streakTodos] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, done: true, category: true },
    }),
    // 이어온 날은 달이 바뀌어도 이어진다. 넉넉히 1년치를 본다.
    prisma.todo.findMany({
      where: {
        userId: user.id,
        done: true,
        date: { gte: addDays(today, -365), lte: today },
      },
      select: { date: true, done: true, category: true },
    }),
  ]);

  const total = monthTodos.length;
  const done = monthTodos.filter((todo) => todo.done).length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);
  const categories = countByCategory(monthTodos);
  const weekdays = countByWeekday(monthTodos);
  const streak = streakDays(streakTodos, today);
  const mostDone = Math.max(...weekdays);

  const [year, monthNumber] = formatMonthKST(monthStart).split("-");
  const isThisMonth = formatMonthKST(monthStart) === formatMonthKST(today);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="피드로" />
        <h1 className="text-2xl font-bold">기록</h1>
      </header>

      <nav aria-label="달 고르기" className="flex items-center justify-between">
        <Link
          href={`/stats?month=${formatMonthKST(addMonths(monthStart, -1))}`}
          aria-label="이전 달"
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
        >
          ‹
        </Link>
        <h2 className="text-base font-semibold">
          {Number(year)}년 {Number(monthNumber)}월
        </h2>
        {isThisMonth ? (
          // 아직 오지 않은 달에는 아무것도 없다. 갈 수 있는 것처럼 보이지 않게 한다.
          <span aria-hidden className="size-9" />
        ) : (
          <Link
            href={`/stats?month=${formatMonthKST(addMonths(monthStart, 1))}`}
            aria-label="다음 달"
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ›
          </Link>
        )}
      </nav>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Dori mood="calm" size={80} />
          <p className="text-sm text-muted">이 달에는 적어둔 할 일이 없어요</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2">
            <Figure label="끝낸 일" value={`${done}개`} />
            <Figure label="해낸 비율" value={`${rate}%`} />
            <Figure label="이어온 날" value={`${streak}일`} />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">카테고리별</h2>
            <ul className="flex flex-col gap-4">
              {categories.map((category) => (
                <li key={category.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 color-edge rounded-full"
                      style={{
                        backgroundColor: category.color ?? "var(--color-border)",
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {category.name}
                    </span>
                    <span className="shrink-0 text-muted">
                      {category.done}/{category.total}
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${category.name} ${category.total}개 중 ${category.done}개 완료`}
                    className="h-2 overflow-hidden rounded-full bg-surface-hover"
                  >
                    {/* 0%면 그리지 않는다. 가장자리 선은 폭이 0이어도 그려져서 점이 남는다. */}
                    {category.done > 0 && (
                      <div
                        className="color-edge h-full rounded-full transition-[width]"
                        style={{
                          width: `${(category.done / category.total) * 100}%`,
                          backgroundColor:
                            category.color ?? "var(--color-foreground)",
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">요일별로 끝낸 일</h2>
            {/* 막대는 가장 많이 한 요일을 기준으로 높이를 맞춘다. */}
            <ul className="flex h-28 items-end gap-2">
              {weekdays.map((count, weekday) => (
                <li
                  key={weekday}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <span className="text-[11px] text-muted">{count}</span>
                  <span
                    aria-hidden
                    className="w-full rounded-t-md bg-brand"
                    style={{
                      height: `${mostDone === 0 ? 0 : (count / mostDone) * 68}px`,
                      minHeight: count > 0 ? 4 : 0,
                    }}
                  />
                  <span
                    className={`text-[11px] ${
                      weekday === 0
                        ? "text-red-400"
                        : weekday === 6
                          ? "text-blue-400"
                          : "text-muted"
                    }`}
                  >
                    {WEEKDAY_NAMES[weekday]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="text-xs text-muted">
        {formatKST(monthStart)}부터 {formatKST(monthEnd)}까지 적어둔 할 일을
        셌어요.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-4">
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
