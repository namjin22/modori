"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { DEFAULT_EVENT_COLOR } from "@/lib/colors";
import { daysBetween, formatKST, formatMonthDayKST, parseKSTDate } from "@/lib/date";
import { firstOverfullDay } from "@/lib/event-limit";
import { formatTime, parseTime } from "@/lib/event-time";
import { isId } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_TITLE_LENGTH = 100;
// 한 해를 넘는 일정은 입력 실수일 가능성이 크고, 달력에 수백 칸을 칠하게 된다.
const MAX_SPAN_DAYS = 366;

export type EventFormState = { message: string; ok?: boolean } | null;

type EventInput = {
  title: string;
  startDate: Date;
  endDate: Date;
  // 자정부터 몇 분. 비어 있으면 하루 종일(lib/event-time.ts).
  startTime: number | null;
  endTime: number | null;
  color: string;
};

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readDate(value: string): Date | null {
  if (!value) return null;
  try {
    return parseKSTDate(value);
  } catch (error) {
    console.error("[event] 날짜 형식이 잘못됐다.", error);
    return null;
  }
}

/** 폼 값을 검사한다. 문제가 있으면 사람에게 보여줄 문장을 돌려준다. */
function readEventInput(formData: FormData): EventInput | string {
  const title = readText(formData, "title").slice(0, MAX_TITLE_LENGTH);
  if (!title) return "일정 이름을 적어주세요.";

  const startDate = readDate(readText(formData, "startDate"));
  if (!startDate) return "시작일을 골라주세요.";

  // 종료일을 비우면 하루짜리 일정이다.
  const endDate = readDate(readText(formData, "endDate")) ?? startDate;
  if (daysBetween(startDate, endDate) < 0) {
    return "종료일이 시작일보다 앞설 수 없어요.";
  }
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) {
    return "일정은 1년 안으로만 잡을 수 있어요.";
  }

  const startTime = parseTime(readText(formData, "startTime"));
  const endTime = parseTime(readText(formData, "endTime"));
  if (startTime === undefined || endTime === undefined) return "시간을 다시 골라주세요.";
  if (startTime === null && endTime !== null) return "시작 시간을 먼저 정해주세요.";
  if (
    startTime !== null &&
    endTime !== null &&
    daysBetween(startDate, endDate) === 0 &&
    endTime < startTime
  ) {
    return "끝나는 시간이 시작 시간보다 앞설 수 없어요.";
  }

  // 색은 고르지 않는다. 달력에서는 일정 이름으로 알아본다.
  const color = DEFAULT_EVENT_COLOR;

  return { title, startDate, endDate, startTime, endTime, color };
}

/**
 * 기간 안의 어느 날이라도 일정이 하루 상한만큼 차 있으면 사람에게 보여줄 문장을 돌려준다.
 * 고치는 중인 일정은 자기 자신을 세지 않는다(exceptId).
 */
async function dailyLimitMessage(
  userId: string,
  input: Pick<EventInput, "startDate" | "endDate">,
  exceptId?: string,
): Promise<string | null> {
  const overlapping = await prisma.event.findMany({
    where: {
      userId,
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { startDate: true, endDate: true },
  });
  const full = firstOverfullDay(overlapping, input.startDate, input.endDate, LIMITS.eventsPerDay);
  if (!full) return null;
  return `${formatMonthDayKST(full)}에는 일정이 벌써 ${LIMITS.eventsPerDay}개예요. 하루에 ${LIMITS.eventsPerDay}개까지 둘 수 있어요.`;
}

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const input = readEventInput(formData);
  if (typeof input === "string") return { message: input };

  const count = await prisma.event.count({ where: { userId: user.id } });
  if (count >= LIMITS.events) {
    return { message: `일정은 ${LIMITS.events}개까지 만들 수 있어요. 지난 일정을 지워주세요.` };
  }
  const full = await dailyLimitMessage(user.id, input);
  if (full) return { message: full };

  await prisma.event.create({ data: { ...input, userId: user.id } });

  revalidatePath("/");
  return { message: "일정을 만들었어요.", ok: true };
}

