"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formatKST, parseKSTDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_CONTENT_LENGTH = 200;

function readContent(formData: FormData): string {
  const raw = formData.get("content");
  return typeof raw === "string" ? raw.trim().slice(0, MAX_CONTENT_LENGTH) : "";
}

/** 브라우저에서 온 시각 문자열. 읽을 수 없으면 대신 쓸 값을 돌려준다. */
function readInstant(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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

/** 지운 할 일을 되돌릴 때 필요한 값. 날짜는 전부 문자열로 주고받는다. */
export type DeletedTodo = {
  id: string;
  content: string;
  date: string;
  done: boolean;
  doneAt: string | null;
  order: number;
  categoryId: string | null;
  routineId: string | null;
  createdAt: string;
};

/**
 * 확인창 없이 바로 지운다. 대신 지운 내용을 돌려줘서 화면이 "되돌리기"를 띄운다.
 * 루틴이 만든 할 일이면 그 날을 건너뛴다고 남긴다. 남기지 않으면 화면을 다시
 * 그리는 순간 "없으니 만든다"가 돌아서 지운 할 일이 바로 되살아난다.
 */
export async function deleteTodo(id: string): Promise<DeletedTodo | null> {
  const user = await requireUser();

  const todo = await prisma.todo.findFirst({ where: { id, userId: user.id } });
  if (!todo) return null;

  await prisma.$transaction([
    prisma.todo.delete({ where: { id: todo.id } }),
    ...(todo.routineId
      ? [
          prisma.routineSkip.createMany({
            data: [{ routineId: todo.routineId, date: todo.date }],
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath("/");

  return {
    id: todo.id,
    content: todo.content,
    date: formatKST(todo.date),
    done: todo.done,
    doneAt: todo.doneAt?.toISOString() ?? null,
    order: todo.order,
    categoryId: todo.categoryId,
    routineId: todo.routineId,
    createdAt: todo.createdAt.toISOString(),
  };
}

/**
 * 방금 지운 할 일을 되살린다. 값은 브라우저에서 오므로 그대로 믿지 않는다.
 * 카테고리와 루틴은 본인 것일 때만 다시 붙이고, 같은 id가 이미 있으면 만들지 않는다.
 * 할 일에 달려 있던 반응은 지울 때 함께 사라져서 돌아오지 않는다.
 */
export async function restoreTodo(snapshot: DeletedTodo) {
  const user = await requireUser();

  const content = snapshot.content.trim().slice(0, MAX_CONTENT_LENGTH);
  if (!content) return;

  const date = parseKSTDate(snapshot.date);

  const [category, routine] = await Promise.all([
    snapshot.categoryId
      ? prisma.category.findFirst({
          where: { id: snapshot.categoryId, userId: user.id },
          select: { id: true },
        })
      : null,
    snapshot.routineId
      ? prisma.routine.findFirst({
          where: { id: snapshot.routineId, userId: user.id },
          select: { id: true },
        })
      : null,
  ]);

  try {
    await prisma.$transaction([
      ...(routine
        ? [
            prisma.routineSkip.deleteMany({
              where: { routineId: routine.id, date },
            }),
          ]
        : []),
      prisma.todo.create({
        data: {
          id: snapshot.id,
          userId: user.id,
          content,
          date,
          done: snapshot.done,
          doneAt: snapshot.done ? readInstant(snapshot.doneAt, new Date()) : null,
          order: Number.isInteger(snapshot.order) ? snapshot.order : 0,
          categoryId: category?.id ?? null,
          routineId: routine?.id ?? null,
          createdAt: readInstant(snapshot.createdAt, new Date()),
        },
      }),
    ]);
  } catch (error) {
    // 두 번 눌렀거나 이미 되살아난 경우. 같은 할 일을 둘로 만들지 않는다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn("[todo] 이미 되살린 할 일이다.", snapshot.id);
      return;
    }
    throw error;
  }

  revalidatePath("/");
}

/**
 * 미래 날짜의 "예정" 루틴을 체크한 경우. 이때 처음으로 행을 만든다.
 * 미리 만들어두지 않는 이유는 docs/decisions.md 참고.
 */
export async function completeScheduledRoutine(formData: FormData) {
  const user = await requireUser();
  const routineId = readId(formData, "routineId");
  const date = parseKSTDate(readId(formData, "date"));

  const routine = await prisma.routine.findFirst({
    where: { id: routineId, userId: user.id },
    select: { content: true, categoryId: true },
  });
  if (!routine) return;

  const last = await prisma.todo.findFirst({
    where: { userId: user.id, date },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.todo.createMany({
    data: [
      {
        userId: user.id,
        date,
        content: routine.content,
        categoryId: routine.categoryId,
        routineId,
        order: (last?.order ?? -1) + 1,
        done: true,
        doneAt: new Date(),
      },
    ],
    // 같은 순간에 두 번 눌러도 unique 제약이 막는다.
    skipDuplicates: true,
  });

  revalidatePath("/");
}

/**
 * 드래그로 순서를 바꾼 뒤, 화면에 보이는 순서를 그대로 저장한다.
 * 화면이 카테고리별로 나뉘어 있으므로 하루치 전부가 아니라 한 묶음만 온다.
 * 그 묶음이 원래 차지하고 있던 자리(order 값)를 그대로 두고 안에서만 다시 배정한다.
 * 그래야 다른 카테고리 할 일들의 위치가 흔들리지 않는다.
 */
export async function reorderTodos(date: string, orderedIds: string[]) {
  const user = await requireUser();
  const day = parseKSTDate(date);
  if (orderedIds.length === 0) return;

  // 남의 할 일이나 다른 날짜의 id가 섞여 들어오면 전부 무시한다.
  const owned = await prisma.todo.findMany({
    where: { userId: user.id, date: day, id: { in: orderedIds } },
    select: { id: true, order: true },
  });

  if (owned.length !== orderedIds.length) return;
  if (new Set(orderedIds).size !== orderedIds.length) return;

  const slots = owned.map((todo) => todo.order).sort((a, b) => a - b);

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.todo.update({ where: { id }, data: { order: slots[index] } }),
    ),
  );

  revalidatePath("/");
}
