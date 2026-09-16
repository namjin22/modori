import { cache } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 레이아웃과 페이지가 같은 요청에서 각각 호출해도 DB는 한 번만 본다.
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    // createdAt은 루틴을 과거 어디까지 만들지, lastSeenAt은 안 읽은 반응을
    // 세는 데 쓴다.
    select: {
      id: true,
      nickname: true,
      profileEmoji: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  // 세션은 남아 있는데 계정이 지워진 경우 (테스트에서 실제로 생긴다)
  if (!user) redirect("/login");
  if (!user.nickname) redirect("/onboarding");

  return { ...user, nickname: user.nickname };
});

/**
 * 안 읽은 반응 수. 하단 탭의 뱃지와 피드 화면이 같은 값을 쓰는데,
 * cache()로 감싸두면 한 요청 안에서 두 번 부르더라도 질의는 한 번만 나간다.
 */
export const countUnreadReactions = cache(async (userId: string, since: Date) => {
  return prisma.reaction.count({
    where: {
      todo: { userId },
      userId: { not: userId },
      createdAt: { gt: since },
    },
  });
});
