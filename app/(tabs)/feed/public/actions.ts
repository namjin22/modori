"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { isAdmin } from "@/lib/admin";
import { todayIn } from "@/lib/date";
import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { canSeePublicFeed, visiblePostsWhere } from "@/lib/public-feed";
import { MAX_POST_BODY, POSTS_PER_DAY } from "@/lib/public-feed-limits";
import { PHOTO_POSTS_PER_DAY, parsePostPhoto } from "@/lib/post-photo";
import { isReactionValue } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

export type PostFormState = { message: string; ok?: boolean } | null;

/** 오늘 끝낸 할 일 하나와 짧은 글(과 사진 한 장, 있으면)을 공개 피드에 올린다. 할 일의 글자·색은 올린 때의 것을 적어 둔다. */
export async function createPost(_previous: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await requireUser();
  if (!(await canSeePublicFeed(user.id))) return { message: "아직 열리지 않은 기능이에요." };

  const todoId = formData.get("todoId");
  if (typeof todoId !== "string" || !isId(todoId)) return { message: "오늘 끝낸 할 일을 하나 골라 주세요." };
  const raw = formData.get("body");
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length > MAX_POST_BODY) return { message: `글은 ${MAX_POST_BODY}자까지 쓸 수 있어요.` };

  // 사진은 없어도 된다. 있으면 브라우저가 줄여 보낸 JPEG data URL이고, 서버가 다시 검사한다.
  const rawPhoto = formData.get("photo");
  const photoValue = typeof rawPhoto === "string" ? rawPhoto : "";
  if (formData.get("photoBusy")) return { message: "사진을 줄이는 중이에요. 잠깐 뒤에 올려 주세요." };
  const photo = photoValue ? parsePostPhoto(photoValue) : null;
  if (photoValue && !photo) return { message: "사진을 올리지 못했어요. 다른 사진으로 해 보세요." };

  const todo = await prisma.todo.findFirst({
    where: { id: todoId, userId: user.id, done: true, date: todayIn(user.timezone) },
    select: { content: true, color: true, category: { select: { color: true } } },
  });
  if (!todo) return { message: "오늘 끝낸 할 일만 올릴 수 있어요." };

  const recent = await prisma.post.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  if (recent >= POSTS_PER_DAY) return { message: `하루에 ${POSTS_PER_DAY}개까지 올릴 수 있어요.` };

  if (photo) {
    const withPhoto = await prisma.post.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, photo: { isNot: null } },
    });
    if (withPhoto >= PHOTO_POSTS_PER_DAY) return { message: `사진은 하루에 ${PHOTO_POSTS_PER_DAY}개 글까지 붙일 수 있어요.` };
  }

  await prisma.post.create({
    data: {
      userId: user.id,
      todoContent: todo.content,
      todoColor: todo.color ?? todo.category?.color ?? null,
      body,
      ...(photo && { photo: { create: photo } }),
    },
  });
  revalidatePath("/feed/public");
  return { message: "피드에 올렸어요.", ok: true };
}

/** 내 글을 지운다. 반응도 같이 지워진다. */
export async function deletePost(postId: string): Promise<void> {
  const user = await requireUser();
  if (!isId(postId)) return;
  await prisma.post.deleteMany({ where: { id: postId, userId: user.id } });
  revalidatePath("/feed/public");
}

/** 피드 글에 이모지 반응을 보내거나 취소한다. 볼 수 있는 글에만. */
export async function togglePostReaction(postId: string, emoji: string): Promise<void> {
  const user = await requireUser();
  if (!isId(postId) || !isReactionValue(emoji)) return;
  const post = await prisma.post.findFirst({ where: { id: postId, ...visiblePostsWhere(user.id) }, select: { id: true } });
  if (!post) return;

  const mine = await prisma.postReaction.findFirst({ where: { postId, userId: user.id, emoji }, select: { id: true } });
  if (mine) {
    await prisma.postReaction.deleteMany({ where: { id: mine.id } });
  } else {
    try {
      await prisma.postReaction.create({ data: { postId, userId: user.id, emoji } });
    } catch (error) {
      // 같은 순간에 두 번 눌러 먼저 온 요청이 이미 만들었다. 결과는 같다.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      console.warn("[post] 이미 남긴 반응이다.", postId, emoji);
    }
  }
  revalidatePath("/feed/public");
}

/** 운영자가 신고된 글을 숨긴다. 숨긴 글은 아무에게도 보이지 않는다. */
export async function hidePost(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) return;
  const postId = formData.get("postId");
  if (typeof postId !== "string" || !isId(postId)) return;
  await prisma.post.updateMany({ where: { id: postId, hiddenAt: null }, data: { hiddenAt: new Date() } });
  await prisma.report.updateMany({ where: { postId, handledAt: null }, data: { handledAt: new Date() } });
  revalidatePath("/feed/public");
  revalidatePath("/admin/reports");
}
