// scripts/testflight-distribute.mjs: App Store Connect API 열쇠로 외부 테스트 그룹에 넣는 도구(2026-11-22).
// 네트워크는 쓰지 않는다. 토큰이 Apple이 요구하는 모양인지, 그룹을 잘못 고르지 않는지, 상태별로 무엇을 할지 본다.
import { generateKeyPairSync, verify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { makeToken, pickExternalGroup, stepFor } from "../../scripts/testflight-distribute.mjs";

const external = (id: string, name = "친구들") => ({ id, attributes: { name, isInternalGroup: false } });
const internal = (id: string, name = "App Store Connect 사용자") => ({ id, attributes: { name, isInternalGroup: true } });

describe("makeToken", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const now = Date.UTC(2026, 10, 22, 3, 0, 0);
  const token = makeToken({ keyId: "KEY1234567", issuerId: "issuer-uuid", privateKey: pem, now });
  const [header, payload, signature] = token.split(".");
  const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

  it("헤더는 ES256과 키 ID, 페이로드는 발급자·audience·20분 안의 만료다", () => {
    expect(decode(header)).toEqual({ alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    const body = decode(payload);
    expect(body).toMatchObject({ iss: "issuer-uuid", aud: "appstoreconnect-v1", iat: now / 1000 });
    expect(body.exp - body.iat).toBeLessThanOrEqual(20 * 60);
    expect(body.exp).toBeGreaterThan(body.iat);
  });

  it("서명은 DER이 아니라 r‖s 64바이트이고 공개 키로 확인된다", () => {
    const raw = Buffer.from(signature, "base64url");
    expect(raw.length).toBe(64);
    expect(verify("sha256", Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, raw)).toBe(true);
  });

  it("내용이 바뀌면 서명이 맞지 않는다", () => {
    const raw = Buffer.from(signature, "base64url");
    expect(verify("sha256", Buffer.from(`${header}.${payload}x`), { key: publicKey, dsaEncoding: "ieee-p1363" }, raw)).toBe(false);
  });
});

describe("pickExternalGroup", () => {
  it("외부 그룹이 하나면 그것을 고르고 내부 그룹은 무시한다", () => {
    expect(pickExternalGroup([internal("a"), external("b")]).id).toBe("b");
  });

  it("외부 그룹이 없으면 내부 그룹에 넣지 않고 멈춘다", () => {
    expect(() => pickExternalGroup([internal("a")])).toThrow("외부 테스트 그룹이 없다");
    expect(() => pickExternalGroup([])).toThrow("외부 테스트 그룹이 없다");
  });

  it("외부 그룹이 여럿이면 어느 쪽인지 모르니 이름을 보여 주며 멈춘다", () => {
    expect(() => pickExternalGroup([external("a", "하나"), external("b", "둘")])).toThrow(/외부 그룹이 2개.*하나\(외부\).*둘\(외부\)/);
  });

  it("isInternalGroup을 모르는 그룹은 외부로 치지 않는다", () => {
    expect(() => pickExternalGroup([{ id: "a", attributes: { name: "모름" } }])).toThrow("외부 테스트 그룹이 없다");
  });
});

describe("stepFor", () => {
  it("심사를 낼 수 있는 빌드는 심사부터 낸다", () => {
    expect(stepFor("READY_FOR_BETA_SUBMISSION")).toBe("submit");
  });

  it("이미 심사 중이거나 통과한 빌드는 그룹에 넣기만 한다", () => {
    for (const state of ["WAITING_FOR_BETA_REVIEW", "IN_BETA_REVIEW", "IN_EXPORT_COMPLIANCE_REVIEW", "BETA_APPROVED", "READY_FOR_BETA_TESTING", "IN_BETA_TESTING"]) {
      expect(stepFor(state)).toBe("add-only");
    }
  });

  it("처리 중이면 기다리고, 거절·만료·수출 규정 누락·모르는 값은 멈춘다", () => {
    expect(stepFor("PROCESSING")).toBe("wait");
    for (const state of ["PROCESSING_EXCEPTION", "MISSING_EXPORT_COMPLIANCE", "EXPIRED", "BETA_REJECTED", "NOT_APPLICABLE", "처음 보는 값"]) {
      expect(stepFor(state)).toBe("blocked");
    }
  });
});
