"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formatKST, parseKSTDate } from "@/lib/date";
import { GOAL_TITLE_MAX } from "@/lib/goals";
import { goals as goalMessages } from "@/lib/i18n/messages/goals";
import { getT } from "@/lib/i18n/server";
import { isId } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * 목표(2026-11-19 운영자 결정, docs/decisions.md)의 서버 동작. 2단계: 목표(parentId 없음)와 세부 목표(parentId 있음).
 * 달성은 직접 체크한다. 세부 목표가 있는 목표는 달성 여부를 칸에 저장하지 않는다(세부 목표를 더하면 비운다).
 * 브라우저가 보낸 값은 믿지 않고 여기서 다시 검사하며, 남의 것은 where에 userId를 걸어 건드리지 못한다.
 */
export type GoalFormState = { message: string; ok?: boolean } | null;

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

/** 기한은 선택이다: 비우면 없음, 날짜가 아니면 읽지 못한 것이다. 할 일 날짜 범위(10년)와 달리 먼 날짜도 받는다. */
function readDue(value: string): { ok: true; date: Date | null } | { ok: false } {
  if (!value) return { ok: true, date: null };
  try {
    return { ok: true, date: parseKSTDate(value) };
  } catch (error) {
    console.warn("[goal] 기한 날짜를 읽지 못했다.", error instanceof Error ? error.name : error);
    return { ok: false };
  }
}

export async function createGoal(_previous: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const t = await getT(goalMessages);
  const title = readText(formData, "title").slice(0, GOAL_TITLE_MAX);
  if (!title) return { message: t("titleRequired") };
  const due = readDue(readText(formData, "dueDate"));
  if (!due.ok) return { message: t("dueInvalid") };
  // 화면은 "비공개" 스위치다(켜면 나만 본다, 기본은 공개, 2026-11-19).
  const isPublic = formData.get("isPrivate") !== "on";

  const count = await prisma.goal.count({ where: { userId: user.id, parentId: null } });
  if (count >= LIMITS.goals) return { message: t("tooMany", { max: LIMITS.goals }) };

  await prisma.goal.create({ data: { userId: user.id, title, dueDate: due.date, isPublic } });
  revalidatePath("/");
  return { message: t("created"), ok: true };
}

export async function updateGoal(_previous: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const t = await getT(goalMessages);
  const title = readText(formData, "title").slice(0, GOAL_TITLE_MAX);
  if (!title) return { message: t("titleRequired") };
  const due = readDue(readText(formData, "dueDate"));
  if (!due.ok) return { message: t("dueInvalid") };
  const isPublic = formData.get("isPrivate") !== "on";
  const id = readText(formData, "id");
  if (!isId(id)) return { message: t("notFound") };

  // 세부 목표는 상위 목표의 공개 여부를 따르므로 이 폼은 목표(parentId 없음)만 고친다.
  const { count } = await prisma.goal.updateMany({ where: { id, userId: user.id, parentId: null }, data: { title, dueDate: due.date, isPublic } });
  if (count === 0) return { message: t("notFound") };

  revalidatePath("/");
  return { message: t("fixed"), ok: true };
}

/** 지운 목표를 되돌릴 때 필요한 값(세부 목표 포함). 시각은 밀리초 숫자, 날짜는 문자열로 주고받는다. */
export type DeletedGoal = {
  id: string;
  title: string;
  dueDate: string | null;
  doneAt: number | null;
  isPublic: boolean;
  children: { id: string; title: string; doneAt: number | null }[];
};

export async function deleteGoal(id: string): Promise<DeletedGoal | null> {
  const user = await requireUser();
  if (!isId(id)) return null;

  const goal = await prisma.goal.findFirst({
    where: { id, userId: user.id, parentId: null },
    include: { children: { orderBy: { createdAt: "asc" } } },
  });
  if (!goal) return null;

  // 세부 목표는 외래키(ON DELETE CASCADE)로 함께 지워진다.
  await prisma.goal.delete({ where: { id: goal.id } });
  revalidatePath("/");

  return {
    id: goal.id,
    title: goal.title,
    dueDate: goal.dueDate ? formatKST(goal.dueDate) : null,
    doneAt: goal.doneAt?.getTime() ?? null,
    isPublic: goal.isPublic,
    children: goal.children.map((child) => ({ id: child.id, title: child.title, doneAt: child.doneAt?.getTime() ?? null })),
  };
}

