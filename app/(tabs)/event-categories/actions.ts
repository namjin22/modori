"use server";

import { revalidatePath } from "next/cache";

import { isHexColor } from "@/lib/colors";
import { events as eventMessages } from "@/lib/i18n/messages/events";
import { getT } from "@/lib/i18n/server";
import { isId, readIdList } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// "내 색" = 이름 붙은 색(2026-11-25 운영자 요청, docs/decisions.md). 2026-11-26부터 색 고르기의 + 로 만들고 일정·반복 일정·일반 카테고리가 같이 쓴다.
// 일정과 반복 일정은 id로 잇고, 일반 카테고리(app/(tabs)/categories)는 색만 복사해 쓴다. 표는 EventCategory 하나다.

const MAX_NAME_LENGTH = 20;
// 되돌리기 스냅숏의 id 목록 상한. 한 카테고리에 일정이 이만큼 붙을 수는 없다(일정 상한이 1000개다).
const MAX_SNAPSHOT_IDS = 1000;

export type NamedColor = { id: string; name: string; color: string };
export type NamedColorResult = { ok: true; category: NamedColor } | { ok: false; message: string };
export type EventCategoryUpdate = { ok: true } | { ok: false; message: string };

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readColor(formData: FormData): string | null {
  const color = readText(formData, "color");
  return isHexColor(color) ? color.toLowerCase() : null;
}

/** 이름이 같은지는 대소문자를 가리지 않고 본다. 같은 이름이 둘이면 칩에서 구별이 안 된다. */
function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function refresh() {
  revalidatePath("/event-categories");
  // 내 색 목록은 탭 화면 전체의 레이아웃이 들고 있다(색 고르기가 어느 화면에서나 쓴다). 레이아웃까지 다시 받게 한다.
  revalidatePath("/", "layout");
}

/** 색 고르기의 +가 부른다. 이름과 색을 받아 내 색을 하나 만들고, 화면이 바로 칸으로 붙일 수 있게 만든 것을 돌려준다. */
export async function createNamedColor(rawName: string, rawColor: string): Promise<NamedColorResult> {
  const user = await requireUser();
  const t = await getT(eventMessages);
  const name = typeof rawName === "string" ? rawName.trim().slice(0, MAX_NAME_LENGTH) : "";
  const color = isHexColor(rawColor) ? rawColor.toLowerCase() : null;
  if (!name) return { ok: false, message: t("ecNameRequired") };
  if (!color) return { ok: false, message: t("ecColorRequired") };

  const existing = await prisma.eventCategory.findMany({ where: { userId: user.id }, select: { name: true, order: true } });
  if (existing.length >= LIMITS.eventCategories) return { ok: false, message: t("ecTooMany", { max: LIMITS.eventCategories }) };
  if (existing.some((row) => sameName(row.name, name))) return { ok: false, message: t("ecDuplicate") };

  const last = existing.reduce((max, row) => Math.max(max, row.order), -1);
  const category = await prisma.eventCategory.create({
    data: { userId: user.id, name, color, order: last + 1 },
    select: { id: true, name: true, color: true },
  });

  refresh();
  return { ok: true, category };
}

/**
 * 고치는 창이 고를 때마다 부른다. 저장하지 못했으면 이유를 돌려준다.
 * 색을 바꾸면 이 색을 쓰는 일정과 반복 일정의 색도 따라 바뀐다. 다만 이미 다른 색으로 바꿔 둔 것(AI 연결 등으로)은 그대로 둔다.
 * 일반 카테고리는 색을 복사해 쓸 뿐이라 따라가지 않는다.
 */
export async function updateEventCategory(formData: FormData): Promise<EventCategoryUpdate> {
  const user = await requireUser();
  const t = await getT(eventMessages);
  const id = readText(formData, "id");
  const name = readText(formData, "name").slice(0, MAX_NAME_LENGTH);
  const color = readColor(formData);
  if (!name) return { ok: false, message: t("ecNameRequired") };
  if (!color) return { ok: false, message: t("ecColorRequired") };
  if (!isId(id)) return { ok: false, message: t("ecNotFound") };

  const current = await prisma.eventCategory.findFirst({ where: { id, userId: user.id }, select: { color: true } });
  if (!current) return { ok: false, message: t("ecNotFound") };

  const others = await prisma.eventCategory.findMany({ where: { userId: user.id, id: { not: id } }, select: { name: true } });
  if (others.some((row) => sameName(row.name, name))) return { ok: false, message: t("ecDuplicate") };

  await prisma.$transaction([
    prisma.eventCategory.updateMany({ where: { id, userId: user.id }, data: { name, color } }),
    prisma.event.updateMany({ where: { userId: user.id, categoryId: id, color: current.color }, data: { color } }),
    prisma.eventRoutine.updateMany({ where: { userId: user.id, categoryId: id, color: current.color }, data: { color } }),
  ]);

  refresh();
  return { ok: true };
}

