"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { DEFAULT_EVENT_COLOR, isHexColor } from "@/lib/colors";
import { daysBetween, formatKST, parseKSTDate } from "@/lib/date";
import type { Translate } from "@/lib/i18n";
import { formatMonthDay } from "@/lib/i18n/format";
import { events as eventMessages } from "@/lib/i18n/messages/events";
import { getLocale, getT } from "@/lib/i18n/server";
import { firstOverfullDay } from "@/lib/event-limit";
import { formatTime, parseTime } from "@/lib/event-time";
import { isId, readIdList } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { readMemo } from "@/lib/memo";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type EventT = Translate<keyof (typeof eventMessages)["ko"] & string>;

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
  // 없으면(색 칸이 없던 예전 화면의 요청) 만들 때는 기본색, 고칠 때는 지금 색을 그대로 둔다.
  color: string | undefined;
  memo: string | null;
  dday: boolean;
  // 팔로워에게 보일지, 메모까지 보일지(2026-10-17).
  isPublic: boolean;
  memoPublic: boolean;
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
function readEventInput(formData: FormData, t: EventT): EventInput | string {
  const title = readText(formData, "title").slice(0, MAX_TITLE_LENGTH);
  if (!title) return t("titleRequired");

  const startDate = readDate(readText(formData, "startDate"));
  if (!startDate) return t("startRequired");

  // 종료일을 비우면 하루짜리 일정이다.
  const endDate = readDate(readText(formData, "endDate")) ?? startDate;
  if (daysBetween(startDate, endDate) < 0) {
    return t("endBeforeStart");
  }
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) {
    return t("withinYear");
  }

  const startTime = parseTime(readText(formData, "startTime"));
  const endTime = parseTime(readText(formData, "endTime"));
  if (startTime === undefined || endTime === undefined) return t("timeAgain");
  if (startTime === null && endTime !== null) return t("startTimeFirst");
  if (
    startTime !== null &&
    endTime !== null &&
    daysBetween(startDate, endDate) === 0 &&
    endTime < startTime
  ) {
    return t("endBeforeStartTime");
  }

  // "#rrggbb" 꼴만 받는다(100색·직접 찍기·색상 코드, 2026-10-19). 색이 아닌 글이 style로 들어가지 않게 모양을 엄격히 본다.
  const rawColor = readText(formData, "color");
  const color = rawColor && isHexColor(rawColor) ? rawColor.toLowerCase() : undefined;

  // 비우면 메모 없음. 칸이 없던 요청(예전 화면)도 메모 없음으로 둔다.
  const memo = readMemo(formData.get("memo")) ?? null;

  // 스위치가 꺼져 있으면 값이 오지 않는다.
  const dday = formData.get("dday") === "on";
  // 화면은 "비공개" 스위치다(켜면 나만 본다, 기본은 공개, 2026-10-18).
  const isPublic = formData.get("isPrivate") !== "on";
  // 일정을 숨기면 메모도 같이 숨는다(메모만 보이는 일은 없다).
  const memoPublic = isPublic && formData.get("memoPrivate") !== "on";

  return { title, startDate, endDate, startTime, endTime, color, memo, dday, isPublic, memoPublic };
}

/**
 * 기간 안의 어느 날이라도 일정이 하루 상한만큼 차 있으면 사람에게 보여줄 문장을 돌려준다.
 * 고치는 중인 일정은 자기 자신을 세지 않는다(exceptId).
 */
async function dailyLimitMessage(
  userId: string,
  input: Pick<EventInput, "startDate" | "endDate">,
  t: EventT,
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
  return t("dayFull", { date: formatMonthDay(await getLocale(), full), max: LIMITS.eventsPerDay });
}

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const t = await getT(eventMessages);
  const input = readEventInput(formData, t);
  if (typeof input === "string") return { message: input };

  const count = await prisma.event.count({ where: { userId: user.id } });
  if (count >= LIMITS.events) {
    return { message: t("tooMany", { max: LIMITS.events }) };
  }
  const full = await dailyLimitMessage(user.id, input, t);
  if (full) return { message: full };

  await prisma.event.create({ data: { ...input, color: input.color ?? DEFAULT_EVENT_COLOR, userId: user.id } });

  revalidatePath("/");
  return { message: t("created"), ok: true };
}

