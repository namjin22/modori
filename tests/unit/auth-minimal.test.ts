import { describe, expect, it } from "vitest";

import { minimalAccount, minimalUser, withMinimalStorage } from "@/lib/auth-minimal";

describe("로그인에 필요한 것만 저장", () => {
  it("사용자 행에는 실명과 사진 주소를 넣지 않고 이메일은 남긴다", () => {
    expect(
      minimalUser({ email: "a@gsm.hs.kr", emailVerified: null, name: "홍길동", image: "https://x/y.png" }),
    ).toEqual({ email: "a@gsm.hs.kr", emailVerified: null, name: null, image: null });
  });

  it("로그인 계정에는 토큰을 넣지 않고 어느 제공자의 누구인지만 남긴다", () => {
    const saved = minimalAccount({
      userId: "u1",
      type: "oauth",
      provider: "datagsm",
      providerAccountId: "123",
      access_token: "비밀1",
      refresh_token: "비밀2",
      id_token: "비밀3",
      expires_at: 1,
      token_type: "bearer",
      scope: "profile",
    });
    expect(JSON.stringify(saved)).not.toMatch(/비밀/);
    expect(saved).toMatchObject({ userId: "u1", type: "oauth", provider: "datagsm", providerAccountId: "123" });
  });

  it("어댑터를 감싸면 저장 직전에 걸러진다", async () => {
    const calls: unknown[] = [];
    const adapter = withMinimalStorage({
      createUser: async (user) => {
        calls.push(user);
        return { ...user, id: "u1" };
      },
      linkAccount: async (account) => {
        calls.push(account);
      },
    });
    await adapter.createUser?.({ id: "x", email: "a@b.c", emailVerified: null, name: "실명" });
    await adapter.linkAccount?.({ userId: "u1", type: "oauth", provider: "google", providerAccountId: "9", access_token: "비밀" });
    expect(JSON.stringify(calls)).not.toMatch(/실명|비밀/);
  });
});
