"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { isReportReason, MAX_REPORT_DETAIL, REPORTS_PER_DAY } from "@/lib/report";
import { requireUser } from "@/lib/session";

export type SafetyResult = { ok: boolean; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 차단과 해제가 바꾸는 화면(친구 화면, 팔로우·팔로워, 소셜, 마이페이지)을 다시 그린다. */
function refreshPeople() {
  revalidatePath("/feed", "layout");
  revalidatePath("/settings", "layout");
}

/**
 * 사람을 차단한다. 서로의 팔로우와 서로 보낸 반응을 지우고, 이후 서로 찾기·추천·팔로우에 나오지 않는다.
 * 팔로우만 끊는 "팔로워 끊기"와 달리 다시 팔로우하지 못한다(해제하면 가능).
 */
export async function blockUser(targetId: string): Promise<SafetyResult> {
  const user = await requireUser();
  if (!targetId || targetId === user.id) return { ok: false, message: "차단할 수 없는 사람이에요." };
  const target = await prisma.user.findFirst({ where: { id: targetId, nickname: { not: null } }, select: { id: true } });
  if (!target) return { ok: false, message: "이미 없는 사람이에요." };

  await prisma.$transaction([
    prisma.block.createMany({ data: [{ blockerId: user.id, blockedId: target.id }], skipDuplicates: true }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.id, followingId: target.id },
          { followerId: target.id, followingId: user.id },
        ],
      },
    }),
    prisma.reaction.deleteMany({
      where: {
        OR: [
          { userId: user.id, todoUserId: target.id },
          { userId: target.id, todoUserId: user.id },
        ],
      },
    }),
  ]);
  refreshPeople();
  return { ok: true, message: "차단했어요." };
}

export async function unblockUser(targetId: string): Promise<SafetyResult> {
  const user = await requireUser();
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });
  refreshPeople();
  return { ok: true, message: "차단을 풀었어요." };
}

/**
 * 사용자를 신고한다. 운영자가 /admin/reports에서 확인한다. 같은 사람을 하루 안에 다시 신고하면 한 번만 받고(같은 말을 되풀이해
 * 운영자를 묻지 않게), 한 사람이 하루에 낼 수 있는 수에 한도를 둔다.
 */
export async function reportUser(targetId: string, reason: string, detail: string): Promise<SafetyResult> {
  const user = await requireUser();
  if (!isReportReason(reason)) return { ok: false, message: "신고 이유를 골라 주세요." };
  if (!targetId || targetId === user.id) return { ok: false, message: "신고할 수 없는 사람이에요." };
  const target = await prisma.user.findFirst({ where: { id: targetId, nickname: { not: null } }, select: { id: true } });
  if (!target) return { ok: false, message: "이미 없는 사람이에요." };

  const since = new Date(Date.now() - DAY_MS);
  const [already, today] = await Promise.all([
    prisma.report.findFirst({ where: { reporterId: user.id, reportedId: target.id, createdAt: { gte: since } }, select: { id: true } }),
    prisma.report.count({ where: { reporterId: user.id, createdAt: { gte: since } } }),
  ]);
  if (already) return { ok: true, message: "이미 신고했어요. 운영자가 확인할게요." };
  if (today >= REPORTS_PER_DAY) return { ok: false, message: "오늘은 더 신고할 수 없어요. 내일 다시 해 주세요." };

  await prisma.report.create({
    data: { reporterId: user.id, reportedId: target.id, reason, detail: detail.trim().slice(0, MAX_REPORT_DETAIL) || null },
  });
  return { ok: true, message: "신고했어요. 운영자가 확인할게요." };
}

/** 내가 차단한 사람 목록(마이페이지 > 차단한 사용자). */
export async function listBlocked() {
  const user = await requireUser();
  return prisma.block.findMany({
    where: { blockerId: user.id, blocked: { nickname: { not: null } } },
    orderBy: { createdAt: "desc" },
    select: { blocked: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } } },
  });
}
