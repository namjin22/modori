"use server";

import { revalidatePath } from "next/cache";

import { parseKSTDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_CONTENT_LENGTH = 200;

function readContent(formData: FormData): string {
  const raw = formData.get("content");
  return typeof raw === "string" ? raw.trim().slice(0, MAX_CONTENT_LENGTH) : "";
}

function readId(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : "";
}

export async function addTodo(formData: FormData) {
  const user = await requireUser();
  const content = readContent(formData);
  if (!content) return;

  const date = parseKSTDate(readId(formData, "date"));
  const categoryId = readId(formData, "categoryId") || null;

  // 남의 카테고리 id를 끼워 넣어도 붙지 않게 한다.
  if (categoryId) {
    const owned = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return;
  }

  const last = await prisma.todo.findFirst({
    where: { userId: user.id, date },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.todo.create({
    data: {
      userId: user.id,
      content,
      date,
      categoryId,
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath("/");
}

export async function toggleTodo(formData: FormData) {
  const user = await requireUser();
  const id = readId(formData, "id");

  const todo = await prisma.todo.findFirst({
    where: { id, userId: user.id },
    select: { done: true },
  });
  if (!todo) return;

  await prisma.todo.update({
    where: { id },
    // 완료 시각은 캘린더와 피드가 쓰므로 같이 기록한다.
    data: { done: !todo.done, doneAt: todo.done ? null : new Date() },
  });

  revalidatePath("/");
}

export async function updateTodo(formData: FormData) {
  const user = await requireUser();
  const id = readId(formData, "id");
  const content = readContent(formData);
  if (!content) return;

  const categoryId = readId(formData, "categoryId") || null;
  if (categoryId) {
    const owned = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return;
  }

  await prisma.todo.updateMany({
    where: { id, userId: user.id },
    data: { content, categoryId },
  });

  revalidatePath("/");
}

export async function deleteTodo(formData: FormData) {
  const user = await requireUser();

  await prisma.todo.deleteMany({
    where: { id: readId(formData, "id"), userId: user.id },
  });

  revalidatePath("/");
}

export async function moveTodo(formData: FormData) {
  const user = await requireUser();
  const id = readId(formData, "id");
  const direction = readId(formData, "direction");

  const todo = await prisma.todo.findFirst({
    where: { id, userId: user.id },
    select: { id: true, date: true, order: true },
  });
  if (!todo) return;

  // 바로 옆 항목과 order 값을 맞바꾼다. 전체를 다시 매기지 않아도 된다.
  const neighbor = await prisma.todo.findFirst({
    where: {
      userId: user.id,
      date: todo.date,
      order: direction === "up" ? { lt: todo.order } : { gt: todo.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.todo.update({ where: { id: todo.id }, data: { order: neighbor.order } }),
    prisma.todo.update({ where: { id: neighbor.id }, data: { order: todo.order } }),
  ]);

  revalidatePath("/");
}
