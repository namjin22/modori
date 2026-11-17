import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { DiaryEditor } from "@/components/diary-editor";
import { DiaryNextDay } from "@/components/diary-next-day";
import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { DEFAULT_CHARACTER, isCharacterId } from "@/lib/characters";
import { diaryDateProblem } from "@/lib/diary";
import { dayHeading } from "@/lib/i18n/format";
import { diary } from "@/lib/i18n/messages/diary";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(diary))("pageTitle") };
}

/**
 * 하루치 일기를 쓰고 고치는 화면(2026-11-17). 주소의 날짜가 잘못되면 없는 주소, 아직 오지 않은 날이면 오늘로 보낸다.
 * 앞뒤 날의 일기로 넘어갈 수 있고, 뒤로는 오늘까지만 간다.
 */
export default async function DiaryDayPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await requireUser();
  const t = await getT(diary);
  const locale = await getLocale();
  const { date: raw } = await params;

  let date: Date;
  try {
    date = parseKSTDate(raw);
  } catch (error) {
    console.error("[diary] 날짜 형식이 잘못됐다.", error);
    notFound();
  }
  const today = todayIn(user.timezone);
  const problem = diaryDateProblem(date, today);
  if (problem === "future") redirect(`/diary/${formatKST(today)}`);
  if (problem === "tooOld") notFound();

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: user.id, date } },
    select: { content: true, mood: true, isPublic: true },
  });

  const key = formatKST(date);
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

      <DiaryEditor key={key} date={key} initial={entry} character={isCharacterId(user.avatarCharacter) ? user.avatarCharacter : DEFAULT_CHARACTER} />
    </div>
  );
}
