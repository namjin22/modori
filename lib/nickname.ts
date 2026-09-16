import { prisma } from "@/lib/prisma";

export const MAX_NICKNAME_LENGTH = 20;

// 공백만 다른 이름은 같은 이름으로 본다. "모 도리"와 "모도리"는 다르게 두되,
// 앞뒤 공백과 연속 공백은 정리한다.
export function normalizeNickname(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

// 문구는 화면마다 다르다. 처음 만드는 온보딩에서는 길이 규칙을 알려주고,
// 이미 쓰던 이름을 고치는 프로필에서는 비었다는 사실만 짚어준다.
export type NicknameProblem = "empty" | "tooLong";

export function validateNickname(
  nickname: string,
): { ok: true } | { ok: false; problem: NicknameProblem } {
  if (nickname.length === 0) return { ok: false, problem: "empty" };
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return { ok: false, problem: "tooLong" };
  }
  return { ok: true };
}

/**
 * DB 제약은 대소문자를 구분하므로 "Modori"와 "modori"가 둘 다 들어갈 수 있다.
 * 사람 눈에는 같은 이름이라 여기서 한 번 더 막는다.
 * 동시 요청으로 빠져나가는 경우는 unique 제약이 잡는다(P2002).
 */
export async function isNicknameTaken(
  nickname: string,
  exceptUserId?: string,
): Promise<boolean> {
  const owner = await prisma.user.findFirst({
    where: {
      nickname: { equals: nickname, mode: "insensitive" },
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });

  return owner !== null;
}
