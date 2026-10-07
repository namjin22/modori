import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** 검색하기 전에 보여 주는 추천 인원. */
export const RECOMMEND_COUNT = 3;

/**
 * 아직 팔로우하지 않은 사람 가운데 무작위 몇 명(기본 세 명). 나, 마이페이지에서 추천을 끈 사람은 뺀다.
 * 같은 seed면 같은 사람이 나와서(seed와 id로 섞는다), 팔로우한 직후 화면을 다시 그려도 나머지가 바뀌지 않는다.
 */
export async function recommendPeople(userId: string, seed: string, limit = RECOMMEND_COUNT) {
  const picked = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT u."id" FROM "User" u
    WHERE u."nickname" IS NOT NULL AND u."id" <> ${userId} AND u."hideFromRecommend" = false
      AND NOT EXISTS (SELECT 1 FROM "Follow" f WHERE f."followerId" = ${userId} AND f."followingId" = u."id")
    ORDER BY md5(u."id" || ${seed})
    LIMIT ${limit}`);
  if (picked.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: picked.map((row) => row.id) } },
    select: { id: true, nickname: true, profileImage: true, avatarCharacter: true },
  });
  // 뽑힌 차례를 지킨다.
  return picked.flatMap((row) => rows.filter((person) => person.id === row.id));
}
