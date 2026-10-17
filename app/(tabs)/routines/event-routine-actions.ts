"use server";

import { Prisma, type RoutineFreq } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { DEFAULT_EVENT_COLOR, isPaletteColor } from "@/lib/colors";
import { formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { parseTime } from "@/lib/event-time";
import { isId } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * 반복 일정(일정 루틴). 할 일 루틴과 같은 루틴 화면에서 만들고, 상한(LIMITS.routines)도 둘을 합쳐 센다.
 * 규칙만 저장하고 화면이 날짜로 펼친다(lib/event-routine.ts).
 */
const MAX_TITLE_LENGTH = 100;
const FREQS: RoutineFreq[] = ["DAILY", "WEEKLY", "MONTHLY"];

export type EventRoutineFormState = { message: string; ok?: boolean } | null;

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readDate(value: string): Date | null {
  if (!value) return null;
  try {
    return parseKSTDate(value);
  } catch (error) {
    console.error("[event-routine] 날짜 형식이 잘못됐다.", error);
    return null;
  }
}

function readNumbers(formData: FormData, key: string, min: number, max: number): number[] {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= min && value <= max);
}

/** 이름·색·시각. 만들 때와 고칠 때 같이 쓴다. 문제가 있으면 보여 줄 문장을 돌려준다. */
function readLook(
  formData: FormData,
): { title: string; color: string; startTime: number | null; endTime: number | null; isPublic: boolean } | string {
  const title = readText(formData, "title").slice(0, MAX_TITLE_LENGTH);
  if (!title) return "일정 이름을 적어주세요.";
  const rawColor = readText(formData, "color");
  // 팔레트 밖의 값은 받지 않는다(색이 아닌 글이 style로 들어가지 않게).
  const color = rawColor ? (isPaletteColor(rawColor) ? rawColor : null) : DEFAULT_EVENT_COLOR;
  if (!color) return "색을 다시 골라주세요.";
  const startTime = parseTime(readText(formData, "startTime"));
  const endTime = parseTime(readText(formData, "endTime"));
  if (startTime === undefined || endTime === undefined) return "시간을 다시 골라주세요.";
  if (startTime === null && endTime !== null) return "시작 시간을 먼저 정해주세요.";
  if (startTime !== null && endTime !== null && endTime < startTime) return "끝나는 시간이 시작 시간보다 앞설 수 없어요.";
  // 팔로워에게 보일지(일정과 같다, 2026-10-17). 스위치가 꺼져 있으면 값이 오지 않는다.
  return { title, color, startTime, endTime, isPublic: formData.get("isPublic") === "on" };
}

async function routineCount(userId: string): Promise<number> {
  const [todos, events] = await Promise.all([
    prisma.routine.count({ where: { userId } }),
    prisma.eventRoutine.count({ where: { userId } }),
  ]);
  return todos + events;
}

function refresh() {
  revalidatePath("/routines");
  revalidatePath("/");
}

export async function createEventRoutine(
  _previous: EventRoutineFormState,
  formData: FormData,
): Promise<EventRoutineFormState> {
  const user = await requireUser();
  const look = readLook(formData);
  if (typeof look === "string") return { message: look };

  const freq = FREQS.find((value) => value === readText(formData, "freq"));
  if (!freq) return { message: "반복 주기를 골라주세요." };
  const byWeekday = freq === "WEEKLY" ? readNumbers(formData, "byWeekday", 0, 6) : [];
  const byMonthday = freq === "MONTHLY" ? readNumbers(formData, "byMonthday", 1, 31) : [];
  // 요일이나 날짜를 하나도 고르지 않으면 한 번도 뜨지 않는다. 만들지 않는다.
  if (freq === "WEEKLY" && byWeekday.length === 0) return { message: "반복할 요일을 하나 이상 골라주세요." };
  if (freq === "MONTHLY" && byMonthday.length === 0) return { message: "반복할 날짜를 하나 이상 골라주세요." };

  const startDate = readDate(readText(formData, "startDate")) ?? todayIn(user.timezone);
  const endDate = readDate(readText(formData, "endDate"));
  if (endDate && endDate < startDate) return { message: "종료일이 시작일보다 앞설 수 없어요." };

  if ((await routineCount(user.id)) >= LIMITS.routines) {
    return { message: `루틴은 ${LIMITS.routines}개까지 만들 수 있어요. 안 쓰는 루틴을 지워주세요.` };
  }

  await prisma.eventRoutine.create({
    data: { userId: user.id, ...look, freq, byWeekday, byMonthday, startDate, endDate },
  });
  refresh();
  return { message: "반복 일정을 만들었어요.", ok: true };
}

export type EventRoutineEdit = { ok: true } | { ok: false; message: string };

/** 이름·색·시각을 고친다. 반복 규칙(요일·날짜·기간)은 그대로 둔다(할 일 루틴 고치기와 같다). 지난 날에도 바뀐 이름으로 보인다. */
export async function updateEventRoutine(formData: FormData): Promise<EventRoutineEdit> {
  const user = await requireUser();
  const look = readLook(formData);
  if (typeof look === "string") return { ok: false, message: look };
  const { count } = await prisma.eventRoutine.updateMany({ where: { id: readText(formData, "id"), userId: user.id }, data: look });
  if (count === 0) return { ok: false, message: "반복 일정을 찾지 못했어요. 새로 고쳐 주세요." };
  refresh();
  return { ok: true };
}

