"use server";

import { Prisma, type RoutineFreq } from "@prisma/client";

import { revalidatePath } from "next/cache";

import { formatKST, parseKSTDate, todayKST } from "@/lib/date";
import { isId, readIdList } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_CONTENT_LENGTH = 200;
// 되돌리기 스냅숏의 id 목록 상한. 몇 년 돈 루틴이어도 이만큼은 안 된다.
const MAX_SNAPSHOT_IDS = 20_000;
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

export type RoutineFormState = { message: string; ok?: boolean } | null;

export async function createRoutine(
  _previous: RoutineFormState,
  formData: FormData,
): Promise<RoutineFormState> {
  const user = await requireUser();

  const content = readText(formData, "content").slice(0, MAX_CONTENT_LENGTH);
  const freq = readFreq(formData);
  if (!content) return { message: "반복할 할 일을 적어주세요." };
  if (!freq) return { message: "반복 주기를 골라주세요." };

  const byWeekday = freq === "WEEKLY" ? readNumbers(formData, "byWeekday", 6) : [];
  const byMonthday =
    freq === "MONTHLY" ? readNumbers(formData, "byMonthday", 31) : [];

  // 요일이나 날짜를 하나도 고르지 않은 루틴은 영원히 실행되지 않는다. 만들지 않는다.
  if (freq === "WEEKLY" && byWeekday.length === 0) {
    return { message: "반복할 요일을 하나 이상 골라주세요." };
  }
  if (freq === "MONTHLY" && byMonthday.length === 0) {
    return { message: "반복할 날짜를 하나 이상 골라주세요." };
  }

  const startDate = readDate(formData, "startDate") ?? todayKST();
  const endDate = readDate(formData, "endDate");
  if (endDate && endDate < startDate) {
    return { message: "종료일이 시작일보다 앞설 수 없어요." };
  }

  // 루틴은 카테고리 안에 들어간다(docs/decisions.md). 카테고리 없는 루틴은 만든 할 일이
  // 적을 수 없는 "카테고리 없음" 묶음에 쌓인다. 보관한 카테고리에도 새로 만들지 않는다.
  const categoryId = readText(formData, "categoryId");
  if (!categoryId) return { message: "카테고리를 골라주세요." };
  const owned = await prisma.category.findFirst({
    where: { id: categoryId, userId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!owned) return { message: "고른 카테고리를 찾을 수 없어요." };

  const count = await prisma.routine.count({ where: { userId: user.id } });
  if (count >= LIMITS.routines) {
    return { message: `루틴은 ${LIMITS.routines}개까지 만들 수 있어요. 안 쓰는 루틴을 지워주세요.` };
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
      startDate,
      endDate,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/routines");
  revalidatePath("/");

  return { message: "루틴을 만들었어요.", ok: true };
}

/** 일시정지하면 다음 조회부터 새 할 일이 생기지 않는다. 이미 만든 것은 남는다. */
export async function toggleRoutinePause(formData: FormData) {
  const user = await requireUser();
  const id = readText(formData, "id");

  const routine = await prisma.routine.findFirst({
    where: { id, userId: user.id },
    select: { pausedAt: true, categoryId: true },
  });
  if (!routine) return;

  // 화면이 누른 뒤의 상태를 보낸다. 뒤집기로 처리하면 다른 탭에서 먼저 바꾼 것을 되돌린다.
  const wanted = readText(formData, "paused");
  const pause = wanted === "true" || wanted === "false" ? wanted === "true" : !routine.pausedAt;

  // 카테고리를 지워 멈춘 루틴은 다시 돌리지 않는다. 카테고리 없이 돌면 적을 칸이 없다.
  if (!pause && !routine.categoryId) return;

  // 확인과 바꾸기 사이에 지워졌으면 0건으로 넘긴다(update는 오류를 던진다).
  await prisma.routine.updateMany({
    where: { id, userId: user.id, pausedAt: pause ? null : { not: null } },
    data: { pausedAt: pause ? new Date() : null },
  });

  revalidatePath("/routines");
  revalidatePath("/");
}

/**
 * 루틴을 지워도 이미 만들어진 할 일은 남는다.
 * 스키마의 onDelete: SetNull이 routineId만 비운다. 지나간 기록은 사실 그대로 둔다.
 */
/** 지운 루틴을 되돌릴 때 필요한 값. 날짜는 전부 문자열로 주고받는다. */
export type DeletedRoutine = {
  id: string;
  content: string;
  freq: RoutineFreq;
  byWeekday: number[];
  byMonthday: number[];
  categoryId: string | null;
  startDate: string;
  endDate: string | null;
  paused: boolean;
  order: number;
  // 루틴을 지우면 할 일의 routineId가 비워진다. 되돌릴 때 다시 이어 붙인다.
  todoIds: string[];
  skipDates: string[];
};

export async function deleteRoutine(id: string): Promise<DeletedRoutine | null> {
  const user = await requireUser();

  const routine = await prisma.routine.findFirst({
    where: { id, userId: user.id },
    include: {
      todos: { select: { id: true } },
      skips: { select: { date: true } },
    },
  });
  if (!routine) return null;

  await prisma.routine.delete({ where: { id: routine.id } });

  revalidatePath("/routines");
  revalidatePath("/");

  return {
    id: routine.id,
    content: routine.content,
    freq: routine.freq,
    byWeekday: routine.byWeekday,
    byMonthday: routine.byMonthday,
    categoryId: routine.categoryId,
    startDate: formatKST(routine.startDate),
    endDate: routine.endDate ? formatKST(routine.endDate) : null,
    paused: routine.pausedAt !== null,
    order: routine.order,
    todoIds: routine.todos.map((todo) => todo.id),
    skipDates: routine.skips.map((skip) => formatKST(skip.date)),
  };
}

function toKSTDates(values: string[]): Date[] {
  return values.flatMap((value) => {
    try {
      return [parseKSTDate(value)];
    } catch (error) {
      console.error("[routine] 되돌릴 날짜 형식이 잘못됐다.", error);
      return [];
    }
  });
}

/**
 * 방금 지운 루틴을 되살린다. 값은 브라우저에서 오므로 그대로 믿지 않는다.
 * 이어 붙이는 할 일도 본인 것이고 아직 비어 있는 것만 고른다.
 */
export async function restoreRoutine(snapshot: DeletedRoutine): Promise<string | void> {
  const user = await requireUser();

  if (!isId(snapshot.id) || typeof snapshot.content !== "string") return;
  const content = snapshot.content.trim().slice(0, MAX_CONTENT_LENGTH);
  const freq = FREQS.find((value) => value === snapshot.freq);
  if (!content || !freq) return;

  const [startDate] = toKSTDates([snapshot.startDate]);
  if (!startDate) return;
  const todoIds = readIdList(snapshot.todoIds, MAX_SNAPSHOT_IDS);
  // 날짜 목록도 id 목록과 같은 모양 검사를 거친다. 수만 개가 오면 쿼리 하나가 서버를 붙잡는다.
  const skipDates = readIdList(snapshot.skipDates, MAX_SNAPSHOT_IDS);
  if (!todoIds || !skipDates) return;
  if (!Array.isArray(snapshot.byWeekday) || !Array.isArray(snapshot.byMonthday)) return;
  const [endDate] = snapshot.endDate ? toKSTDates([snapshot.endDate]) : [];

  // 되돌리기도 새로 만드는 것과 같은 상한을 지킨다.
  const count = await prisma.routine.count({ where: { userId: user.id } });
  if (count >= LIMITS.routines) {
    return `루틴은 ${LIMITS.routines}개까지 만들 수 있어요.`;
  }

  const category = snapshot.categoryId
    ? await prisma.category.findFirst({
        where: { id: snapshot.categoryId, userId: user.id },
        select: { id: true },
      })
    : null;

  try {
    await prisma.$transaction([
      prisma.routine.create({
        data: {
          id: snapshot.id,
          userId: user.id,
          content,
          freq,
          byWeekday: snapshot.byWeekday.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
          byMonthday: snapshot.byMonthday.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31),
          categoryId: category?.id ?? null,
          startDate,
          endDate: endDate ?? null,
          // 그 사이 카테고리가 지워졌으면 멈춘 채로 되살린다. 카테고리 없이 돌면 적을 칸이 없다.
          pausedAt: snapshot.paused || !category ? new Date() : null,
          order: Number.isInteger(snapshot.order) ? snapshot.order : 0,
        },
      }),
      prisma.todo.updateMany({
        where: { id: { in: todoIds }, userId: user.id, routineId: null },
        data: { routineId: snapshot.id },
      }),
      prisma.routineSkip.createMany({
        data: toKSTDates(skipDates).map((date) => ({
          routineId: snapshot.id,
          date,
        })),
        skipDuplicates: true,
      }),
    ]);
  } catch (error) {
    // 두 번 눌렀거나 이미 되살아난 경우.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn("[routine] 이미 되살린 루틴이다.", snapshot.id);
      return;
    }
    throw error;
  }

  revalidatePath("/routines");
  revalidatePath("/");
}

export async function endRoutineToday(formData: FormData) {
  const user = await requireUser();

  await prisma.routine.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { endDate: parseKSTDate(formatKST(todayKST())) },
  });

  revalidatePath("/routines");
  revalidatePath("/");
}
