// iOS 푸시(lib/apns.ts). 서명·요청 모양·"없는 번호는 돌려준다"를 실제 Apple 없이 확인한다.
import { generateKeyPairSync, verify } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  APNS_TOPIC,
  apnsConfigFromEnv,
  buildApnsHeaders,
  buildApnsPayload,
  createApnsToken,
  isGoneResponse,
  resetApnsCache,
  sendToApns,
  type ApnsConfig,
  type ApnsSend,
} from "@/lib/apns";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const config: ApnsConfig = { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem };
const message = { title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요", url: "/feed/reactions", tag: "reaction:t1" };

beforeEach(() => resetApnsCache());

describe("apnsConfigFromEnv", () => {
  it("Apple 로그인 키 값을 그대로 쓰고, APNS_* 가 있으면 그것이 먼저다", () => {
    expect(apnsConfigFromEnv({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: "P" })).toEqual({
      teamId: "T",
      keyId: "K",
      privateKey: "P",
    });
    expect(
      apnsConfigFromEnv({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: "P", APNS_KEY_ID: "K2", APNS_PRIVATE_KEY: "P2" }),
    ).toEqual({ teamId: "T", keyId: "K2", privateKey: "P2" });
  });

  it("하나라도 없으면 보내지 않는다", () => {
    expect(apnsConfigFromEnv({})).toBeNull();
    expect(apnsConfigFromEnv({ APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K" })).toBeNull();
  });
});

describe("서명 토큰", () => {
  it("ES256으로 서명되고 팀 ID·키 ID·발급 시각만 담는다", () => {
    const token = createApnsToken(config, 1_800_000_000);
    const [header, claims, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_800_000_000 });
    const ok = verify("sha256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });
});

describe("요청 모양", () => {
  it("본문은 알림 문구와 눌렀을 때 열 주소를 담는다", () => {
    expect(buildApnsPayload(message)).toEqual({
      aps: { alert: { title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요" }, sound: "default" },
      url: "/feed/reactions",
    });
  });

  it("머리에 번호·앱 번들 ID·묶음 ID가 들어간다", () => {
    const headers = buildApnsHeaders("abcd", "jwt", message);
    expect(headers[":path"]).toBe("/3/device/abcd");
    expect(headers.authorization).toBe("bearer jwt");
    expect(headers["apns-topic"]).toBe(APNS_TOPIC);
    expect(headers["apns-push-type"]).toBe("alert");
    expect(headers["apns-collapse-id"]).toBe("reaction:t1");
    expect(buildApnsHeaders("abcd", "jwt", { ...message, tag: undefined })["apns-collapse-id"]).toBeUndefined();
    // 묶음 ID는 64바이트까지.
    expect(buildApnsHeaders("abcd", "jwt", { ...message, tag: "x".repeat(100) })["apns-collapse-id"]).toHaveLength(64);
  });
});

describe("더는 쓸 수 없는 번호", () => {
  it("410과 번호가 틀렸다는 400만 지운다", () => {
    expect(isGoneResponse(410, "Unregistered")).toBe(true);
    expect(isGoneResponse(400, "BadDeviceToken")).toBe(true);
    expect(isGoneResponse(400, "DeviceTokenNotForTopic")).toBe(true);
    expect(isGoneResponse(400, "PayloadEmpty")).toBe(false);
    expect(isGoneResponse(429, "TooManyRequests")).toBe(false);
    expect(isGoneResponse(500, "InternalServerError")).toBe(false);
  });

  it("sendToApns는 없는 번호만 돌려주고, 일시 오류는 번호를 남긴다", async () => {
    const calls: Record<string, string>[] = [];
    const send: ApnsSend = async (headers) => {
      calls.push(headers);
      if (headers[":path"].endsWith("/ok")) return { status: 200 };
      if (headers[":path"].endsWith("/gone")) return { status: 410, reason: "Unregistered" };
      return { status: 503, reason: "ServiceUnavailable" };
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gone = await sendToApns(["ok", "gone", "later"], message, config, (run) => run(send));
    expect(gone).toEqual(["gone"]);
    expect(calls).toHaveLength(3);
    // 같은 서명 토큰을 모든 요청에 쓴다.
    expect(new Set(calls.map((headers) => headers.authorization)).size).toBe(1);
    error.mockRestore();
  });

  it("번호가 없으면 Apple에 연결하지 않는다", async () => {
    const open = vi.fn();
    expect(await sendToApns([], message, config, open)).toEqual([]);
    expect(open).not.toHaveBeenCalled();
  });
});