export type DeletedEventCategory = {
  id: string;
  name: string;
  color: string;
  order: number;
  // 지울 때 이 색에 붙어 있던 일정과 반복 일정. 되돌릴 때 다시 잇는다.
  eventIds: string[];
  routineIds: string[];
};

/** 색만 지운다. 붙어 있던 일정과 반복 일정은 색을 그대로 둔 채 이름만 떨어진다(onDelete: SetNull). */
export async function deleteEventCategory(id: string): Promise<DeletedEventCategory | null> {
  const user = await requireUser();
  if (!isId(id)) return null;

  const category = await prisma.eventCategory.findFirst({
    where: { id, userId: user.id },
    include: { events: { select: { id: true } }, eventRoutines: { select: { id: true } } },
  });
  if (!category) return null;

  await prisma.eventCategory.delete({ where: { id: category.id } });

  refresh();
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    order: category.order,
    eventIds: category.events.map((event) => event.id),
    routineIds: category.eventRoutines.map((routine) => routine.id),
  };
}

/** 방금 지운 카테고리를 되살리고, 붙어 있던 일정을 다시 잇는다. 값은 브라우저에서 오므로 그대로 믿지 않는다. */
export async function undoDeleteEventCategory(snapshot: DeletedEventCategory): Promise<string | void> {
  const user = await requireUser();

  if (!isId(snapshot.id) || typeof snapshot.name !== "string") return;
  const name = snapshot.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name || !isHexColor(snapshot.color)) return;
  const eventIds = readIdList(snapshot.eventIds, MAX_SNAPSHOT_IDS);
  const routineIds = readIdList(snapshot.routineIds ?? [], MAX_SNAPSHOT_IDS);
  if (!eventIds || !routineIds) return;

  const exists = await prisma.eventCategory.findUnique({ where: { id: snapshot.id }, select: { id: true } });
  if (exists) return;

  // 되돌리기도 새로 만드는 것과 같은 상한을 지킨다.
  const count = await prisma.eventCategory.count({ where: { userId: user.id } });
  if (count >= LIMITS.eventCategories) {
    return (await getT(eventMessages))("ecTooMany", { max: LIMITS.eventCategories });
  }

  await prisma.$transaction([
    prisma.eventCategory.create({
      data: { id: snapshot.id, userId: user.id, name, color: snapshot.color.toLowerCase(), order: Math.trunc(snapshot.order) || 0 },
    }),
    // 그 사이 다른 카테고리를 고른 일정은 건드리지 않는다.
    prisma.event.updateMany({ where: { id: { in: eventIds }, userId: user.id, categoryId: null }, data: { categoryId: snapshot.id } }),
    prisma.eventRoutine.updateMany({ where: { id: { in: routineIds }, userId: user.id, categoryId: null }, data: { categoryId: snapshot.id } }),
  ]);

  refresh();
}

/** 끌어 바꾼 순서를 그대로 저장한다. 일정 만들기 창의 칩도 이 순서를 따른다. 남의 id나 모자란 목록은 통째로 무시한다. */
export async function reorderEventCategories(ids: string[]) {
  const user = await requireUser();
  const orderedIds = readIdList(ids, LIMITS.eventCategories);
  if (!orderedIds || new Set(orderedIds).size !== orderedIds.length) return;

  const owned = await prisma.eventCategory.findMany({ where: { userId: user.id }, select: { id: true } });
  const ownedIds = new Set(owned.map((category) => category.id));
  if (owned.length !== orderedIds.length || !orderedIds.every((id) => ownedIds.has(id))) return;

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.eventCategory.updateMany({ where: { id, userId: user.id }, data: { order: index } })),
  );

  refresh();
}
