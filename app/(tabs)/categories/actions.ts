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

// 지우지 않고 보관한다. 지나간 기록에서 색이 사라지면 안 된다.
export async function archiveCategory(formData: FormData) {
  const user = await requireUser();

  await prisma.category.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}

export async function restoreCategory(formData: FormData) {
  const user = await requireUser();

  await prisma.category.updateMany({
    where: { id: readText(formData, "id"), userId: user.id },
    data: { archivedAt: null },
  });

  revalidatePath("/categories");
  revalidatePath("/");
}

export async function moveCategory(formData: FormData) {
  const user = await requireUser();
  const id = readText(formData, "id");
  const direction = readText(formData, "direction");

  const category = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { id: true, order: true },
  });
  if (!category) return;

  const neighbor = await prisma.category.findFirst({
    where: {
      userId: user.id,
      archivedAt: null,
      order: direction === "up" ? { lt: category.order } : { gt: category.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.category.update({
      where: { id: category.id },
      data: { order: neighbor.order },
    }),
    prisma.category.update({
      where: { id: neighbor.id },
      data: { order: category.order },
    }),
  ]);

  revalidatePath("/categories");
  revalidatePath("/");
}
