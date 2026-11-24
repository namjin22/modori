import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { DiaryEditor } from "@/components/diary-editor";
import { dayHeading } from "@/lib/i18n/format";
import { diary } from "@/lib/i18n/messages/diary";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";

import { loadDiaryDay } from "../load-day";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(diary))("pageTitle") };
}

/**
 * 하루치 일기를 쓰고 고치는 화면(2026-11-24에 읽는 화면과 나눴다). 저장하면 그 날의 읽는 화면으로 돌아간다.
 * 쓰는 중에 다른 날로 넘어가면 적던 글이 사라지므로 앞뒤 날 단추는 읽는 화면에만 둔다.
 */
export default async function DiaryEditPage({ params }: { params: Promise<{ date: string }> }) {
  const { date: raw } = await params;
  const { user, date, key } = await loadDiaryDay(raw, (day) => `/diary/${day}/edit`);
  const t = await getT(diary);
  const locale = await getLocale();

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: user.id, date } },
    select: { content: true, mood: true, isPublic: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-1">
        <BackLink href={`/diary/${key}`} label={t("toView")} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{key}</p>
          <h1 className="text-xl font-bold">{dayHeading(locale, date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay())}</h1>
        </div>
      </header>

      <DiaryEditor key={key} date={key} initial={entry} />
    </div>
  );
}
