// AI 서비스 호출의 속도 관련 부분(lib/ai/llm.ts, 2026-11-19): 생각하는 정도(AI_REASONING_EFFORT)는 켠 때만 보내고, 걸린 시간을 숫자로 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { askModel } from "@/lib/ai/llm";

const input = { system: "지시문", messages: [{ role: "user" as const, text: "안녕" }] };
const fetchMock = vi.fn();
const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }), { status: 200 });
const sentBody = () => JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string) as Record<string, unknown>;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ok());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AI_API_BASE", "https://ai.example.test/v1");
  vi.stubEnv("AI_API_KEY", "secret-key");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_REASONING_EFFORT", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI_REASONING_EFFORT", () => {
  it("비우면 보내지 않는다(모델 기본값을 쓴다)", async () => {
    await askModel(input);
    expect(sentBody()).not.toHaveProperty("reasoning_effort");
  });

  it("low·medium·high는 소문자로 맞춰 reasoning_effort로 보낸다", async () => {
    for (const [value, sent] of [["low", "low"], [" HIGH ", "high"], ["Medium", "medium"]] as const) {
      vi.stubEnv("AI_REASONING_EFFORT", value);
      await askModel(input);
      expect(sentBody().reasoning_effort, value).toBe(sent);
    }
  });

  it("그 밖의 값은 보내지 않는다", async () => {
    for (const value of ["fast", "0", "minimal", "low high"]) {
      vi.stubEnv("AI_REASONING_EFFORT", value);
      await askModel(input);
      expect(sentBody(), value).not.toHaveProperty("reasoning_effort");
    }
  });
});

describe("걸린 시간 로그", () => {
  it("성공하면 걸린 시간과 모델을 로그에 남긴다(글은 남기지 않는다)", async () => {
    await askModel(input);
    const lines = vi.mocked(console.info).mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => /^\[ai\] 걸린 시간 \d+ms \(@cf\/openai\/gpt-oss-120b\)$/.test(line))).toBe(true);
    expect(lines.join("\n")).not.toContain("secret-key");
    expect(lines.join("\n")).not.toContain("안녕");
  });

  it("생각하는 정도를 켰으면 로그에도 붙는다", async () => {
    vi.stubEnv("AI_MODEL", "@cf/openai/gpt-oss-20b");
    vi.stubEnv("AI_REASONING_EFFORT", "low");
    await askModel(input);
    const lines = vi.mocked(console.info).mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => /^\[ai\] 걸린 시간 \d+ms \(@cf\/openai\/gpt-oss-20b, 생각 low\)$/.test(line))).toBe(true);
  });
});
