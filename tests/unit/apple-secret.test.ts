import { generateKeyPairSync, verify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { appleClientSecret } from "@/lib/apple-secret";

describe("Apple 로그인 client_secret", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("Apple이 요구하는 칸을 담고 ES256으로 서명한다", () => {
    const now = Date.UTC(2026, 9, 12);
    const token = appleClientSecret({ teamId: "TEAM123456", keyId: "KEY1234567", clientId: "site.modori.web", privateKey: pem, now });
    const [header, payload, signature] = token.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims).toMatchObject({ iss: "TEAM123456", sub: "site.modori.web", aud: "https://appleid.apple.com", iat: now / 1000 });
    // 6개월(약 183일)을 넘기면 Apple이 받지 않는다.
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(180 * 24 * 60 * 60);

    const ok = verify("sha256", Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });

  it("환경 변수에 한 줄로 적은 키(\\n)도 읽는다", () => {
    const oneLine = pem.trim().replace(/\n/g, "\\n");
    expect(() =>
      appleClientSecret({ teamId: "T", keyId: "K", clientId: "c", privateKey: oneLine }),
    ).not.toThrow();
  });
});
