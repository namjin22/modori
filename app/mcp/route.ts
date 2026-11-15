import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticate } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

// 요청 본문의 최대 크기. 할 일 20개·일정 10개를 담고도 남는 크기다.
const MAX_BODY_BYTES = 64 * 1024;

export const dynamic = "force-dynamic";

function problem(status: number, message: string, extra: Record<string, string> = {}): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

/**
 * 모도리의 MCP 서버(2026-11-15, docs/decisions.md "MCP", docs/mcp.md). 외부 AI가 접근 토큰으로 할 일·일정을 한꺼번에 읽고 쓴다.
 * 세션을 두지 않는(stateless) JSON 응답 방식이라 POST만 받는다. 모도리가 AI를 돌리는 것이 아니라 사용자가 고른 외부 AI가 부르는 문이다.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return problem(auth.status, auth.message, {
      ...(auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="modori"' } : {}),
      ...(auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {}),
    });
  }

  const server = createMcpServer(auth.ctx, auth.scope);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MAX_BODY_BYTES });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error("[mcp] 요청을 처리하지 못했다.", error);
    return problem(500, "Internal error.");
  } finally {
    // 응답을 다 만든 뒤에 닫는다. 요청마다 새로 만들었으므로 남겨 둘 것이 없다.
    await transport.close().catch((error: unknown) => console.warn("[mcp] 전송을 닫지 못했다.", error));
  }
}

/** 알림을 받는 SSE 연결은 쓰지 않는다. 클라이언트에게 "이 길은 없다"고 알린다. */
export function GET(): Response {
  return problem(405, "This server only accepts POST.", { Allow: "POST" });
}

export function DELETE(): Response {
  return problem(405, "This server has no sessions to delete.", { Allow: "POST" });
}
