"use server";

import { revalidatePath } from "next/cache";

import { isPaletteColor } from "@/lib/colors";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_NAME_LENGTH = 20;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readColor(formData: FormData): string | null {
  const color = readText(formData, "color");
  return HEX_COLOR.test(color) ? color.toLowerCase() : null;
}

export async function createCategory(formData: FormData) {
  const user = await requireUser();
  const name = readText(formData, "name").slice(0, MAX_NAME_LENGTH);
  const color = readColor(formData);
  // 새로 만들 때는 팔레트 색만 받는다. 아무 색이나 받으면 흰 배경에서 안 보이는
  // 연한 색이나 글씨와 겹치는 색이 섞여 들어온다.
  if (!name || !color || !isPaletteColor(color)) return;

  const last = await prisma.category.findFirst({
    where: { userId: user.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.category.create({
    data: { userId: user.id, name, color, order: (last?.order ?? -1) + 1 },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}

export type CategoryUpdate = { ok: true } | { ok: false; message: string };

/**
 * 고치는 창이 고를 때마다 부른다. 저장하지 못했으면 이유를 돌려준다.
 * 그러지 않으면 이름을 비운 채 색을 바꿨을 때 화면은 "저장했어요"라고 하는데
 * 실제로는 아무것도 바뀌지 않는다.
 */
export async function updateCategory(formData: FormData): Promise<CategoryUpdate> {
  const user = await requireUser();
  const id = readText(formData, "id");
  const name = readText(formData, "name").slice(0, MAX_NAME_LENGTH);
  const color = readColor(formData);
  if (!name) return { ok: false, message: "이름을 적어주세요" };
  if (!color) return { ok: false, message: "색을 골라주세요" };

  const current = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { color: true },
  });
  if (!current) return { ok: false, message: "카테고리를 찾지 못했어요" };

  // 팔레트 색이거나, 예전에 고른 색을 그대로 두는 경우만 받는다.
  if (!isPaletteColor(color) && color !== current.color.toLowerCase()) {
    return { ok: false, message: "색을 골라주세요" };
  }

  await prisma.category.updateMany({
    where: { id, userId: user.id },
    data: { name, color, isPublic: formData.get("isPublic") === "on" },
  });

  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true };
}

export type DeletedCategory = {
  id: string;
  name: string;
  color: string;
  isPublic: boolean;
  order: number;
  todoIds: string[];
  routineIds: string[];
  // 지울 때 멈춘 루틴. 되돌릴 때 이것만 다시 켠다. 원래 멈춰 있던 루틴은 그대로 둔다.
  pausedRoutineIds: string[];
};

/**
 * 카테고리만 지운다. 그 안의 할 일은 "카테고리 없음"으로 남는다. 지난 기록과
 * 받은 반응, 통계가 카테고리 하나 지웠다고 사라지면 안 된다.
 * 그 카테고리의 루틴은 멈춘다. 카테고리 없이 계속 돌면 적을 수 없는 칸에 쌓인다.
 * 되돌리기에 쓸 수 있게 무엇이 이어져 있었는지 돌려준다.
 */
export async function deleteCategory(id: string): Promise<DeletedCategory | null> {
  const user = await requireUser();

  const category = await prisma.category.findFirst({
    where: { id, userId: user.id },
    include: {
      todos: { select: { id: true } },
      routines: { select: { id: true, pausedAt: true } },
    },
  });
  if (!category) return null;

  const toPause = category.routines.filter((routine) => !routine.pausedAt);
  await prisma.$transaction([
    prisma.routine.updateMany({
      where: { id: { in: toPause.map((routine) => routine.id) }, userId: user.id },
      data: { pausedAt: new Date() },
    }),
    // 할 일과 루틴의 연결은 onDelete: SetNull이 끊는다.
    prisma.category.delete({ where: { id: category.id } }),
  ]);

  revalidatePath("/categories");
  revalidatePath("/routines");
  revalidatePath("/");

  return {
    id: category.id,
    name: category.name,
    color: category.color,
    isPublic: category.isPublic,
    order: category.order,
    todoIds: category.todos.map((todo) => todo.id),
    routineIds: category.routines.map((routine) => routine.id),
    pausedRoutineIds: toPause.map((routine) => routine.id),
  };
}

/** 방금 지운 카테고리를 되살리고, 남겨 둔 할 일과 루틴을 다시 잇는다. */
export async function undoDeleteCategory(snapshot: DeletedCategory) {
  const user = await requireUser();

  // 브라우저에서 돌아온 값이라 그대로 믿지 않는다.
  const name = snapshot.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name || !HEX_COLOR.test(snapshot.color)) return;

  const exists = await prisma.category.findUnique({
    where: { id: snapshot.id },
    select: { id: true },
  });
  if (exists) return;

  await prisma.$transaction([
    prisma.category.create({
      data: {
        id: snapshot.id,
        userId: user.id,
        name,
        color: snapshot.color.toLowerCase(),
        isPublic: snapshot.isPublic,
        order: Math.trunc(snapshot.order) || 0,
      },
    }),
    // 그 사이 다른 카테고리로 옮긴 것은 건드리지 않는다.
    prisma.todo.updateMany({
      where: { id: { in: snapshot.todoIds }, userId: user.id, categoryId: null },
      data: { categoryId: snapshot.id },
    }),
    prisma.routine.updateMany({
      where: { id: { in: snapshot.routineIds }, userId: user.id, categoryId: null },
      data: { categoryId: snapshot.id },
    }),
    prisma.routine.updateMany({
      where: { id: { in: snapshot.pausedRoutineIds }, userId: user.id },
      data: { pausedAt: null },
    }),
  ]);

  revalidatePath("/categories");
  revalidatePath("/routines");
  revalidatePath("/");
}

// 삭제가 생기기 전에 보관한 카테고리를 되살린다. 새로 보관하는 길은 없다.
export async function restoreCategory(formData: FormData) {
  const user = await requireUser();

  await prisma.category.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { archivedAt: null },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}
