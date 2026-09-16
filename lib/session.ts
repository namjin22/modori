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
    // createdAt은 루틴을 과거 어디까지 만들지 정하는 데 쓴다.
    select: { id: true, nickname: true, profileEmoji: true, createdAt: true },
  });

  // 세션은 남아 있는데 계정이 지워진 경우 (테스트에서 실제로 생긴다)
  if (!user) redirect("/login");
  if (!user.nickname) redirect("/onboarding");

  return { ...user, nickname: user.nickname };
});
