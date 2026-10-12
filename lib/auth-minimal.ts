import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";

/**
 * 로그인에 꼭 필요한 것만 저장한다(docs/privacy-inventory.md).
 *
 * Auth.js는 처음 가입할 때 OAuth 프로필을 통째로 사용자 행에 넣고(@auth/core lib/actions/callback/handle-login.js의
 * createUser({ ...profile })), 로그인 계정을 이을 때 받은 토큰을 전부 넣는다(linkAccount({ ...account })).
 * 모도리는 로그인한 뒤 Google·DataGSM API를 부르지 않는다. 실명(name)·사진 주소(image)·토큰은 쓰는 곳이 없는데
 * DB가 새면 그대로 새어 나간다. 특히 DataGSM refresh_token은 오래 살아 학생 정보를 다시 꺼낼 수 있다.
 * 이메일은 남긴다: 같은 이메일의 Google·DataGSM 계정을 잇고(allowDangerousEmailAccountLinking), 운영자를 가린다.
 */
export function minimalUser<T extends Omit<AdapterUser, "id">>(user: T): T {
  return { ...user, name: null, image: null };
}

export function minimalAccount(account: AdapterAccount): AdapterAccount {
  return {
    ...account,
    // Apple만 refresh_token을 남긴다. 계정을 지울 때 Apple에 이 사람의 연결을 끊어 달라고 알려야 하기 때문이다
    // (App Store 심사 지침 5.1.1(v), lib/apple-revoke.ts). 다른 곳에 쓰지 않고, 계정을 지울 때 함께 지운다.
    refresh_token: account.provider === "apple" ? account.refresh_token : undefined,
    access_token: undefined,
    id_token: undefined,
    expires_at: undefined,
    token_type: undefined,
    scope: undefined,
    session_state: undefined,
  };
}

/** Prisma 어댑터 앞에 둔다. 나머지 동작은 그대로다. */
export function withMinimalStorage(adapter: Adapter): Adapter {
  const { createUser, linkAccount } = adapter;
  return {
    ...adapter,
    ...(createUser && { createUser: (user) => createUser(minimalUser(user)) }),
    ...(linkAccount && { linkAccount: (account) => linkAccount(minimalAccount(account)) }),
  };
}
