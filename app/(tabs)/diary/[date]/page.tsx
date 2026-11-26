import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { DiaryMood } from "@/components/diary-mood";
import { DiaryNextDay } from "@/components/diary-next-day";
import { DiarySavedNotice } from "@/components/diary-saved-notice";
import { addDays, formatKST } from "@/lib/date";
import { MOOD_LABEL_KEYS, isDiaryMood } from "@/lib/diary";
import { dayHeading } from "@/lib/i18n/format";
import { diary } from "@/lib/i18n/messages/diary";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";

import { loadDiaryDay } from "./load-day";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(diary))("pageTitle") };
}

/**
 * 하루치 일기를 읽는 화면(2026-11-24 요청: 들어가면 늘 고치는 화면이라 별로다. 읽는 곳을 따로 두고 쓰기 버튼으로 넘어가게).
 * 목록·홈 카드에서 일기를 누르면 여기로 온다. 고치거나 새로 쓰려면 아래 버튼으로 쓰기 화면(/diary/날짜/edit)에 간다.
 * 앞뒤 날의 일기로 넘어갈 수 있고, 뒤로는 오늘까지만 간다(오늘에서는 다음 날 단추가 움찔만 한다).
 */
export default async function DiaryDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { date: raw } = await params;
  const { user, date, today, key } = await loadDiaryDay(raw, (day) => `/diary/${day}`);
  const t = await getT(diary);
  const locale = await getLocale();
  const { saved } = await searchParams;

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: user.id, date } },
    select: { content: true, mood: true },
  });
  const mood = entry?.mood && isDiaryMood(entry.mood) ? entry.mood : null;

  const hasNext = date.getTime() < today.getTime();
  const navButton = "flex size-10 items-center justify-center rounded-full text-lg text-foreground hover:bg-surface-hover";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <BackLink href="/diary" label={t("toList")} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{key}</p>
          <h1 className="text-xl font-bold">{dayHeading(locale, date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay())}</h1>
        </div>
        <Link prefetch={false} href={`/diary/${formatKST(addDays(date, -1))}`} aria-label={t("prevDay")} className={navButton}>
          ‹
        </Link>
        {/* 오늘에서는 단추만 두고 누르면 움찔할 뿐 아무 데도 가지 않는다(내일의 일기는 쓸 수 없다, 2026-11-17 요청). */}
        <DiaryNextDay href={hasNext ? `/diary/${formatKST(addDays(date, 1))}` : null} label={t("nextDay")} />
      </header>

      {saved === "1" && entry && <DiarySavedNotice text={t("saved")} />}

      {entry ? (
        <article aria-label={t("title")} className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
          <div className="flex items-center gap-3">
            <DiaryMood value={entry.mood} size={52} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {mood && <span className="text-base font-semibold">{t(MOOD_LABEL_KEYS[mood])}</span>}
            </div>
          </div>
          <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-relaxed">{entry.content}</p>
        </article>
      ) : (
        <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">{t("viewEmpty")}</p>
      )}

      <Link
        prefetch={false}
        href={`/diary/${key}/edit`}
        className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {entry ? t("edit") : t("write")}
      </Link>
    </div>
  );
}
