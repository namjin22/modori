/**
 * AI 도우미(2026-11-17)가 외부로 나가는 곳은 **여기 한 곳**이다. 2026-11-19부터 OpenAI 호환 `chat/completions` 형식 하나로 부른다
 * (보내는 곳을 Google Gemini에서 Cloudflare Workers AI로 바꿨다, docs/decisions.md). 서비스를 바꾸려면 환경변수 값만 바꾼다:
 *   AI_API_BASE  `/chat/completions` 앞까지의 주소. Cloudflare: https://api.cloudflare.com/client/v4/accounts/<계정 ID>/ai/v1
 *   AI_API_KEY   그 서비스의 API 토큰(Authorization: Bearer). 서버 환경변수에만 있고 브라우저로 나가지 않는다
 *   AI_MODEL     모델 이름(선택, 기본 DEFAULT_MODEL)
 * 시험은 AI_API_BASE를 가짜 서버로 돌린다. 보낸 말·받은 답은 로그에 남기지 않는다(상태 숫자와 종류만).
 *
 * Cloudflare 문서(2026-11-19 확인)가 밝히는 것은 주소·Authorization 머리글·model·messages뿐이다. **밝히지 않는 것**: max_tokens, response_format, 응답 모양, usage.
 * 그래서 response_format은 보내지 않고(JSON은 지시문이 요구하고 `parseReply`가 다시 검사한다), max_tokens는 OpenAI 표준 칸이라 보내고(안 보내면 모델 기본 길이에서 잘릴 수 있다),
 * 응답은 OpenAI 표준 모양(choices[0].message.content)으로 읽는다. **실제 키로 호출해 보지는 못했다**: 어긋나면 첫 호출이 실패하고 대화창에 오류 코드(아래 AiResult)가 나온다.
 */
const DEFAULT_MODEL = "@cf/openai/gpt-oss-120b";
const TIMEOUT_MS = 30_000;
/** 생각하는 모델은 생각에 쓴 글도 출력으로 세므로 넉넉히 둔다. 값은 상한일 뿐이고 쓴 만큼만 센다. */
const MAX_OUTPUT_TOKENS = 4096;

export type AiMessage = { role: "user" | "assistant"; text: string };

/**
 * 실패에는 `code`가 붙는다(예: http-404-NOT_FOUND, network-TimeoutError, empty-length). 화면에 그대로 보여 운영자가 원인을 바로 알게 하려는 것이다
 * (2026-11-18: 키를 넣었는데 "보내지 못했어요"만 나와 이유를 알 수 없었다). 키·보낸 말·받은 글·서비스가 준 오류 문장은 코드에 넣지 않는다. 숫자와 우리가 정한 영문 낱말만 쓴다.
 */
export type AiResult =
  | { ok: true; text: string }
  | { ok: false; kind: "busy" | "blocked" | "rejected" | "unavailable"; code: string };

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_API_BASE);
}

type ChatCompletion = {
  choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

/** 서비스가 준 오류 본문 대신, 상태 숫자에 붙이는 우리 쪽 이름(본문 모양을 서비스마다 믿을 수 없다). */
const STATUS_NAMES: Record<number, string> = { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND" };

export async function askModel(input: { system: string; messages: AiMessage[] }): Promise<AiResult> {
  const key = process.env.AI_API_KEY;
  const base = process.env.AI_API_BASE?.replace(/\/+$/, "");
  if (!key || !base) return { ok: false, kind: "rejected", code: "no-key" };
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: input.system }, ...input.messages.map((message) => ({ role: message.role, content: message.text }))],
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.error("[ai] AI 서비스에 연결하지 못했다.", name);
    return { ok: false, kind: "unavailable", code: `network-${name}` };
  }

  if (!response.ok) {
    // 오류 본문은 길이만 잘라 서버 로그에 남긴다(우리가 보낸 말을 되풀이하지 않는다). 화면에는 상태 숫자와 이름만 간다.
    const raw = await response.text().catch(() => "");
    const status = response.status;
    console.error("[ai] AI 서비스가 요청을 받아 주지 않았다.", status, raw.slice(0, 200));
    if (status === 429) return { ok: false, kind: "busy", code: "http-429" };
    const name = STATUS_NAMES[status];
    // 키가 틀렸거나, 모델 이름이 없거나, 요청 형식이 어긋난 것: 운영자가 고쳐야 한다.
    if (name) return { ok: false, kind: "rejected", code: `http-${status}-${name}` };
    return { ok: false, kind: "unavailable", code: `http-${status}` };
  }

  let data: ChatCompletion;
  try {
    data = (await response.json()) as ChatCompletion;
  } catch (error) {
    console.error("[ai] AI 서비스 응답이 JSON이 아니다.", error instanceof Error ? error.name : error);
    return { ok: false, kind: "unavailable", code: "response-not-json" };
  }
  const choice = data.choices?.[0];
  if (!choice) {
    console.error("[ai] AI 서비스 응답에 choices가 없다.", Object.keys(data).slice(0, 10).join(","));
    return { ok: false, kind: "unavailable", code: "no-choices" };
  }
  // 한도를 얼마나 쓰는지 재려는 숫자뿐이다(글은 남기지 않는다).
  const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = data.usage ?? {};
  if (typeof promptTokens === "number" && typeof completionTokens === "number") console.info(`[ai] 토큰 입력 ${promptTokens}, 출력 ${completionTokens}`);

  const content = choice.message?.content;
  const text = typeof content === "string" ? content : "";
  const finish = safeWord(choice.finish_reason);
  if (!text.trim()) {
    console.error("[ai] AI 서비스 답에 글이 없다.", finish ?? "finish_reason 없음");
    // 안전 정책에 걸렸으면 사용자에게 "답할 수 없다"고 알린다.
    return finish === "content_filter" ? { ok: false, kind: "blocked", code: "blocked-content-filter" } : { ok: false, kind: "unavailable", code: `empty-${finish ?? "none"}` };
  }
  return { ok: true, text };
}

/** 화면에 보여도 되는 짧은 영문 낱말(예: length, content_filter)만 통과시킨다. */
function safeWord(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{1,40}$/.test(value) ? value : undefined;
}
