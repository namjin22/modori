import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { DiaryMood } from "@/components/diary-mood";
import { addDays, endOfMonthKST, formatKST, formatMonthKST, parseKSTMonth, startOfMonthKST, todayIn } from "@/lib/date";
import { MOOD_LABEL_KEYS, diaryExcerpt, isDiaryMood } from "@/lib/diary";
import { monthDayWithWeekday, yearMonth } from "@/lib/i18n/format";
import { diary } from "@/lib/i18n/messages/diary";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(diary))("pageTitle") };
}

function readMonth(raw: string | undefined, fallback: Date): Date {
  if (!raw) return startOfMonthKST(fallback);
  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[diary] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(fallback);
  }
}

/**
 * 내 일기 목록(2026-11-17, docs/decisions.md "일기"). 달마다 쓴 일기를 최근 날부터 보이고, 오늘 일기로 바로 가는 단추가 있다.
 * 일기는 기본으로 나만 본다. 친구 공개를 켠 일기에는 표시가 붙는다.
 */
export default async function DiaryListPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const t = await getT(diary);
  const locale = await getLocale();
  const query = await searchParams;

  const today = todayIn(user.timezone);
  const monthStart = readMonth(query.month, today);
  const monthEnd = endOfMonthKST(monthStart);
  const [entries, todayEntry] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "desc" },
      select: { date: true, content: true, mood: true, isPublic: true },
    }),
    prisma.diaryEntry.findUnique({ where: { userId_date: { userId: user.id, date: today } }, select: { id: true } }),
  ]);

  const previous = formatMonthKST(addDays(monthStart, -1));
  const next = formatMonthKST(addDays(monthEnd, 1));
  // 아직 오지 않은 달의 일기는 쓸 수 없으니 이번 달보다 뒤로는 가지 않는다.
  const hasNext = monthEnd.getTime() < today.getTime();
  const navButton = "flex size-10 items-center justify-center rounded-full text-lg text-foreground hover:bg-surface-hover";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <BackLink href="/" label={t("toHome")} />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>
      <p className="text-sm leading-relaxed text-muted">{t("privateNote")}</p>

      <Link
        prefetch={false}
        href={`/diary/${formatKST(today)}`}
        className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {todayEntry ? t("editToday") : t("writeToday")}
      </Link>

      <nav aria-label={t("title")} className="flex items-center justify-between">
        <Link prefetch={false} href={`/diary?month=${previous}`} aria-label={t("prevMonth")} className={navButton}>
          ‹
        </Link>
        <h2 className="text-base font-semibold">{yearMonth(locale, monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1)}</h2>
        {hasNext ? (
          <Link prefetch={false} href={`/diary?month=${next}`} aria-label={t("nextMonth")} className={navButton}>
            ›
          </Link>
        ) : (
          <span aria-hidden className="size-10" />
        )}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-muted">{t("monthEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const key = formatKST(entry.date);
            return (
              <li key={key}>
                <Link prefetch={false} href={`/diary/${key}`} className="flex gap-3 rounded-2xl bg-surface p-4 hover:bg-surface-hover">
                  <DiaryMood value={entry.mood} size={44} label={entry.mood && isDiaryMood(entry.mood) ? t(MOOD_LABEL_KEYS[entry.mood]) : undefined} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {monthDayWithWeekday(locale, entry.date.getUTCMonth() + 1, entry.date.getUTCDate(), entry.date.getUTCDay())}
                      {entry.isPublic && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-normal text-muted">{t("publicBadge")}</span>}
                    </span>
                    <span className="line-clamp-3 break-words text-sm leading-relaxed text-muted">{diaryExcerpt(entry.content)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
