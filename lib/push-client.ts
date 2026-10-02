/** 앱이 받은 기기 알림 번호를 서버에 알리고, 로그아웃할 때 지운다. 브라우저 안에서만 부른다. */
export const PUSH_TOKEN_KEY = "modori-push-token";

/** 알림을 눌렀을 때 열 주소. 모도리 안의 경로만 허용한다(밖으로 나가는 주소는 무시). */
export function safePushPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export async function registerPushToken(token: string): Promise<void> {
  const response = await fetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "android" }),
  });
  if (!response.ok) throw new Error(`알림 번호 등록 실패 ${response.status}`);
  localStorage.setItem(PUSH_TOKEN_KEY, token);
}

/** 로그아웃하기 전에 이 기기의 번호를 서버에서 지운다. 실패해도 로그아웃은 막지 않는다. */
export async function unregisterPushToken(): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(PUSH_TOKEN_KEY);
  } catch (error) {
    console.warn("[push] 저장된 알림 번호를 읽지 못했다.", error instanceof Error ? error.name : error);
  }
  if (!token) return;
  try {
    const response = await fetch("/api/push/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    // 서버가 지우지 못했으면 번호를 남겨 다음에 다시 시도한다(localStorage를 지우지 않는다).
    if (!response.ok) throw new Error(`알림 번호 삭제 실패 ${response.status}`);
    localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (error) {
    console.warn("[push] 알림 번호를 지우지 못했다.", error instanceof Error ? error.name : error);
  }
}
