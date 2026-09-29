import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

import { proxy } from "@/proxy";
import { resetRateLimits } from "@/lib/rate-limit";
import { generateSignedSessionToken, isSignedSessionToken } from "@/lib/signed-session-token";

const SECRET = "rate-limit-test-secret";
const IP = "198.51.100.42";
const COOKIE = "authjs.session-token";

function request(token?: string, ip = IP): NextRequest {
  return new NextRequest("http://localhost/login", {
    headers: { "cf-connecting-ip": ip, ...(token ? { cookie: `${COOKIE}=${token}` } : {}) },
  });
}

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("AUTH_MODE", "");
  vi.spyOn(Date, "now").mockReturnValue(Date.now());
  resetRateLimits();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("proxy rate-limit identity", () => {
  it("rotating forged session cookies shares one anonymous IP bucket", async () => {
    for (let i = 0; i < 300; i += 1) {
      expect((await proxy(request(`forged-${i}`))).status).not.toBe(429);
    }
    expect((await proxy(request("another-forgery"))).status).toBe(429);
  });

  it("signed database sessions have separate buckets", async () => {
    const a = generateSignedSessionToken(SECRET);
    const b = generateSignedSessionToken(SECRET);
    for (let i = 0; i < 60; i += 1) {
      expect((await proxy(request(a))).status).not.toBe(429);
    }
    expect((await proxy(request(a))).status).toBe(429);
    expect((await proxy(request(b))).status).not.toBe(429);
  });

  it("tampering with a signed session does not create a new bucket", async () => {
    const signed = generateSignedSessionToken(SECRET);
    const tampered = `${signed.slice(0, -1)}${signed.endsWith("A") ? "B" : "A"}`;
    for (let i = 0; i < 300; i += 1) await proxy(request(`fake-${i}`));
    expect((await proxy(request(tampered))).status).toBe(429);
  });

  it("rejects noncanonical signature encoding of an otherwise valid token", () => {
    const signed = generateSignedSessionToken(SECRET);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = signed.at(-1)!;
    const equivalent = `${signed.slice(0, -1)}${alphabet[alphabet.indexOf(last) ^ 1]}`;
    expect(isSignedSessionToken(signed, SECRET)).toBe(true);
    expect(isSignedSessionToken(equivalent, SECRET)).toBe(false);
  });

  it("legacy database cookies and spoofed x-forwarded-for cannot escape the IP bucket", async () => {
    for (let i = 0; i < 300; i += 1) {
      const legacy = randomUUID();
      const incoming = request(legacy);
      incoming.headers.set("x-forwarded-for", `203.0.113.${i % 100}`);
      expect((await proxy(incoming)).status).not.toBe(429);
    }
    expect((await proxy(request(randomUUID()))).status).toBe(429);
  });

  it("a session signed with another secret falls back to IP", async () => {
    const other = generateSignedSessionToken("old-secret");
    for (let i = 0; i < 300; i += 1) await proxy(request(`fake-${i}`));
    expect((await proxy(request(other))).status).toBe(429);
  });

  it("mock JWT sessions remain isolated without a database lookup", async () => {
    vi.stubEnv("AUTH_MODE", "mock");
    const a = await encode({ token: { sub: randomUUID() }, secret: SECRET, salt: COOKIE });
    const b = await encode({ token: { sub: randomUUID() }, secret: SECRET, salt: COOKIE });
    for (let i = 0; i < 60; i += 1) await proxy(request(a));
    expect((await proxy(request(a))).status).toBe(429);
    expect((await proxy(request(b))).status).not.toBe(429);
  });
});
