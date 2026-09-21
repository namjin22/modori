import { cache } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
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
    // createdAt은 루틴을 과거 어디까지 만들지, lastSeenAt은 안 읽은 반응을
    // 세는 데 쓴다.
    select: {
      id: true,
      nickname: true,
      profileImage: true,
      bio: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
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
