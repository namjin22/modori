/**
 * DataGSM 토큰 응답에서 id_token을 뺀다.
 *
 * DataGSM이 OpenID(id_token)를 지원하기 시작해서(`/.well-known/openid-configuration`이 열렸다) 토큰 응답에 id_token 칸이
 * 생긴 것으로 보인다. 문자열이 아닌 값(null)이 오면 oauth4webapi가 `"id_token" property must be a string`으로
 * 로그인을 막는다(2026-11-02 운영 로그). 모도리는 DataGSM을 oauth 방식으로 쓰고 사용자 정보는 userinfo에서 받아서 id_token이 필요 없다.
 * 값은 로그에 남기지 않고 종류(null·문자열 따위)만 남긴다.
 */
export async function withoutIdToken(response: Response): Promise<Response> {
  if (!response.ok) return response;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch (error) {
    // 원본을 그대로 돌려줘 oauth4webapi가 평소처럼 오류를 낸다.
    console.error("[auth:datagsm] 토큰 응답을 JSON으로 읽지 못했다", error instanceof Error ? error.message : error);
    return response;
  }

  if (typeof body !== "object" || body === null || !("id_token" in body)) return response;

  const { id_token: idToken, ...rest } = body as Record<string, unknown>;
  console.warn("[auth:datagsm] 토큰 응답의 id_token을 뺐다", { type: idToken === null ? "null" : typeof idToken });

  // 본문이 바뀌었으니 길이와 압축 표시는 맞지 않는다.
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(JSON.stringify(rest), { status: response.status, statusText: response.statusText, headers });
}
