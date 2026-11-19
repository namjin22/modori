// AI 서비스 호출(lib/ai/llm.ts). OpenAI 호환 요청 모양과 실패를 오류 코드로 바꾸는 것을 진짜 서비스 없이 확인한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { askModel, isAiConfigured } from "@/lib/ai/llm";

const input = { system: "지시문", messages: [{ role: "user" as const, text: "안녕" }, { role: "assistant" as const, text: "네" }, { role: "user" as const, text: "계획 짜 줘" }] };

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const completion = (content: unknown, finishReason: unknown = "stop") => json({ choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }] });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AI_API_BASE", "https://ai.example.test/v1/");
  vi.stubEnv("AI_API_KEY", "secret-key");
  vi.stubEnv("AI_MODEL", "");
  // 오류·경고·정보 로그는 일부러 남기는 것이라 시험 출력에서만 조용히 한다.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isAiConfigured", () => {
  it("주소와 키가 둘 다 있어야 준비된 것이다", () => {
    expect(isAiConfigured()).toBe(true);
    vi.stubEnv("AI_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
    vi.stubEnv("AI_API_KEY", "secret-key");
    vi.stubEnv("AI_API_BASE", "");
    expect(isAiConfigured()).toBe(false);
  });
});

describe("askModel 요청", () => {
  it("주소 끝 슬래시를 정리해 chat/completions로 보내고, 키는 Bearer 머리글, 지시문은 system 말로, AI의 말은 assistant로 보낸다", async () => {
    fetchMock.mockResolvedValue(completion("{}"));
    await askModel(input);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai.example.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-key");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.messages).toEqual([
      { role: "system", content: "지시문" },
      { role: "user", content: "안녕" },
      { role: "assistant", content: "네" },
      { role: "user", content: "계획 짜 줘" },
    ]);
    expect(body.max_tokens).toBe(4096);
    // 문서에 없는 칸은 보내지 않는다(JSON은 지시문이 요구하고 parseReply가 검사한다).
    expect(body).not.toHaveProperty("response_format");
  });

  it("모델은 AI_MODEL이 있으면 그것, 없으면 기본값을 쓴다", async () => {
    fetchMock.mockResolvedValue(completion("{}"));
    await askModel(input);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).model).toBe("@cf/openai/gpt-oss-120b");

    vi.stubEnv("AI_MODEL", "@cf/openai/gpt-oss-20b");
    await askModel(input);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).model).toBe("@cf/openai/gpt-oss-20b");
  });

  it("키나 주소가 없으면 부르지 않는다", async () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(await askModel(input)).toEqual({ ok: false, kind: "rejected", code: "no-key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("askModel 응답", () => {
  it("답 글을 돌려준다", async () => {
    fetchMock.mockResolvedValue(completion('{"reply":"좋아요"}'));
    expect(await askModel(input)).toEqual({ ok: true, text: '{"reply":"좋아요"}' });
  });

  it("토큰 개수가 있으면 숫자만 로그에 남기고 글은 남기지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ choices: [{ message: { content: "비밀 답" }, finish_reason: "stop" }], usage: { prompt_tokens: 1200, completion_tokens: 300 } }));
    await askModel(input);
    expect(console.info).toHaveBeenCalledWith("[ai] 토큰 입력 1200, 출력 300");
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls) + JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("비밀 답");
    expect(logged).not.toContain("secret-key");
  });

  it("429는 busy, 400·401·403·404는 rejected(상태 이름 붙임), 그 밖의 오류는 unavailable이다. 서비스가 준 오류 문장은 코드에 들어가지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: "quota" } }, 429));
    expect(await askModel(input)).toEqual({ ok: false, kind: "busy", code: "http-429" });

    for (const [status, name] of [[400, "BAD_REQUEST"], [401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"]] as const) {
      fetchMock.mockResolvedValueOnce(json({ error: { message: "내 말을 되풀이한다 비밀모델" } }, status));
      expect(await askModel(input)).toEqual({ ok: false, kind: "rejected", code: `http-${status}-${name}` });
    }

    fetchMock.mockResolvedValueOnce(json({ error: { message: "boom" } }, 500));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "http-500" });
    fetchMock.mockResolvedValueOnce(new Response("", { status: 413 }));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "http-413" });
  });

  it("안전 정책으로 막힌 답은 blocked, 글이 없는 답은 끝난 이유를 코드에 붙인다", async () => {
    fetchMock.mockResolvedValueOnce(completion(null, "content_filter"));
    expect(await askModel(input)).toEqual({ ok: false, kind: "blocked", code: "blocked-content-filter" });

    // 생각하는 데 출력을 다 쓰면 글이 비고 finish_reason이 length로 온다.
    fetchMock.mockResolvedValueOnce(completion("", "length"));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "empty-length" });

    fetchMock.mockResolvedValueOnce(completion(null, null));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "empty-none" });

    // 문자열이 아닌 content(예: 조각 배열)는 읽을 수 없으니 글이 없는 것으로 본다.
    fetchMock.mockResolvedValueOnce(completion([{ type: "text", text: "x" }]));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "empty-stop" });
  });

  it("끝난 이유에 이상한 글이 오면 코드에 넣지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(completion("", "내 말 <script>"));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "empty-none" });
  });

  it("choices가 없거나 JSON이 아니면 코드로 알린다", async () => {
    fetchMock.mockResolvedValueOnce(json({ result: { response: "x" }, success: true }));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "no-choices" });

    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "response-not-json" });
  });

  it("연결이 안 되면 오류 이름만 코드에 붙인다", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("connect ECONNREFUSED secret-key"), { name: "TypeError" }));
    expect(await askModel(input)).toEqual({ ok: false, kind: "unavailable", code: "network-TypeError" });
  });
});
