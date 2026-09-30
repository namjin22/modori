// 푸시 알림 전송(lib/push.ts). 서명·요청 모양·"없는 번호는 지운다"를 실제 Google 없이 확인한다.
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildFcmBody,
  createAssertion,
  parseServiceAccount,
  resetPushCache,
  sendToTokens,
  type ServiceAccount,
} from "@/lib/push";
import { safePushPath } from "@/lib/push-client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account: ServiceAccount = { project_id: "demo-project", client_email: "push@demo.iam.gserviceaccount.com", private_key: privateKey };
const message = { title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요", url: "/feed/reactions", tag: "reaction:t1" };

beforeEach(() => resetPushCache());

describe("parseServiceAccount", () => {
  const json = JSON.stringify(account);

  it("JSON 그대로도, base64로 감싼 것도 읽는다", () => {
    expect(parseServiceAccount(json)?.project_id).toBe("demo-project");
    expect(parseServiceAccount(Buffer.from(json).toString("base64"))?.client_email).toBe(account.client_email);
  });

  it("없거나 필드가 모자라거나 깨졌으면 null이라 알림을 보내지 않는다", () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ project_id: "x" }))).toBeNull();
    expect(parseServiceAccount("{깨짐")).toBeNull();
  });
});

describe("createAssertion", () => {
  it("서비스 계정 비밀 키로 서명한 JWT를 만든다", () => {
    const jwt = createAssertion(account, 1_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000,
      exp: 4_600,
    });
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(createPublicKey(publicKey), Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });
});

describe("buildFcmBody", () => {
  it("알림 문구와 눌렀을 때 열 주소, 묶음 표시(tag)를 담는다", () => {
    expect(buildFcmBody("tok", message)).toEqual({
      message: {
        token: "tok",
        notification: { title: message.title, body: message.body },
        data: { url: "/feed/reactions" },
        android: { priority: "HIGH", notification: { tag: "reaction:t1" } },
      },
    });
  });

  it("tag가 없으면 묶음 표시를 넣지 않는다", () => {
    const { tag: _tag, ...noTag } = message;
    void _tag;
    expect(buildFcmBody("tok", noTag).message.android.notification).toEqual({});
  });
});

describe("sendToTokens", () => {
  function fakeFetch(sendStatus: (token: string) => { status: number; body?: string }) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "ACCESS", expires_in: 3600 }), { status: 200 });
      }
      const token = JSON.parse(String(init?.body)).message.token as string;
      const { status, body = "" } = sendStatus(token);
      return new Response(body, { status });
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it("토큰 하나마다 FCM에 보내고 액세스 토큰은 한 번만 받는다", async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200 }));
    const gone = await sendToTokens(["a", "b"], message, account, impl, 0);
    expect(gone).toEqual([]);
    expect(calls.filter((call) => call.url.includes("oauth2")).length).toBe(1);
    const sends = calls.filter((call) => call.url.includes("fcm.googleapis.com"));
    expect(sends.map((call) => call.url)).toEqual(Array(2).fill("https://fcm.googleapis.com/v1/projects/demo-project/messages:send"));
    expect((sends[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer ACCESS");
  });

  it("Google이 없는 번호라고 답한 것만 돌려준다(일시 오류는 번호를 남긴다)", async () => {
    const { impl } = fakeFetch((token) =>
      token === "old" ? { status: 404, body: '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}' } : token === "flaky" ? { status: 503, body: "later" } : { status: 200 },
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gone = await sendToTokens(["ok", "old", "flaky"], message, account, impl, 0);
    expect(gone).toEqual(["old"]);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("보낼 번호가 없으면 Google을 부르지 않는다", async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200 }));
    expect(await sendToTokens([], message, account, impl, 0)).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("safePushPath", () => {
  it("모도리 안의 경로만 연다", () => {
    expect(safePushPath("/feed/reactions")).toBe("/feed/reactions");
    expect(safePushPath("https://evil.example")).toBeNull();
    expect(safePushPath("//evil.example")).toBeNull();
    expect(safePushPath("/\\evil.example")).toBeNull();
    expect(safePushPath(undefined)).toBeNull();
  });
});
