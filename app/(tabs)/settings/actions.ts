"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

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