function readInstant(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 방금 지운 목표를 되살린다. 값은 브라우저에서 오므로 만들 때와 같은 검사를 거친다. */
export async function restoreGoal(snapshot: DeletedGoal): Promise<string | void> {
  const user = await requireUser();
  const t = await getT(goalMessages);
  if (!isId(snapshot.id) || typeof snapshot.title !== "string") return;
  const title = snapshot.title.trim().slice(0, GOAL_TITLE_MAX);
  if (!title) return;
  const due = readDue(typeof snapshot.dueDate === "string" ? snapshot.dueDate : "");
  if (!due.ok) return;
  const children = (Array.isArray(snapshot.children) ? snapshot.children : [])
    .filter((child) => isId(child.id) && typeof child.title === "string" && child.title.trim() !== "")
    .slice(0, LIMITS.subGoalsPerGoal);

  const count = await prisma.goal.count({ where: { userId: user.id, parentId: null } });
  if (count >= LIMITS.goals) return t("tooMany", { max: LIMITS.goals });

  try {
    await prisma.goal.create({
      data: {
        id: snapshot.id,
        userId: user.id,
        title,
        dueDate: due.date,
        // 세부 목표가 있는 목표의 달성은 칸에 저장하지 않는다.
        doneAt: children.length > 0 ? null : readInstant(snapshot.doneAt),
        // 값을 모르는 스냅숏은 숨긴 쪽으로 되살린다(보이던 것을 숨기는 쪽이 안전하다).
        isPublic: snapshot.isPublic === true,
        children: {
          create: children.map((child) => ({
            id: child.id,
            userId: user.id,
            title: child.title.trim().slice(0, GOAL_TITLE_MAX),
            doneAt: readInstant(child.doneAt),
          })),
        },
      },
    });
  } catch (error) {
    // 두 번 눌렀거나 이미 되살아난 경우.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.warn("[goal] 이미 되살린 목표다.", snapshot.id);
      return;
    }
    throw error;
  }

  revalidatePath("/");
}

/** 세부 목표를 더한다. 못 더하면 사람에게 보여줄 문장을 돌려준다. 첫 세부 목표를 더하면 목표 자신의 달성 표시는 비운다(이제 세부 목표를 센 값이다). */
export async function addSubGoal(goalId: string, title: string): Promise<string | void> {
  const user = await requireUser();
  const t = await getT(goalMessages);
  const clean = typeof title === "string" ? title.trim().slice(0, GOAL_TITLE_MAX) : "";
  if (!clean) return t("titleRequired");
  if (!isId(goalId)) return t("notFound");

  const parent = await prisma.goal.findFirst({
    where: { id: goalId, userId: user.id, parentId: null },
    select: { id: true, _count: { select: { children: true } } },
  });
  if (!parent) return t("notFound");
  if (parent._count.children >= LIMITS.subGoalsPerGoal) return t("subTooMany", { max: LIMITS.subGoalsPerGoal });

  await prisma.$transaction([
    prisma.goal.create({ data: { userId: user.id, parentId: parent.id, title: clean } }),
    prisma.goal.update({ where: { id: parent.id }, data: { doneAt: null } }),
  ]);
  revalidatePath("/");
}

export async function deleteSubGoal(id: string): Promise<void> {
  const user = await requireUser();
  if (!isId(id)) return;
  await prisma.goal.deleteMany({ where: { id, userId: user.id, parentId: { not: null } } });
  revalidatePath("/");
}

/**
 * 달성 표시를 켜고 끈다. 세부 목표이거나 세부 목표가 없는 목표만 직접 체크한다.
 * 세부 목표가 있는 목표는 where에서 빠져 아무 일도 하지 않는다(세부 목표를 센 값으로 보이기 때문이다).
 */
export async function setGoalDone(id: string, done: boolean): Promise<void> {
  const user = await requireUser();
  if (!isId(id)) return;
  await prisma.goal.updateMany({
    where: { id, userId: user.id, children: { none: {} } },
    data: { doneAt: done === true ? new Date() : null },
  });
  revalidatePath("/");
}
