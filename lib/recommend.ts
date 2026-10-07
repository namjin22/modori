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

/**
 * 추천을 섞는 값. 주소의 r이 모양에 맞으면 그것을, 아니면(처음 연 화면) 새로 뽑는다. 모양이 이상한 값은 버려
 * 낯선 글이 질의에 들어가지 않게 한다(값은 md5의 재료일 뿐이다).
 */
export function recommendSeed(raw: string | undefined): string {
  return raw && /^[a-z0-9]{1,12}$/.test(raw) ? raw : newSeed();
}

/** 요청마다 달라야 해서 서버에서 새로 뽑는다. */
function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
