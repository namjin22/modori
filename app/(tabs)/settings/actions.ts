"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAllowedTimezone } from "@/lib/timezones";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/** 친구 찾기의 추천 목록에 내가 나오지 않게 할지(true면 숨김). */
export async function setHideFromRecommend(hidden: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { hideFromRecommend: hidden === true } });
  revalidatePath("/settings");
  revalidatePath("/feed/search");
}

/**
 * 이 사람의 "오늘"을 정하는 시간대를 바꾼다. 목록(lib/timezones.ts)에 있는 값만 받는다.
 * 모든 화면의 오늘·루틴·달력이 이 기준으로 다시 그려지도록 전체 화면 캐시를 비운다.
 */
export async function setTimezone(timezone: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isAllowedTimezone(timezone)) return { ok: false };
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  revalidatePath("/", "layout");
  return { ok: true };
}
