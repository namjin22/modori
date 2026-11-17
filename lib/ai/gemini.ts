/**
 * Google Gemini API 호출. AI 도우미(2026-11-17)가 외부로 나가는 곳은 **여기 한 곳**이다. API 형식이 바뀌면 이 파일만 고친다.
 *
 * 키(GEMINI_API_KEY)는 서버 환경변수에만 있고 브라우저로 나가지 않는다. 모델(GEMINI_MODEL)과 주소(GEMINI_API_BASE)는 운영자가 바꿀 수 있다.
 * 주소를 바꾸는 것은 시험에서 가짜 서버로 돌리려는 것이다. 보낸 말·받은 답은 로그에 남기지 않는다(상태 숫자와 종류만 남긴다).
 *
 * 형식은 Google 문서(2026-11-17 확인)의 generateContent 참조에 따른다: POST /v1beta/models/{model}:generateContent, 키는 x-goog-api-key 머리글,
 * systemInstruction·contents(role은 user·model), 답은 candidates[].content.parts[].text. 이 문서의 새 "interactions" 방식은 쓰지 않았다
 * (시스템 지시문 자리를 문서에서 확인하지 못했다). **실제 키로 호출해 보지는 못했다**: 모델 이름·형식이 어긋나면 첫 호출에서 502가 나고 로그에 상태 숫자가 남는다.
 */
const DEFAULT_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 30_000;

export type GeminiMessage = { role: "user" | "model"; text: string };

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; kind: "busy" | "blocked" | "rejected" | "unavailable" };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function askGemini(input: { system: string; messages: GeminiMessage[] }): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, kind: "rejected" };
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
    console.error("[ai] Gemini에 연결하지 못했다.", error instanceof Error ? error.name : error);
    return { ok: false, kind: "unavailable" };
  }

  if (response.status === 429) {
    console.warn("[ai] Gemini 사용 한도에 닿았다(429).");
    return { ok: false, kind: "busy" };
  }
  if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
    // 키가 틀렸거나, 모델 이름이 없거나, 요청 형식이 어긋난 것. 운영자가 고쳐야 한다. 오류 본문은 길이만 잘라 남긴다(우리가 보낸 말을 되풀이하지 않는다).
    console.error("[ai] Gemini가 요청을 거절했다.", response.status, (await response.text().catch(() => "")).slice(0, 200));
    return { ok: false, kind: "rejected" };
  }
  if (!response.ok) {
    console.error("[ai] Gemini 서버 오류.", response.status);
    return { ok: false, kind: "unavailable" };
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (error) {
    console.error("[ai] Gemini 응답이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return { ok: false, kind: "unavailable" };
  }
  // 받은 글이 없고 묻는 말이 막혔다고 하면(안전 정책) 사용자에게 "답할 수 없다"고 알린다.
  if (!data.candidates?.length) return data.promptFeedback?.blockReason ? { ok: false, kind: "blocked" } : { ok: false, kind: "unavailable" };
  const candidate = data.candidates[0];
  const text = (candidate.content?.parts ?? []).map((part) => part.text ?? "").join("");
  if (!text) return candidate.finishReason === "SAFETY" ? { ok: false, kind: "blocked" } : { ok: false, kind: "unavailable" };
  return { ok: true, text };
}
