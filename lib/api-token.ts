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

/** 고를 수 있는 유효 기간(일). */
export const API_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;

/** 유효 기간 대신 고르는 "만료 없음"의 폼 값(2026-11-17, docs/decisions.md). DB에는 expiresAt이 빈 값으로 적힌다. */
export const NO_EXPIRY = "never";

/** 권한: READ 읽기만 / WRITE 만들기·끝내기·옮기기·되돌리기 / FULL 거기에 고치기·지우기·카테고리·루틴·프로필·설정·친구·반응(2026-11-16). */
export const API_TOKEN_SCOPES = ["READ", "WRITE", "FULL"] as const;
export type ApiTokenScopeName = (typeof API_TOKEN_SCOPES)[number];

const BEARER = new RegExp(`^[Bb]earer +(${API_TOKEN_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}})$`);

/** "Authorization: Bearer mdr_…" 머리글에서 토큰을 꺼낸다. 모양이 틀리면 DB를 부르지 않고 null. */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

/** 만료 전인지. 만료 시각이 비어 있으면(만료 없음) 지우기 전까지 쓸 수 있다. */
export function isTokenUsable(token: { expiresAt: Date | null }, now = new Date()): boolean {
  return token.expiresAt === null || token.expiresAt.getTime() > now.getTime();
}

/** 만료 시각: 만든 때부터 days일 뒤. */
export function tokenExpiry(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

/** 폼의 "유효 기간" 값에서 만료 시각을 정한다. 만료 없음은 null, 허용한 일수는 그 날, 그 밖의 값은 undefined(잘못된 값). */
export function readTokenExpiry(value: FormDataEntryValue | null, now = new Date()): Date | null | undefined {
  if (value === NO_EXPIRY) return null;
  const days = API_TOKEN_EXPIRY_DAYS.find((allowed) => allowed === Number(value));
  return days === undefined ? undefined : tokenExpiry(days, now);
}
