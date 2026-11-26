"use client";

import Link from "next/link";

import { DiaryMood } from "@/components/diary-mood";
import { useT } from "@/components/locale-provider";
import { MOOD_LABEL_KEYS, isDiaryMood } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";

/** 홈의 하루 화면에 보이는 그날 일기. 글은 앞부분만 싣는다(lib/diary.ts의 clipDiary). */
export type HomeDiary = { mood: string | null; content: string };

/** 친구 화면의 그날 일기. 공개한 일기만 글을 싣고, 비공개한 일기는 날짜 말고는 아무것도 보내지 않는다(기분도 안 보낸다). */
export type FriendDiary = { kind: "public"; mood: string | null; content: string } | { kind: "private" };

const BASE = "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5";
const LINK = `${BASE} transition-colors hover:bg-surface-hover active:scale-[0.99]`;

/** 일기 카드의 내용: 기분 그림, 제목, 한 화면에 들어올 만큼의 글(넘치면 "…"). 내 화면과 친구 화면이 같이 쓴다. */
function DiaryPreview({ mood, content }: { mood: string | null; content: string }) {
  const t = useT(diary);
  return (
    <>
      <DiaryMood value={mood} size={44} label={mood && isDiaryMood(mood) ? t(MOOD_LABEL_KEYS[mood]) : undefined} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{t("title")}</span>
        {/* 글은 줄바꿈을 살려 여섯 줄까지 보이고 넘치면 "…"이 된다. */}
        <span className="line-clamp-6 whitespace-pre-line break-words text-sm leading-relaxed text-muted">{content}</span>
      </span>
      <span aria-hidden className="text-lg text-muted">
        ›
      </span>
    </>
  );
}

/**
 * 피드(홈)의 달력 바로 아래에서 그날의 일기로 가는 카드(2026-11-17, 11-18에 달력 밑으로).
 * 일기가 있으면 기분과 글의 앞부분이 보이고(2026-11-26 요청: 눌러야 읽는 것이 아니라 한 화면에 들어올 만큼은 바로 보이게), 누르면 그 날의 읽는 화면이 열린다.
 * 없으면 쓰러 가는 줄이고, 누르면 바로 쓰기 화면이 열린다. 아직 오지 않은 날에는 일기를 쓸 수 없어서 그리지 않는다.
 * "친구 공개" 표시는 두지 않는다(기본이 공개라 거의 모든 일기에 붙는다).
 */
export function DiaryCard({ date, today, entry }: { date: string; today: string; entry: HomeDiary | null }) {
  const t = useT(diary);
  if (date > today) return null;

  if (!entry) {
    return (
      <Link prefetch={false} href={`/diary/${date}/edit`} data-diary-card data-tour="diary" className={`${LINK} text-sm text-muted`}>
        <DiaryMood value={null} size={44} />
        {date === today ? t("cardEmptyToday") : t("cardEmptyPast")}
      </Link>
    );
  }
  return (
    <Link prefetch={false} href={`/diary/${date}`} data-diary-card data-tour="diary" className={LINK}>
      <DiaryPreview mood={entry.mood} content={entry.content} />
    </Link>
  );
}

/**
 * 친구 화면의 달력 아래 카드(2026-11-26 요청). 친구가 일기를 공개했으면 내 화면과 같은 카드이고, 누르면 친구의 일기 목록의 그 날로 간다.
 * 비공개로 둔 날은 "친구가 비공개한 일기예요", 쓰지 않은 날은 "일기를 쓰지 않았어요"라고 보인다(아직 오지 않은 날에는 그리지 않는다).
 */
export function FriendDiaryCard({ friendId, date, today, entry }: { friendId: string; date: string; today: string; entry: FriendDiary | null }) {
  const t = useT(diary);
  if (date > today) return null;

  if (entry?.kind === "public") {
    return (
      <Link prefetch={false} href={`/feed/u/${friendId}/diary?month=${date.slice(0, 7)}#d-${date}`} data-diary-card className={LINK}>
        <DiaryPreview mood={entry.mood} content={entry.content} />
      </Link>
    );
  }
  return (
    <div data-diary-card className={`${BASE} text-sm text-muted`}>
      <DiaryMood value={null} size={44} />
      {entry?.kind === "private" ? t("friendPrivate") : t("friendNone")}
    </div>
  );
}
