import { revokeAppleToken } from "@/lib/apple-secret";
import { appleRevokeSecret } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 계정을 지우기 전에 이 사람의 Apple 로그인 연결을 끊는다(App Store 심사 지침 5.1.1(v): Apple로 로그인한 계정을 지울 때는
 * 토큰도 철회해야 한다). 실패해도 계정 지우기는 막지 않는다. 사용자가 지우겠다고 했으면 지워야 하고, 연결은 Apple 계정 설정에서도 끊을 수 있다.
 */
export async function revokeAppleAccounts(userId: string): Promise<void> {
  const clientId = process.env.AUTH_APPLE_ID;
  if (!appleRevokeSecret || !clientId) return;

  const accounts = await prisma.account.findMany({
    where: { userId, provider: "apple", refresh_token: { not: null } },
    select: { refresh_token: true },
  });
  for (const account of accounts) {
    if (!account.refresh_token) continue;
    try {
      const ok = await revokeAppleToken(account.refresh_token, { clientId, clientSecret: appleRevokeSecret });
      if (!ok) console.error("[apple] 연결을 끊지 못했다(Apple이 거절했다).");
    } catch (error) {
      console.error("[apple] 연결을 끊지 못했다.", error instanceof Error ? error.message : error);
    }
  }
}
