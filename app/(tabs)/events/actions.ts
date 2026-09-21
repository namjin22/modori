"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { DEFAULT_EVENT_COLOR } from "@/lib/colors";
import { daysBetween, formatKST, parseKSTDate } from "@/lib/date";
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

  // 색은 고르지 않는다. 달력에서는 일정 이름으로 알아본다.
  const color = DEFAULT_EVENT_COLOR;

  return { title, startDate, endDate, color };
}

export async function createEvent(
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const input = readEventInput(formData);
  if (typeof input === "string") return { message: input };

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

  const { count } = await prisma.event.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
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
    color: event.color,
  };
}

/** 방금 지운 일정을 되살린다. 값은 브라우저에서 오므로 만들 때와 같은 검사를 거친다. */
export async function restoreEvent(snapshot: DeletedEvent) {
  const user = await requireUser();

  const formData = new FormData();
  formData.set("title", snapshot.title);
  formData.set("startDate", snapshot.startDate);
  formData.set("endDate", snapshot.endDate);
  formData.set("color", snapshot.color);
  const input = readEventInput(formData);
  if (typeof input === "string") {
    console.warn("[event] 되돌릴 값이 올바르지 않다.", input);
    return;
  }

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
