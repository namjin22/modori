// 웹 푸시 전송(lib/web-push.ts). 실제 브라우저 푸시 서버 없이 "없는 구독은 지운다"와 구독 검사를 본다.
import { WebPushError } from "web-push";
import { describe, expect, it, vi } from "vitest";

import { readSubscription, sendToWebSubscriptions, vapidFromEnv, type VapidConfig } from "@/lib/web-push";

const vapid: VapidConfig = { subject: "https://modori.site", publicKey: "pub", privateKey: "priv" };
const message = { title: "반응이 왔어요", body: "도리님이 내 할 일에 반응을 보냈어요", url: "/feed/reactions", tag: "reaction:t1" };
const row = (endpoint: string) => ({ endpoint, p256dh: "B".repeat(87), auth: "A".repeat(22) });
const pushError = (status: number) => new WebPushError("push failed", status, {}, "", "https://push.example/x");
const sent = { statusCode: 201, body: "", headers: {} };

describe("vapidFromEnv", () => {
  it("공개·비밀 열쇠가 둘 다 있어야 보낸다", () => {
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "a" })).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: " a ", VAPID_PRIVATE_KEY: "b" })).toEqual({
      subject: "https://modori.site",
      publicKey: "a",
      privateKey: "b",
    });
  });
});

describe("sendToWebSubscriptions", () => {
  it("알림 문구·주소·tag를 보낼 내용으로 넘기고, 하루가 지나면 버리게 한다", async () => {
    const send = vi.fn().mockResolvedValue(sent);
    await sendToWebSubscriptions([row("https://push.example/a")], message, vapid, send);
    const [subscription, payload, options] = send.mock.calls[0];
    expect(subscription).toEqual({ endpoint: "https://push.example/a", keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } });
    expect(JSON.parse(payload)).toEqual(message);
    expect(options).toMatchObject({ vapidDetails: vapid, TTL: 86_400 });
  });

  it("푸시 서버가 404·410(없는 구독)이라고 하면 돌려주고, 다른 오류는 남겨 둔다", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi
      .fn()
      .mockRejectedValueOnce(pushError(410))
      .mockRejectedValueOnce(pushError(500))
      .mockRejectedValueOnce(pushError(404))
      .mockResolvedValueOnce(sent);
    const gone = await sendToWebSubscriptions(
      ["a", "b", "c", "d"].map((name) => row(`https://push.example/${name}`)),
      message,
      vapid,
      send,
    );
    expect(gone).toEqual(["https://push.example/a", "https://push.example/c"]);
    expect(send).toHaveBeenCalledTimes(4);
    expect(errorLog).toHaveBeenCalledWith("[web-push] 알림을 보내지 못했다.", 500);
    errorLog.mockRestore();
  });
});

describe("readSubscription", () => {
  const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } };

  it("https 주소와 base64url 열쇠만 받는다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readSubscription(good)).toEqual({ endpoint: good.endpoint, p256dh: "B".repeat(87), auth: "A".repeat(22) });
    expect(readSubscription({ ...good, endpoint: "http://push.example/a" })).toBeNull();
    expect(readSubscription({ ...good, endpoint: "javascript:alert(1)" })).toBeNull();
    expect(readSubscription({ ...good, endpoint: "not a url" })).toBeNull();
    expect(readSubscription({ ...good, endpoint: `https://push.example/${"x".repeat(1100)}` })).toBeNull();
    expect(readSubscription({ ...good, keys: { ...good.keys, p256dh: "<script>".repeat(11) } })).toBeNull();
    expect(readSubscription({ ...good, keys: { ...good.keys, auth: "short" } })).toBeNull();
    expect(readSubscription(null)).toBeNull();
    warn.mockRestore();
  });
});
