/**
 * 접근 토큰: 외부 AI(MCP 클라이언트)가 모도리의 할 일·일정을 읽고 쓸 때 내미는 열쇠(2026-11-15, docs/decisions.md "MCP").
 * 마이페이지에서 만들고, 값은 만들 때 딱 한 번만 보여 준다. DB에는 SHA-256 해시만 둔다.
 * 비밀번호가 아니라 32바이트 무작위 값이라 해시에 소금이 필요 없고, 해시로 바로 찾을 수 있다.
 * 폐기는 행을 지우는 것이다(폐기 기록을 따로 남기지 않는다).
 * 이 파일은 브라우저 화면도 가져다 쓰므로 node:crypto를 쓰는 해시·생성은 lib/api-token-secret.ts에 둔다.
 */
export const API_TOKEN_PREFIX = "mdr_";

/** randomBytes(32)를 base64url로 적은 길이. */
export const SECRET_LENGTH = 43;

/** 한 사람이 가질 수 있는 토큰(만료된 것 포함) 수. */
export const MAX_API_TOKENS = 5;

export const MAX_TOKEN_NAME_LENGTH = 40;

/** 고를 수 있는 유효 기간(일). 영원히 살아 있는 토큰은 만들지 않는다. */
export const API_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;

/** 권한: READ 읽기만 / WRITE 만들기·끝내기·옮기기·되돌리기 / FULL 거기에 고치기·지우기·카테고리·루틴·프로필·설정·친구·반응(2026-11-16). */
export const API_TOKEN_SCOPES = ["READ", "WRITE", "FULL"] as const;
export type ApiTokenScopeName = (typeof API_TOKEN_SCOPES)[number];

const BEARER = new RegExp(`^[Bb]earer +(${API_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}})$`);

/** "Authorization: Bearer mdr_…" 머리글에서 토큰을 꺼낸다. 모양이 틀리면 DB를 부르지 않고 null. */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

/** 만료 전인지. */
export function isTokenUsable(token: { expiresAt: Date }, now = new Date()): boolean {
  return token.expiresAt.getTime() > now.getTime();
}

/** 만료 시각: 만든 때부터 days일 뒤. */
export function tokenExpiry(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
