import { afterEach, describe, expect, it, vi } from "vitest";

import { withoutIdToken } from "@/lib/datagsm-token";

const TOKEN_BODY = { access_token: "a", token_type: "Bearer", expires_in: 3600, refresh_token: "r", scope: "datagsm:self_read" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withoutIdToken", () => {
  it("id_token이 null이면 그 칸만 빼고 나머지는 그대로 돌려준다", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await withoutIdToken(jsonResponse({ ...TOKEN_BODY, id_token: null }));

    expect(await result.json()).toEqual(TOKEN_BODY);
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("application/json");
  });

  it("문자열 id_token도 뺀다(oauth 방식이라 쓰지 않는다)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await withoutIdToken(jsonResponse({ ...TOKEN_BODY, id_token: "a.b.c" }));

    expect(await result.json()).toEqual(TOKEN_BODY);
  });

  it("id_token의 값은 로그에 남기지 않고 종류만 남긴다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await withoutIdToken(jsonResponse({ ...TOKEN_BODY, id_token: "a.b.c" }));

    expect(JSON.stringify(warn.mock.calls)).not.toContain("a.b.c");
    expect(JSON.stringify(warn.mock.calls)).toContain("string");
  });

  it("id_token이 없으면 응답을 그대로 돌려준다", async () => {
    const response = jsonResponse(TOKEN_BODY);

    const result = await withoutIdToken(response);

    expect(result).toBe(response);
    expect(await result.json()).toEqual(TOKEN_BODY);
  });

  it("오류 응답은 건드리지 않는다", async () => {
    const response = jsonResponse({ error: "invalid_grant", id_token: null }, 400);

    const result = await withoutIdToken(response);

    expect(result).toBe(response);
  });

  it("JSON이 아니면 원본을 돌려주고 로그를 남긴다", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = new Response("<html>nope</html>", { status: 200 });

    const result = await withoutIdToken(response);

    expect(result).toBe(response);
    expect(error).toHaveBeenCalledOnce();
  });
});
