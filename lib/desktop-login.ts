import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * 데스크톱 앱 로그인.
 *
 * Google은 앱 안에 끼운 브라우저(Electron 창)에서의 로그인을 막는다. 그래서 로그인은 평소 쓰는
 * 브라우저에서 하고, 모도리 서버가 한 번 쓰는 코드를 만들어 `modori://login?code=`로 앱에 넘긴다.
 * 앱은 처음에 만든 비밀값(verifier)과 코드를 함께 보내 세션을 받는다(PKCE, RFC 7636).
 * 다른 프로그램이 `modori://` 주소를 가로채도 verifier가 없으면 코드를 쓸 수 없다.
 */

/** 코드가 살아 있는 시간. 브라우저에서 앱으로 넘어오는 데 몇 초면 된다. */
const CODE_TTL_MS = 2 * 60 * 1000;

/** SHA-256을 base64url로. challenge = S256(verifier). */
export function challengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** RFC 7636: 43~128자, 영문·숫자와 -._~. S256 challenge는 늘 43자다. */
export function isVerifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

export function isChallenge(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** 브라우저에서 로그인한 사람에게 코드를 발급한다. 지난 코드는 이때 같이 치운다. */
export async function issueDesktopCode(userId: string, challenge: string): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await prisma.desktopLogin.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.desktopLogin.create({
    data: {
      codeHash: hashCode(code),
      challenge,
      userId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * 코드를 쓰고 누구의 코드였는지 돌려준다. 틀렸거나 지났거나 이미 썼으면 null.
 * 먼저 지워서, 같은 코드를 두 번 보내도 한 번만 통한다(verifier가 틀려도 코드는 버린다).
 */
export async function redeemDesktopCode(code: string, verifier: string): Promise<string | null> {
  if (typeof code !== "string" || code.length === 0 || code.length > 100 || !isVerifier(verifier)) {
    return null;
  }
  const codeHash = hashCode(code);
  const found = await prisma.desktopLogin.findUnique({ where: { codeHash } });
  if (!found) return null;
  const { count } = await prisma.desktopLogin.deleteMany({ where: { id: found.id } });
  if (count === 0 || found.expiresAt.getTime() < Date.now()) return null;

  const expected = Buffer.from(found.challenge);
  const actual = Buffer.from(challengeOf(verifier));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return found.userId;
}
