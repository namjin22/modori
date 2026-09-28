import { afterEach, expect, it, vi } from "vitest";

import { GET } from "@/app/api/desktop/exchange/route";
import { isSignedSessionToken } from "@/lib/signed-session-token";

const db = vi.hoisted(() => ({ create: vi.fn(async () => ({})) }));

vi.mock("@/lib/auth", () => ({ isMockAuth: false }));
vi.mock("@/lib/desktop-login", () => ({ redeemDesktopCode: vi.fn(async () => "desktop-user") }));
vi.mock("@/lib/prisma", () => ({ prisma: { session: db } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("issues a signed desktop database session usable by the proxy", async () => {
  vi.stubEnv("AUTH_SECRET", "desktop-session-test-secret");
  vi.stubEnv("AUTH_URL", "https://modori.example");
  const response = await GET(new Request("https://modori.example/api/desktop/exchange?code=once&verifier=valid"));
  const cookie = response.headers.get("set-cookie") ?? "";
  const value = cookie.match(/__Secure-authjs\.session-token=([^;]+)/)?.[1];
  expect(response.status).toBe(303);
  expect(value).toBeTruthy();
  expect(isSignedSessionToken(value!, process.env.AUTH_SECRET)).toBe(true);
  expect(db.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ sessionToken: value, userId: "desktop-user", expires: expect.any(Date) }),
  });
});
