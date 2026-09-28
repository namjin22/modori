import { recordError } from "@/lib/errors";

const MAX_BYTES = 2000;

/**
 * 본문을 MAX_BYTES까지만 읽는다. request.text()는 끝까지 메모리에 올려서, 누가 수백 MB를
 * 보내면 그만큼 서버 메모리를 쓴다. 넘으면 읽기를 멈추고 null을 돌려준다.
 */
async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * 브라우저에서 난 오류를 받는다(app/error.tsx가 보낸다). 로그인 여부와 상관없이 받되,
 * 요청 속도 제한(proxy.ts)과 길이 제한으로 쓰레기 기록을 막는다.
 */
export async function POST(request: Request) {
  const text = await readLimited(request);
  if (text === null) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    console.warn("[errors] 읽을 수 없는 오류 보고를 받았다.", error instanceof Error ? error.message : error);
    return new Response(null, { status: 400 });
  }

  const { message, path } = (body ?? {}) as { message?: unknown; path?: unknown };
  if (typeof message !== "string" || !message) return new Response(null, { status: 400 });

  await recordError({
    source: "client",
    message,
    path: typeof path === "string" ? path : null,
  });
  return new Response(null, { status: 204 });
}
