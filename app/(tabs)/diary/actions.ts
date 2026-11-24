"use server";

import { revalidatePath } from "next/cache";

import { formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { MAX_DIARY_LENGTH, diaryDateProblem, readDiaryContent, readDiaryMood } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type DiaryFormState = { message: string; ok?: boolean } | null;

function readDay(value: FormDataEntryValue | string | null): Date | null {
  if (typeof value !== "string") return null;
  try {
    return parseKSTDate(value);
  } catch (error) {
    console.error("[diary] 날짜 형식이 잘못됐다.", error);
    return null;
  }
}

/**
 * 그 날의 일기를 저장한다(없으면 만들고 있으면 고친다, 하루 한 편). 날짜는 쓴 사람의 시간대 달력으로 오늘까지만 받는다.
 * 일기는 기본으로 나만 본다: "public"이 켜진 폼만 팔로워에게 보인다(체크하지 않으면 값이 오지 않는다).
 */
export async function saveDiary(formData: FormData): Promise<DiaryFormState> {
  const user = await requireUser();
  const t = await getT(diary);

  const date = readDay(formData.get("date"));
  if (!date) return { message: t("errorDate") };
  const problem = diaryDateProblem(date, todayIn(user.timezone));
  if (problem === "future") return { message: t("errorFuture") };
  if (problem === "tooOld") return { message: t("errorTooOld") };

  const content = readDiaryContent(formData.get("content"));
  if (!content.ok) return { message: content.reason === "empty" ? t("errorEmpty") : t("errorTooLong", { max: MAX_DIARY_LENGTH }) };
  const mood = readDiaryMood(formData.get("mood"));
  if (mood === undefined) return { message: t("errorMood") };
  const isPublic = formData.get("public") === "on";

  await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, content: content.content, mood, isPublic },
    update: { content: content.content, mood, isPublic },
  });

  revalidatePath("/diary");
  revalidatePath(`/diary/${formatKST(date)}`);
  revalidatePath(`/diary/${formatKST(date)}/edit`);
  return { message: t("saved"), ok: true };
}

/** 그 날의 일기를 지운다. 내 것만 지워지고(userId를 건다), 없는 날이면 아무 일도 하지 않는다. */
export async function deleteDiary(day: string): Promise<void> {
  const user = await requireUser();
  const date = readDay(day);
  if (!date) return;
  await prisma.diaryEntry.deleteMany({ where: { userId: user.id, date } });
  revalidatePath("/diary");
  revalidatePath(`/diary/${formatKST(date)}`);
}