export async function updateEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const t = await getT(eventMessages);
  const input = readEventInput(formData, t);
  if (typeof input === "string") return { message: input };
  const id = readText(formData, "id");

  const full = await dailyLimitMessage(user.id, input, t, id);
  if (full) return { message: full };

  const { count } = await prisma.event.updateMany({
    where: { id, userId: user.id },
    data: input,
  });
  if (count === 0) return { message: t("notFound") };

  revalidatePath("/");
  return { message: t("fixed"), ok: true };
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
  memo: string | null;
  dday: boolean;
  isPublic?: boolean;
  memoPublic?: boolean;
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
    memo: event.memo,
    dday: event.dday,
    isPublic: event.isPublic,
    memoPublic: event.memoPublic,
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
  formData.set("memo", typeof snapshot.memo === "string" ? snapshot.memo : "");
  if (snapshot.dday !== false) formData.set("dday", "on");
  // 값을 모르는 예전 스냅숏은 숨긴 쪽으로 되살린다(보이던 것을 숨기는 쪽이 안전하다).
  if (snapshot.isPublic !== true) formData.set("isPrivate", "on");
  if (snapshot.memoPublic !== true) formData.set("memoPrivate", "on");
  const t = await getT(eventMessages);
  const input = readEventInput(formData, t);
  if (typeof input === "string") {
    console.warn("[event] 되돌릴 값이 올바르지 않다.", input);
    return;
  }

  // 되돌리기도 새로 만드는 것과 같은 상한을 지킨다.
  const count = await prisma.event.count({ where: { userId: user.id } });
  if (count >= LIMITS.events) {
    return t("tooManyShort", { max: LIMITS.events });
  }
  const full = await dailyLimitMessage(user.id, input, t);
  if (full) return full;

  try {
    await prisma.event.create({
      data: { ...input, color: input.color ?? DEFAULT_EVENT_COLOR, id: snapshot.id, userId: user.id },
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
  const t = await getT(eventMessages);
  if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) return t("withinYear");

  const event = await prisma.event.findFirst({
    where: { id, userId: user.id },
    select: { startTime: true, endTime: true },
  });
  if (!event) return;

  const full = await dailyLimitMessage(user.id, { startDate, endDate }, t, id);
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

const MAX_EVENT_REORDER = 100;

/**
 * 그 날 일정의 순서를 저장한다(ids는 화면에 보이는 위에서 아래 순서). 일정마다 sortOrder에 -n … -1을 차례로 준다.
 * 바꾸지 않은 일정(0)은 이들 아래로 가므로, 새로 만든 일정은 맨 아래에 붙는다. 같은 일정이 여러 날에 걸쳐 있으면 어느 날에서든
 * 바꾼 순서가 모든 날에 적용된다(일정에 순서 값이 하나뿐이다). 남의 일정이나 모르는 id가 섞여 오면 통째로 무시한다.
 */
export async function reorderEvents(ids: string[]): Promise<void> {
  const user = await requireUser();
  const orderedIds = readIdList(ids, MAX_EVENT_REORDER);
  if (!orderedIds || orderedIds.length === 0 || new Set(orderedIds).size !== orderedIds.length) return;

  const owned = await prisma.event.count({ where: { userId: user.id, id: { in: orderedIds } } });
  if (owned !== orderedIds.length) return;

  const n = orderedIds.length;
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      // 도중에 다른 탭에서 지운 일정이 있어도 나머지는 저장한다.
      prisma.event.updateMany({ where: { id, userId: user.id }, data: { sortOrder: index - n } }),
    ),
  );

  revalidatePath("/");
}

