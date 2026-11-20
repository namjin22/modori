"use client";

import Link from "next/link";

import { DiaryMood } from "@/components/diary-mood";
import { useT } from "@/components/locale-provider";
import { MOOD_LABEL_KEYS, isDiaryMood } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";

/** 홈의 하루 화면에 보이는 그날 일기의 맛보기(글은 lib/diary.ts의 diaryExcerpt로 미리 줄여 온다). */
export type HomeDiary = { mood: string | null; excerpt: string; isPublic: boolean };

/**
 * 피드(홈)의 달력 바로 아래에서 그날의 일기를 바로 보는 카드(2026-11-17 요청: 일기는 쓰면 피드에서 바로 확인할 수 있게, 11-18에 달력 밑으로).
 * 일기가 있으면 기분과 앞부분을 보이고, 없으면 쓰러 가는 줄을 보인다. 누르면 그 날의 일기 화면이 열린다.
 * 아직 오지 않은 날에는 일기를 쓸 수 없어서 그리지 않는다.
 */
export function DiaryCard({ date, today, entry }: { date: string; today: string; entry: HomeDiary | null }) {
  const t = useT(diary);
  if (date > today) return null;

  const base = "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 transition-colors hover:bg-surface-hover active:scale-[0.99]";
  if (!entry) {
    return (
      <Link prefetch={false} href={`/diary/${date}`} data-diary-card data-tour="diary" className={`${base} text-sm text-muted`}>
        <DiaryMood value={null} size={44} />
        {date === today ? t("cardEmptyToday") : t("cardEmptyPast")}
      </Link>
    );
  }
  return (
    <Link prefetch={false} href={`/diary/${date}`} data-diary-card data-tour="diary" className={base}>
      <DiaryMood value={entry.mood} size={44} label={entry.mood && isDiaryMood(entry.mood) ? t(MOOD_LABEL_KEYS[entry.mood]) : undefined} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {t("title")}
          {entry.isPublic && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-normal text-muted">{t("publicBadge")}</span>}
        </span>
        <span className="line-clamp-2 break-words text-sm leading-relaxed text-muted">{entry.excerpt}</span>
      </span>
    </Link>
  );
}
