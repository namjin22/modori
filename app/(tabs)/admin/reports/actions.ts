"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { revokeAppleAccounts } from "@/lib/apple-revoke";
import { isAdmin } from "@/lib/admin";
import { normalizeNickname } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();
  return user;
}

/** 신고를 확인했다고 표시한다(같은 사람에 대한 열린 신고를 한꺼번에). */
export async function handleReport(formData: FormData) {
  await requireAdmin();
  const reportedId = String(formData.get("reportedId") ?? "");
  if (!reportedId) return;
  await prisma.report.updateMany({ where: { reportedId, handledAt: null }, data: { handledAt: new Date() } });
  revalidatePath("/admin/reports");
  revalidatePath("/settings");
}

/**
 * 문제가 확인된 계정을 지운다. 되돌릴 수 없어서 닉네임을 그대로 입력해야 한다. 운영자 본인은 지우지 않는다.
 * 계정에 딸린 기록(그 사람에 대한 신고 포함)이 함께 지워진다.
 */
export async function deleteReportedAccount(formData: FormData) {
  const admin = await requireAdmin();
  const reportedId = String(formData.get("reportedId") ?? "");
  if (!reportedId || reportedId === admin.id) return;

  const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true, nickname: true } });
  if (!target) return;
  if (normalizeNickname(formData.get("confirm")) !== target.nickname) return;

  await revokeAppleAccounts(target.id);
  await prisma.user.delete({ where: { id: target.id } });
  console.warn("[admin] 신고된 계정을 지웠다.", { id: target.id });
  revalidatePath("/admin/reports");
  revalidatePath("/settings");
}
