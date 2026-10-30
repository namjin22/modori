import Link from "next/link";

import { Dori } from "@/components/dori";
import { statsMood } from "@/lib/dori-mood";
import { monthDay, weekdayName, yearMonth } from "@/lib/i18n/format";
import { stats as statsMessages } from "@/lib/i18n/messages/stats";
import type { Locale } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import {
  addDays,
  addMonths,
  endOfMonthKST,
  formatMonthKST,
  parseKSTMonth,
  startOfMonthKST,
  todayIn,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { countByCategory, countByWeekday, streakDays, untilToday } from "@/lib/stats";
import { BackLink } from "@/components/back-link";

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
  const t = await getT(statsMessages);
  const locale = await getLocale();
  const today = todayIn(user.timezone);

  const { month } = await searchParams;
  const monthStart = readMonth(month, today);
  const monthEnd = endOfMonthKST(monthStart);

  const [writtenTodos, streakTodos] = await Promise.all([
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

  // 이번 달을 볼 때 앞날에 미리 적어 둔 일은 세지 않는다(lib/stats.ts untilToday).
  const monthTodos = untilToday(writtenTodos, today);
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
        <BackLink href="/" label={t("toFeed")} />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>

      <nav aria-label={t("pickMonth")} className="flex items-center justify-between">
        <Link prefetch={false}
          href={`/stats?month=${formatMonthKST(addMonths(monthStart, -1))}`}
          aria-label={t("prevMonth")}
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
        >
          ‹
        </Link>
        <h2 className="text-base font-semibold">
          {yearMonth(locale, Number(year), Number(monthNumber))}
        </h2>
        {isThisMonth ? (
          // 아직 오지 않은 달에는 아무것도 없다. 갈 수 있는 것처럼 보이지 않게 한다.
          <span aria-hidden className="size-9" />
        ) : (
          <Link prefetch={false}
            href={`/stats?month=${formatMonthKST(addMonths(monthStart, 1))}`}
            aria-label={t("nextMonth")}
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover"
          >
            ›
          </Link>
        )}
      </nav>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Dori mood="calm" size={80} />
          <p className="text-sm text-muted">{t("empty")}</p>
        </div>
      ) : (
        <>
          <StatsCheer rate={rate} streak={streak} isThisMonth={isThisMonth} locale={locale} />

          <section className="grid grid-cols-3 gap-2">
            <Figure label={t("done")} value={t("figureCount", { count: done })} />
            <Figure label={t("rate")} value={`${rate}%`} />
            <Figure label={t("streak")} value={t("figureDays", { count: streak })} />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{t("byCategory")}</h2>
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
                      {category.id === "" ? t("noCategory") : category.name}
                    </span>
                    <span className="shrink-0 text-muted">
                      {category.done}/{category.total}
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={t("categoryProgress", { name: category.id === "" ? t("noCategory") : category.name, total: category.total, done: category.done })}
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
            <h2 className="text-sm font-semibold">{t("byWeekday")}</h2>
            {/* 막대는 가장 많이 한 요일을 기준으로 높이를 맞춘다. */}
            <ul className="flex h-28 items-end gap-2">
              {weekdays.map((count, weekday) => (
                <li
                  key={weekday}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  {/* 숫자와 요일을 따로 읽으면 "1 일"이 되어 "하루"로 들린다. 이어서 읽는 이름을 따로 둔다. */}
                  <span className="sr-only">
                    {t("weekdayCount", { weekday: weekdayName(locale, weekday, "long"), count })}
                  </span>
                  <span aria-hidden className="text-[11px] text-muted">
                    {count}
                  </span>
                  <span
                    aria-hidden
                    className="w-full rounded-t-md bg-brand"
                    style={{
                      height: `${mostDone === 0 ? 0 : (count / mostDone) * 68}px`,
                      minHeight: count > 0 ? 4 : 0,
                    }}
                  />
                  <span
                    aria-hidden
                    className={`text-[11px] ${
                      weekday === 0
                        ? "text-danger"
                        : weekday === 6
                          ? "text-brand"
                          : "text-muted"
                    }`}
                  >
                    {weekdayName(locale, weekday)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="text-xs text-muted">
        {t("footer", { from: monthDay(locale, monthStart.getUTCMonth() + 1, monthStart.getUTCDate()), to: monthDay(locale, monthEnd.getUTCMonth() + 1, monthEnd.getUTCDate()) })}
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

/** 이 달을 한 줄로 알아봐 준다. 숫자 셋보다 먼저 눈에 들어오는 자리다. */
function StatsCheer({
  rate,
  streak,
  isThisMonth,
  locale,
}: {
  rate: number;
  streak: number;
  isThisMonth: boolean;
  locale: Locale;
}) {
  const { mood, message } = statsMood({ rate, streak, isThisMonth }, locale);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-subtle px-4 py-3">
      <Dori mood={mood} size={48} />
      <p className="text-sm font-semibold text-brand">{message}</p>
    </div>
  );
}
