"use server";

import type { RoutineFreq } from "@prisma/client";

import { revalidatePath } from "next/cache";

import { formatKST, parseKSTDate, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_CONTENT_LENGTH = 200;
const FREQS: RoutineFreq[] = ["DAILY", "WEEKLY", "MONTHLY"];

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readFreq(formData: FormData): RoutineFreq | null {
  const value = readText(formData, "freq");
  return FREQS.find((freq) => freq === value) ?? null;
}

/** 체크박스는 체크된 것만 전송된다. 0~6, 1~31 범위 밖은 버린다. */
function readNumbers(formData: FormData, key: string, max: number): number[] {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= max);
}

function readDate(formData: FormData, key: string): Date | null {
  const value = readText(formData, key);
  if (!value) return null;

  try {
    return parseKSTDate(value);
  } catch (error) {
    console.error(`[routine] ${key} 날짜 형식이 잘못됐다.`, error);
    return null;
  }
}

export async function createRoutine(formData: FormData) {
  const user = await requireUser();

  const content = readText(formData, "content").slice(0, MAX_CONTENT_LENGTH);
  const freq = readFreq(formData);
  if (!content || !freq) return;

  const byWeekday = freq === "WEEKLY" ? readNumbers(formData, "byWeekday", 6) : [];
  const byMonthday =
    freq === "MONTHLY" ? readNumbers(formData, "byMonthday", 31) : [];

  // 요일이나 날짜를 하나도 고르지 않은 루틴은 영원히 실행되지 않는다. 만들지 않는다.
  if (freq === "WEEKLY" && byWeekday.length === 0) return;
  if (freq === "MONTHLY" && byMonthday.length === 0) return;

  const categoryId = readText(formData, "categoryId") || null;
  if (categoryId) {
    const owned = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return;
  }

  const last = await prisma.routine.findFirst({
    where: { userId: user.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.routine.create({
    data: {
      userId: user.id,
      content,
      freq,
      byWeekday,
      byMonthday,
      categoryId,
      startDate: readDate(formData, "startDate") ?? todayKST(),
      endDate: readDate(formData, "endDate"),
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/settings/routines");
  revalidatePath("/");
}

/** 일시정지하면 다음 조회부터 새 할 일이 생기지 않는다. 이미 만든 것은 남는다. */
export async function toggleRoutinePause(formData: FormData) {
  const user = await requireUser();
  const id = readText(formData, "id");

  const routine = await prisma.routine.findFirst({
    where: { id, userId: user.id },
    select: { pausedAt: true },
  });
  if (!routine) return;

  await prisma.routine.update({
    where: { id },
    data: { pausedAt: routine.pausedAt ? null : new Date() },
  });

  revalidatePath("/settings/routines");
  revalidatePath("/");
}

/**
 * 루틴을 지워도 이미 만들어진 할 일은 남는다.
 * 스키마의 onDelete: SetNull이 routineId만 비운다. 지나간 기록은 사실 그대로 둔다.
 */
export async function deleteRoutine(formData: FormData) {
  const user = await requireUser();

  await prisma.routine.deleteMany({
    where: { id: readText(formData, "id"), userId: user.id },
  });

  revalidatePath("/settings/routines");
  revalidatePath("/");
}

export async function endRoutineToday(formData: FormData) {
  const user = await requireUser();

  await prisma.routine.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { endDate: parseKSTDate(formatKST(todayKST())) },
  });

  revalidatePath("/settings/routines");
  revalidatePath("/");
}
