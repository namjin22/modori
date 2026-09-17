"use server";

import { revalidatePath } from "next/cache";

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
  if (!name || !color) return;

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

export async function updateCategory(formData: FormData) {
  const user = await requireUser();
  const id = readText(formData, "id");
  const name = readText(formData, "name").slice(0, MAX_NAME_LENGTH);
  const color = readColor(formData);
  if (!name || !color) return;

  await prisma.category.updateMany({
    where: { id, userId: user.id },
    data: { name, color, isPublic: formData.get("isPublic") === "on" },
  });

  revalidatePath("/categories");
  revalidatePath("/");
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
