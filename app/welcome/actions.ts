"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * 사용법 카드를 끝내거나 건너뛰었다고 적는다(2026-11-16). 이미 적힌 사람은 시각을 덮어쓰지 않는다:
 * 설정의 "사용법 다시 보기"를 또 끝내도 처음 끝낸 시각이 남는다.
 */
export async function finishTutorial(): Promise<void> {
  const user = await requireUser();
  await prisma.user.updateMany({ where: { id: user.id, tutorialSeenAt: null }, data: { tutorialSeenAt: new Date() } });
  // 홈이 "아직 안 봤으면 /welcome으로 보낸다"를 이 값으로 정하므로, 옛 화면 기록이 남지 않게 한다.
  revalidatePath("/");
}
