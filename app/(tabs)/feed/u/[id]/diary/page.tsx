import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { DiaryMood } from "@/components/diary-mood";
import { addDays, endOfMonthKST, formatKST, formatMonthKST, parseKSTMonth, startOfMonthKST, todayIn } from "@/lib/date";
import { MOOD_LABEL_KEYS, isDiaryMood } from "@/lib/diary";
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
 * 팔로우한 친구가 공개로 켠 일기(2026-11-17, docs/decisions.md "일기"). 공개하지 않은 일기는 이 화면에 오지도 않는다(조건에서 거른다).
 * 접근 규칙은 친구 화면과 같다: 나를 차단한 사람은 없는 주소, 내가 차단한 사람과 팔로우하지 않은 사람은 친구 화면으로 보낸다(그쪽이 안내를 보인다).
 */
export default async function FriendDiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const viewer = await requireUser();
  const t = await getT(diary);
  const locale = await getLocale();
  const { id } = await params;
  const query = await searchParams;

  if (id === viewer.id) redirect("/diary");

  const [iBlocked, blockedMe] = await Promise.all([
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: id } }, select: { blockedId: true } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: id, blockedId: viewer.id } }, select: { blockerId: true } }),
  ]);
  if (blockedMe) notFound();
  if (iBlocked) redirect(`/feed/u/${id}`);

  const friend = await prisma.user.findFirst({
    where: { id, nickname: { not: null }, followers: { some: { followerId: viewer.id } } },
    select: { id: true, nickname: true },
  });
  if (!friend?.nickname) redirect(`/feed/u/${id}`);

  const today = todayIn(viewer.timezone);
  const monthStart = readMonth(query.month, today);
  const monthEnd = endOfMonthKST(monthStart);
  const entries = await prisma.diaryEntry.findMany({
    where: { userId: friend.id, isPublic: true, date: { gte: monthStart, lte: monthEnd } },
    orderBy: { date: "desc" },
    select: { date: true, content: true, mood: true },
  });

  const base = `/feed/u/${friend.id}/diary`;
  const previous = formatMonthKST(addDays(monthStart, -1));
  const next = formatMonthKST(addDays(monthEnd, 1));
  const hasNext = monthEnd.getTime() < today.getTime();
  const navButton = "flex size-10 items-center justify-center rounded-full text-lg text-foreground hover:bg-surface-hover";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <BackLink href={`/feed/u/${friend.id}`} label={t("toFriend")} />
        <h1 className="min-w-0 truncate text-2xl font-bold">{t("friendTitle", { name: friend.nickname })}</h1>
      </header>

      <nav aria-label={t("title")} className="flex items-center justify-between">
        <Link prefetch={false} href={`${base}?month=${previous}`} aria-label={t("prevMonth")} className={navButton}>
          ‹
        </Link>
        <h2 className="text-base font-semibold">{yearMonth(locale, monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1)}</h2>
        {hasNext ? (
          <Link prefetch={false} href={`${base}?month=${next}`} aria-label={t("nextMonth")} className={navButton}>
            ›
          </Link>
        ) : (
          <span aria-hidden className="size-10" />
        )}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-muted">{t("friendEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={formatKST(entry.date)} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                {entry.mood && <DiaryMood value={entry.mood} size={40} label={isDiaryMood(entry.mood) ? t(MOOD_LABEL_KEYS[entry.mood]) : undefined} />}
                {monthDayWithWeekday(locale, entry.date.getUTCMonth() + 1, entry.date.getUTCDate(), entry.date.getUTCDay())}
              </p>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{entry.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
