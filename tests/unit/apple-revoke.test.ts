import { describe, expect, it } from "vitest";

import { revokeAppleToken } from "@/lib/apple-secret";
import { minimalAccount } from "@/lib/auth-minimal";

describe("Apple 연결 끊기", () => {
  it("Apple 계정만 refresh_token을 남기고 다른 토큰은 남기지 않는다", () => {
    const base = {
      userId: "u1",
      type: "oidc" as const,
      providerAccountId: "a1",
      access_token: "비밀1",
      refresh_token: "비밀2",
      id_token: "비밀3",
    };
    const apple = minimalAccount({ ...base, provider: "apple" });
    expect(apple.refresh_token).toBe("비밀2");
    expect(JSON.stringify(apple)).not.toMatch(/비밀1|비밀3/);

    const google = minimalAccount({ ...base, provider: "google" });
    expect(google.refresh_token).toBeUndefined();
    expect(JSON.stringify(google)).not.toMatch(/비밀/);
  });

  it("Apple의 철회 주소에 form 형식으로 보내고, 성공 여부를 돌려준다", async () => {
    const seen: { url: string; body: string; type: string }[] = [];
    const reply = (status: number): typeof fetch =>
      (async (url, init) => {
        seen.push({
          url: String(url),
          body: String((init?.body as URLSearchParams).toString()),
          type: String((init?.headers as Record<string, string>)["content-type"]),
        });
        return new Response("", { status });
      }) as typeof fetch;

    expect(await revokeAppleToken("rt", { clientId: "site.modori.web", clientSecret: "jwt" }, reply(200))).toBe(true);
    expect(seen[0].url).toBe("https://appleid.apple.com/auth/revoke");
    expect(seen[0].type).toBe("application/x-www-form-urlencoded");
    expect(new URLSearchParams(seen[0].body).get("token_type_hint")).toBe("refresh_token");
    expect(new URLSearchParams(seen[0].body).get("client_id")).toBe("site.modori.web");
    expect(await revokeAppleToken("rt", { clientId: "x", clientSecret: "y" }, reply(400))).toBe(false);
  });
});