export async function updateEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const input = readEventInput(formData);
  if (typeof input === "string") return { message: input };
  const id = readText(formData, "id");

  const full = await dailyLimitMessage(user.id, input, id);
  if (full) return { message: full };

  const { count } = await prisma.event.updateMany({
    where: { id, userId: user.id },
    data: input,
  });
  if (count === 0) return { message: "일정을 찾을 수 없어요." };

  revalidatePath("/");
  return { message: "고쳤어요.", ok: true };
}

/** 지운 일정을 되돌릴 때 필요한 값. 날짜는 문자열로 주고받는다. */
export type DeletedEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  // "HH:MM" 또는 빈 문자열(하루 종일).
  startTime: string;
  endTime: string;
  color: string;
};

export async function deleteEvent(id: string): Promise<DeletedEvent | null> {
  const user = await requireUser();

  const event = await prisma.event.findFirst({ where: { id, userId: user.id } });
  if (!event) return null;

  await prisma.event.delete({ where: { id: event.id } });
  revalidatePath("/");

  return {
    id: event.id,
    title: event.title,
    startDate: formatKST(event.startDate),
    endDate: formatKST(event.endDate),
    startTime: event.startTime === null ? "" : formatTime(event.startTime),
    endTime: event.endTime === null ? "" : formatTime(event.endTime),
    color: event.color,
  };
}

/** 방금 지운 일정을 되살린다. 값은 브라우저에서 오므로 만들 때와 같은 검사를 거친다. */
export async function restoreEvent(snapshot: DeletedEvent): Promise<string | void> {
  const user = await requireUser();
  if (!isId(snapshot.id)) return;

  const formData = new FormData();
  formData.set("title", snapshot.title);
  formData.set("startDate", snapshot.startDate);
  formData.set("endDate", snapshot.endDate);
  formData.set("color", snapshot.color);
  formData.set("startTime", typeof snapshot.startTime === "string" ? snapshot.startTime : "");
  formData.set("endTime", typeof snapshot.endTime === "string" ? snapshot.endTime : "");
  const input = readEventInput(formData);
  if (typeof input === "string") {
    console.warn("[event] 되돌릴 값이 올바르지 않다.", input);
    return;
  }

  // 되돌리기도 새로 만드는 것과 같은 상한을 지킨다.
  const count = await prisma.event.count({ where: { userId: user.id } });
  if (count >= LIMITS.events) {
    return `일정은 ${LIMITS.events}개까지 만들 수 있어요.`;
  }
  const full = await dailyLimitMessage(user.id, input);
  if (full) return full;

  try {
    await prisma.event.create({
      data: { ...input, id: snapshot.id, userId: user.id },
    });
  } catch (error) {
    // 두 번 눌렀거나 이미 되살아난 경우.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn("[event] 이미 되살린 일정이다.", snapshot.id);
      return;
    }
    throw error;
  }

  revalidatePath("/");
}

/**
 * 달력에서 일정 이름을 끌어 기간만 바꾼다(components/event-drag-grid.tsx). 이름·시간은 그대로다.
 * 못 바꾸면 사람에게 보여줄 문장을 돌려준다.
 */
export async function resizeEvent(
  id: string,
  startKey: string,
  endKey: string,
): Promise<string | void> {
  const user = await requireUser();
  if (!isId(id)) return;
  const startDate = readDate(startKey);
  const endDate = readDate(endKey);
  if (!startDate || !endDate || daysBetween(startDate, endDate) < 0) return;
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) return "일정은 1년 안으로만 잡을 수 있어요.";

  const event = await prisma.event.findFirst({
    where: { id, userId: user.id },
    select: { startTime: true, endTime: true },
  });
  if (!event) return;

  const full = await dailyLimitMessage(user.id, { startDate, endDate }, id);
  if (full) return full;

  // 하루짜리로 줄였는데 끝 시간이 시작보다 이르면(여러 날일 때는 말이 됐다) 끝 시간을 뺀다.
  const endTime =
    daysBetween(startDate, endDate) === 0 &&
    event.startTime !== null &&
    event.endTime !== null &&
    event.endTime < event.startTime
      ? null
      : event.endTime;

  await prisma.event.updateMany({
    where: { id, userId: user.id },
    data: { startDate, endDate, endTime },
  });
  revalidatePath("/");
}
