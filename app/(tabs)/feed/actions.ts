"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { notBlockedWith } from "@/lib/blocks";
import { FRIEND_ROW_SIZE, friendOrderValues } from "@/lib/friend-row";
import { readIdList } from "@/lib/ids";
import { followNotice, reactionNotice } from "@/lib/notices";
import { prisma } from "@/lib/prisma";
import { sendPushToUser, shouldNotify } from "@/lib/push";
import { isReactionValue } from "@/lib/reactions";
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

  // 차단한 사람·나를 차단한 사람은 팔로우할 수 없다(notBlockedWith).
  const target = await prisma.user.findFirst({
    where: { id: targetId, nickname: { not: null }, ...notBlockedWith(user.id) },
    select: { id: true },
  });
  if (!target) return;

  // 새 친구는 친구 줄의 맨 앞에 둔다: 지금 가장 작은 순서보다 하나 작게(lib/friend-row.ts). 손으로 줄을 바꿔 둔 사람에게도 새 친구가 줄 뒤로 숨지 않는다.
  const first = await prisma.follow.aggregate({ where: { followerId: user.id }, _min: { sortOrder: true } });
  const created = await prisma.follow.createMany({
    data: [{ followerId: user.id, followingId: target.id, sortOrder: Math.min(0, first._min.sortOrder ?? 0) - 1 }],
    skipDuplicates: true,
  });
  // 새로 팔로우했을 때만 알린다. 응답은 알림을 보내는 것을 기다리지 않는다.
  if (created.count > 0 && shouldNotify(`follow:${user.id}:${target.id}`)) {
    after(() =>
      sendPushToUser(target.id, (locale) => ({
        ...followNotice(locale, user.nickname),
        url: "/feed/followers",
        tag: `follow:${user.id}`,
      })),
    );
  }

  // 친구 화면과 친구의 팔로우·팔로워 목록(/feed/u/…)까지 다시 그린다.
  revalidatePath("/feed", "layout");
  revalidatePath("/feed/search");
  revalidatePath("/feed/followers");
  revalidatePath("/settings");
}

export async function unfollowUser(formData: FormData) {
  const user = await requireUser();

  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: readText(formData, "targetId") },
  });

  // 친구 화면과 친구의 팔로우·팔로워 목록(/feed/u/…)까지 다시 그린다.
  revalidatePath("/feed", "layout");
  revalidatePath("/feed/search");
  revalidatePath("/feed/followers");
  revalidatePath("/settings");
}

/**
 * 나를 팔로우하는 사람을 끊는다. 그 사람은 더 이상 내 할 일을 보지 못하고 반응도 보낼 수 없다.
 * 다시 팔로우하는 것은 막지 않는다(차단이 아니다). 이미 받은 반응은 남는다.
 */
export async function removeFollower(formData: FormData) {
  const user = await requireUser();
  const followerId = readText(formData, "followerId");
  if (!followerId) return;

  await prisma.follow.deleteMany({
    where: { followerId, followingId: user.id },
  });

  revalidatePath("/feed/followers");
  revalidatePath("/settings");
}

export async function toggleReaction(formData: FormData) {
  const user = await requireUser();
  const todoId = readText(formData, "todoId");
  const emoji = readText(formData, "emoji");

  if (!isReactionValue(emoji)) return;

  // 내가 이미 보낸 반응은 언팔로우·비공개 전환 뒤에도 취소할 수 있어야 한다. 새로 보내는 것만 아래 검사를 거친다.
  const mineAlready = await prisma.reaction.findFirst({
    where: { userId: user.id, todoId, emoji },
    select: { id: true },
  });
  if (mineAlready) {
    await prisma.reaction.deleteMany({ where: { id: mineAlready.id } });
    revalidatePath("/feed", "layout");
    return;
  }

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
      // 같은 할 일에 이 사람의 첫 반응일 때만 알린다. 반응을 껐다 켜며 알림이 쌓이지 않게 한다.
      const mine = await prisma.reaction.count({ where: { userId: user.id, todoId } });
      if (mine === 1 && shouldNotify(`reaction:${user.id}:${todo.userId}`)) {
        after(() =>
          sendPushToUser(todo.userId, (locale) => ({
            ...reactionNotice(locale, user.nickname),
            url: "/feed/reactions",
            tag: `reaction:${todoId}`,
          })),
        );
      }
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

/**
 * 알림 화면이 뜬 뒤 브라우저가 부른다(components/notifications-seen.tsx). 읽은 시각은 화면을 그릴 때 이미 남겼고,
 * 여기서는 탭 공통 레이아웃을 다시 그리게 하는 것이 목적이다. 알림 수는 레이아웃이 세는데, 링크로 오갈 때 Next는
 * 레이아웃을 다시 그리지 않아 알림을 봐도 아래 탭의 숫자가 남아 있었다.
 *
 * 화면을 그리다 갱신이 실패했을 때를 위해 한 번 더 남긴다. 기준은 화면을 그린 시각이고, 뒤로 돌리지 않는다.
 */
export async function markNotificationsSeen(renderedAt: string) {
  const user = await requireUser();
  const at = new Date(renderedAt);
  if (Number.isNaN(at.getTime())) return;
  const seenAt = at.getTime() > Date.now() ? new Date() : at;

  await prisma.user.updateMany({
    where: { id: user.id, lastSeenAt: { lt: seenAt } },
    data: { lastSeenAt: seenAt },
  });
  revalidatePath("/", "layout");
}

/**
 * 소셜 위쪽 친구 줄에서 끌어 바꾼 순서를 저장한다(ids는 화면에 보이는 왼쪽에서 오른쪽 순서, 2026-10-26 요청).
 * 보이는 친구들에게만 가장 작은 순서 아래의 값을 차례로 준다(lib/friend-row.ts). 내가 팔로우하지 않은 사람이나 같은 사람이
 * 두 번 섞여 오면 통째로 무시한다.
 */
export async function reorderFriends(ids: string[]): Promise<void> {
  const user = await requireUser();
  const orderedIds = readIdList(ids, FRIEND_ROW_SIZE);
  if (!orderedIds || orderedIds.length === 0 || new Set(orderedIds).size !== orderedIds.length) return;

  const owned = await prisma.follow.count({ where: { followerId: user.id, followingId: { in: orderedIds } } });
  if (owned !== orderedIds.length) return;

  const lowest = await prisma.follow.aggregate({ where: { followerId: user.id }, _min: { sortOrder: true } });
  const values = friendOrderValues(orderedIds.length, Math.min(0, lowest._min.sortOrder ?? 0));
  await prisma.$transaction(
    orderedIds.map((followingId, index) =>
      // 도중에 언팔로우한 사람이 있어도 나머지는 저장한다.
      prisma.follow.updateMany({ where: { followerId: user.id, followingId }, data: { sortOrder: values[index] } }),
    ),
  );

  revalidatePath("/feed");
}

