import { cache } from "react";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginHref, safeNext } from "@/lib/next-path";

import { auth } from "@/lib/auth";
import { runDailyOnce } from "@/lib/daily";
import { recordActiveDay } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

/**
 * 지금 로그인한 계정. 세션이 없거나, 세션이 가리키는 계정 행이 없으면 null.
 *
 * "로그인되어 있다"의 기준은 반드시 이 함수 하나로 판단한다. 로그인 화면은
 * 세션만 보고 "/"로 보내고 탭 화면은 계정 행까지 보고 로그인 화면으로 보내면,
 * 계정이 사라진 세션에서 둘이 서로를 끝없이 튕겨낸다(ERR_TOO_MANY_REDIRECTS).
 * 레이아웃과 페이지가 같은 요청에서 각각 불러도 DB는 한 번만 본다.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return prisma.user.findUnique({
    where: { id },
    // createdAt은 루틴을 과거 어디까지 만들지, lastSeenAt은 안 읽은 알림을
    // 세는 데 쓴다.
    select: {
      id: true,
      nickname: true,
      profileImage: true, avatarCharacter: true, hideFromRecommend: true,
      bio: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user || !user.nickname) {
    // 친구가 보낸 링크처럼 로그인 전에 연 화면으로 로그인 뒤 돌아가게 한다(proxy.ts가 주소를 넘긴다).
    const next = safeNext((await headers()).get("x-modori-path"));
    if (!user) redirect(loginHref(next));
    redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  }

  // 활성 사용자·재방문율을 세려고 오늘 쓴 것을 적는다(docs/metrics.md). 하루 한 번만 DB에 쓴다.
  await runDailyOnce();
  await recordActiveDay(user.id);
  return { ...user, nickname: user.nickname };
});

/**
 * 안 읽은 알림 수(받은 반응 + 나를 새로 팔로우한 사람). 하단 탭의 뱃지와 소셜 화면이 같은 값을 쓰는데,
 * cache()로 감싸두면 한 요청 안에서 두 번 부르더라도 질의는 한 번만 나간다.
 */
export const countUnreadNotifications = cache(async (userId: string, since: Date) => {
  const [reactions, follows] = await Promise.all([
    prisma.reaction.count({
      where: {
        todoUserId: userId,
        userId: { not: userId },
        createdAt: { gt: since },
      },
    }),
    prisma.follow.count({ where: { followingId: userId, createdAt: { gt: since } } }),
  ]);
  return reactions + follows;
});
