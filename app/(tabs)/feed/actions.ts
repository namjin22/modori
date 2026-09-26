"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : "";
}

export async function followUser(formData: FormData) {
  const user = await requireUser();
  const targetId = readText(formData, "targetId");

  // 자기 자신은 팔로우하지 않는다.
  if (!targetId || targetId === user.id) return;

  const target = await prisma.user.findFirst({
    where: { id: targetId, nickname: { not: null } },
    select: { id: true },
  });
  if (!target) return;

  await prisma.follow.createMany({
    data: [{ followerId: user.id, followingId: target.id }],
    skipDuplicates: true,
  });

  revalidatePath("/feed");
  revalidatePath("/feed/search");
}

export async function unfollowUser(formData: FormData) {
  const user = await requireUser();

  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: readText(formData, "targetId") },
  });

  revalidatePath("/feed");
  revalidatePath("/feed/search");
}

export async function toggleReaction(formData: FormData) {
  const user = await requireUser();
  const todoId = readText(formData, "todoId");
  const emoji = readText(formData, "emoji");

  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) return;

  // 피드에서 볼 수 있는 할 일에만 반응할 수 있다.
  // 팔로우한 사람의, 완료된, 공개 카테고리 할 일.
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      done: true,
      category: { isPublic: true },
      user: { followers: { some: { followerId: user.id } } },
    },
    select: { id: true, userId: true },
  });
  if (!todo) return;

  const existing = await prisma.reaction.findFirst({
    where: { userId: user.id, todoId, emoji },
    select: { id: true },
  });

  try {
    if (existing) {
      await prisma.reaction.deleteMany({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({
        data: { userId: user.id, todoId, todoUserId: todo.userId, emoji },
      });
    }
  } catch (error) {
    // 같은 순간에 두 번 눌러 먼저 온 요청이 이미 만들었다. 결과는 같으니 넘긴다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.warn("[reaction] 이미 남긴 반응이다.", todoId, emoji);
    } else {
      throw error;
    }
  }

  // 반응 수는 피드와 친구 화면 양쪽에 보인다. /feed 아래를 통째로 다시 그린다.
  revalidatePath("/feed", "layout");
}