export async function toggleEventRoutinePause(formData: FormData) {
  const user = await requireUser();
  // 화면이 누른 뒤의 상태를 보낸다. 뒤집기로 처리하면 다른 탭에서 먼저 바꾼 것을 되돌린다.
  const pause = readText(formData, "paused") === "true";
  await prisma.eventRoutine.updateMany({
    where: { id: readText(formData, "id"), userId: user.id, pausedAt: pause ? null : { not: null } },
    data: { pausedAt: pause ? new Date() : null },
  });
  refresh();
}

export async function endEventRoutineToday(formData: FormData) {
  const user = await requireUser();
  await prisma.eventRoutine.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { endDate: todayIn(user.timezone) },
  });
  refresh();
}

/** 홈에서 반복 일정의 그 날 하나만 뺀다. 되돌리기는 includeEventOccurrence. */
export async function skipEventOccurrence(target: { routineId: string; date: string }): Promise<{ routineId: string; date: string } | null> {
  const user = await requireUser();
  const date = readDate(target.date);
  if (!isId(target.routineId) || !date) return null;
  const owned = await prisma.eventRoutine.findFirst({ where: { id: target.routineId, userId: user.id }, select: { id: true } });
  if (!owned) return null;
  await prisma.eventRoutineSkip.createMany({ data: [{ eventRoutineId: owned.id, date }], skipDuplicates: true });
  refresh();
  return { routineId: owned.id, date: formatKST(date) };
}

export async function includeEventOccurrence(target: { routineId: string; date: string }): Promise<void> {
  const user = await requireUser();
  const date = readDate(target.date);
  if (!isId(target.routineId) || !date) return;
  await prisma.eventRoutineSkip.deleteMany({ where: { eventRoutineId: target.routineId, date, eventRoutine: { userId: user.id } } });
  refresh();
}

/** 지운 반복 일정을 되돌릴 때 필요한 값. 날짜는 문자열로 주고받는다. */
export type DeletedEventRoutine = {
  id: string;
  title: string;
  color: string;
  startTime: number | null;
  endTime: number | null;
  freq: RoutineFreq;
  byWeekday: number[];
  byMonthday: number[];
  startDate: string;
  endDate: string | null;
  paused: boolean;
  isPublic?: boolean;
  skipDates: string[];
};

export async function deleteEventRoutine(id: string): Promise<DeletedEventRoutine | null> {
  const user = await requireUser();
  const routine = await prisma.eventRoutine.findFirst({ where: { id, userId: user.id }, include: { skips: { select: { date: true } } } });
  if (!routine) return null;
  await prisma.eventRoutine.delete({ where: { id: routine.id } });
  refresh();
  return {
    id: routine.id,
    title: routine.title,
    color: routine.color,
    startTime: routine.startTime,
    endTime: routine.endTime,
    freq: routine.freq,
    byWeekday: routine.byWeekday,
    byMonthday: routine.byMonthday,
    startDate: formatKST(routine.startDate),
    endDate: routine.endDate ? formatKST(routine.endDate) : null,
    paused: routine.pausedAt !== null,
    isPublic: routine.isPublic,
    skipDates: routine.skips.map((skip) => formatKST(skip.date)),
  };
}

/** 방금 지운 반복 일정을 되살린다. 값은 브라우저에서 오므로 그대로 믿지 않는다. */
export async function restoreEventRoutine(snapshot: DeletedEventRoutine): Promise<string | void> {
  const user = await requireUser();
  if (!isId(snapshot.id) || typeof snapshot.title !== "string") return;
  const title = snapshot.title.trim().slice(0, MAX_TITLE_LENGTH);
  const freq = FREQS.find((value) => value === snapshot.freq);
  const startDate = readDate(snapshot.startDate);
  if (!title || !freq || !startDate || !isPaletteColor(snapshot.color)) return;
  if (!Array.isArray(snapshot.byWeekday) || !Array.isArray(snapshot.byMonthday) || !Array.isArray(snapshot.skipDates)) return;
  const time = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) < 24 * 60 ? (value as number) : null);
  if ((await routineCount(user.id)) >= LIMITS.routines) return `루틴은 ${LIMITS.routines}개까지 만들 수 있어요.`;

  try {
    await prisma.eventRoutine.create({
      data: {
        id: snapshot.id,
        userId: user.id,
        title,
        color: snapshot.color,
        startTime: time(snapshot.startTime),
        endTime: time(snapshot.endTime),
        freq,
        byWeekday: snapshot.byWeekday.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        byMonthday: snapshot.byMonthday.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31),
        startDate,
        endDate: snapshot.endDate ? readDate(snapshot.endDate) : null,
        pausedAt: snapshot.paused ? new Date() : null,
        isPublic: snapshot.isPublic === true,
        skips: {
          create: snapshot.skipDates
            .slice(0, 2000)
            .flatMap((value) => {
              const date = readDate(String(value));
              return date ? [{ date }] : [];
            }),
        },
      },
    });
  } catch (error) {
    // 두 번 눌렀거나 이미 되살아난 경우.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.warn("[event-routine] 이미 되살린 반복 일정이다.", snapshot.id);
      return;
    }
    throw error;
  }
  refresh();
}
