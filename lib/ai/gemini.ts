/**
 * Google Gemini API 호출. AI 도우미(2026-11-17)가 외부로 나가는 곳은 **여기 한 곳**이다. API 형식이 바뀌면 이 파일만 고친다.
 *
 * 키(GEMINI_API_KEY)는 서버 환경변수에만 있고 브라우저로 나가지 않는다. 모델(GEMINI_MODEL)과 주소(GEMINI_API_BASE)는 운영자가 바꿀 수 있다.
 * 주소를 바꾸는 것은 시험에서 가짜 서버로 돌리려는 것이다. 보낸 말·받은 답은 로그에 남기지 않는다(상태 숫자와 종류만 남긴다).
 *
 * 형식은 Google 문서(2026-11-17 확인)의 generateContent 참조에 따른다: POST /v1beta/models/{model}:generateContent, 키는 x-goog-api-key 머리글,
 * systemInstruction·contents(role은 user·model), 답은 candidates[].content.parts[].text. 이 문서의 새 "interactions" 방식은 쓰지 않았다
 * (시스템 지시문 자리를 문서에서 확인하지 못했다). **실제 키로 호출해 보지는 못했다**: 모델 이름·형식이 어긋나면 첫 호출이 실패하고 대화창에 오류 코드(아래 GeminiResult)가 나온다.
 */
const DEFAULT_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 30_000;

export type GeminiMessage = { role: "user" | "model"; text: string };

/**
 * 실패에는 `code`가 붙는다(예: http-404-NOT_FOUND, network-TimeoutError, empty-MAX_TOKENS). 화면에 그대로 보여 운영자가 원인을 바로 알게 하려는 것이다
 * (2026-11-18: 키를 넣었는데 "보내지 못했어요"만 나와 이유를 알 수 없었다). 키·보낸 말·받은 글은 코드에 넣지 않는다. 숫자와 Google이 주는 영문 상태 이름만 쓴다.
 */
export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; kind: "busy" | "blocked" | "rejected" | "unavailable"; code: string };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function askGemini(input: { system: string; messages: GeminiMessage[] }): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, kind: "rejected", code: "no-key" };
  const base = process.env.GEMINI_API_BASE ?? DEFAULT_BASE;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.messages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.error("[ai] Gemini에 연결하지 못했다.", name);
    return { ok: false, kind: "unavailable", code: `network-${name}` };
  }

  if (response.status === 429) {
    console.warn("[ai] Gemini 사용 한도에 닿았다(429).");
    return { ok: false, kind: "busy", code: "http-429" };
  }
  if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
    // 키가 틀렸거나, 모델 이름이 없거나, 요청 형식이 어긋난 것. 운영자가 고쳐야 한다. 오류 본문은 길이만 잘라 남긴다(우리가 보낸 말을 되풀이하지 않는다).
    const raw = await response.text().catch(() => "");
    console.error("[ai] Gemini가 요청을 거절했다.", response.status, raw.slice(0, 200));
    return { ok: false, kind: "rejected", code: `http-${response.status}${googleStatus(raw)}` };
  }
  if (!response.ok) {
    console.error("[ai] Gemini 서버 오류.", response.status);
    return { ok: false, kind: "unavailable", code: `http-${response.status}` };
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (error) {
    console.error("[ai] Gemini 응답이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return { ok: false, kind: "unavailable", code: "response-not-json" };
  }
  // 받은 글이 없고 묻는 말이 막혔다고 하면(안전 정책) 사용자에게 "답할 수 없다"고 알린다.
  if (!data.candidates?.length) {
    return data.promptFeedback?.blockReason ? { ok: false, kind: "blocked", code: "blocked-prompt" } : { ok: false, kind: "unavailable", code: "no-candidates" };
  }
  const candidate = data.candidates[0];
  const text = (candidate.content?.parts ?? []).map((part) => part.text ?? "").join("");
  if (!text) {
    console.error("[ai] Gemini 답에 글이 없다.", candidate.finishReason ?? "finishReason 없음");
    return candidate.finishReason === "SAFETY" ? { ok: false, kind: "blocked", code: "blocked-safety" } : { ok: false, kind: "unavailable", code: `empty-${safeWord(candidate.finishReason) ?? "none"}` };
  }
  return { ok: true, text };
}

/** Google의 오류 본문({"error":{"status":"NOT_FOUND"}})에서 영문 상태 이름만 꺼낸다. 메시지(우리가 보낸 말을 되풀이할 수 있다)는 꺼내지 않는다. */
function googleStatus(raw: string): string {
  try {
    const status = (JSON.parse(raw) as { error?: { status?: unknown } }).error?.status;
    return typeof status === "string" && safeWord(status) ? `-${status}` : "";
  } catch (error) {
    console.warn("[ai] Gemini 오류 본문이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return "";
  }
}

/** 화면에 보여도 되는 짧은 영문 대문자 낱말(예: MAX_TOKENS)만 통과시킨다. */
function safeWord(value: string | undefined): string | undefined {
  return value !== undefined && /^[A-Z][A-Z0-9_]{1,40}$/.test(value) ? value : undefined;
}
