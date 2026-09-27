import { recordError } from "@/lib/errors";

/**
 * 브라우저에서 난 오류를 받는다(app/error.tsx가 보낸다). 로그인 여부와 상관없이 받되,
 * 요청 속도 제한(proxy.ts)과 길이 제한으로 쓰레기 기록을 막는다.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 2000) return new Response(null, { status: 413 });

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
