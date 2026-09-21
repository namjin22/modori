import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { customFetch, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { OAuthConfig } from "next-auth/providers";

import { prisma } from "@/lib/prisma";

export const isMockAuth = process.env.AUTH_MODE === "mock";

// 토큰 요청에 client_secret을 실어야 하므로 둘 다 있어야 쓸 수 있다.
// 하나만 있으면 로그인 버튼을 숨기고 로그에 남긴다. 여기서 throw하면 구글 로그인까지
// 같이 죽는다.
export const isDataGSMConfigured =
  Boolean(process.env.DATAGSM_CLIENT_ID) &&
  Boolean(process.env.DATAGSM_CLIENT_SECRET);

if (process.env.DATAGSM_CLIENT_ID && !process.env.DATAGSM_CLIENT_SECRET) {
  console.error(
    "[auth] DATAGSM_CLIENT_SECRET이 없어서 DataGSM 로그인을 끈다. 환경변수를 확인해라.",
  );
}

type DataGSMProfile = {
  id: number;
  email: string;
  status: "PENDING" | "ACTIVE";
  objectType: "STUDENT" | "TEACHER" | null;
  student: { name: string } | null;
  teacher: { name: string } | null;
};

function DataGSM(): OAuthConfig<DataGSMProfile> {
  const clientId = process.env.DATAGSM_CLIENT_ID;
  const clientSecret = process.env.DATAGSM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("DataGSM 환경변수가 설정되지 않았다.");
  }

  return {
    id: "datagsm",
    name: "DataGSM",
    type: "oauth",
    clientId,
    clientSecret,
    // 토큰 요청을 JSON으로 보내려면 client 인증도 본문에 들어가야 한다.
    // 기본값(client_secret_basic)은 Authorization 헤더를 쓰는데, 아래 customFetch가
    // 본문을 JSON으로 바꾸면서 헤더만 남으면 서버가 형식을 맞추기 어렵다.
    client: { token_endpoint_auth_method: "client_secret_post" },
    authorization: {
      url: "https://oauth.authorization.datagsm.kr/v1/oauth/authorize",
      params: { response_type: "code", scope: "datagsm:self_read" },
    },
    token: "https://oauth.authorization.datagsm.kr/v1/oauth/token",
    userinfo: "https://oauth.resource.datagsm.kr/userinfo",
    // state는 CSRF를 막는 값이고 Auth.js의 기본값이다. 없으면 authorize 요청에
    // state 파라미터 자체가 빠져서, 이를 요구하는 서버는 invalid_request로 되돌린다.
    checks: ["state", "pkce"],
    [customFetch]: async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== "https://oauth.authorization.datagsm.kr/v1/oauth/token" || !init?.body) {
        return fetch(input, init);
      }

      const params =
        typeof init.body === "string"
          ? new URLSearchParams(init.body)
          : init.body instanceof URLSearchParams
            ? init.body
            : null;
      if (!params) return fetch(input, init);

      // client_secret_post라서 자격 증명은 이미 본문 params에 들어 있다.
      const headers = new Headers(init.headers);
      headers.set("content-type", "application/json");
      return fetch(input, {
        ...init,
        headers,
        body: JSON.stringify(Object.fromEntries(params)),
      });
    },
    allowDangerousEmailAccountLinking: true,
    profile(profile) {
      if (profile.status !== "ACTIVE") {
        throw new Error("DataGSM 계정이 아직 활성화되지 않았다.");
      }

      return {
        id: String(profile.id),
        email: profile.email,
        name: profile.student?.name ?? profile.teacher?.name ?? profile.email,
      };
    },
  };
}

// 우회 모드가 켜진 채로 프로덕션에 나가면 이메일만 아는 사람이 남의 계정으로 들어온다.
// Vercel Production은 빌드 자체를 실패시킨다.
if (isMockAuth && process.env.VERCEL_ENV === "production") {
  throw new Error(
    "AUTH_MODE=mock은 프로덕션에서 쓸 수 없다. Vercel Production 환경변수에서 지워라.",
  );
}

// 환경변수만으로 막으면 Vercel이 아닌 곳(GSMSV 등)에서는 VERCEL_ENV가 없어 그대로
// 통과한다. 그래서 요청이 들어온 호스트로 한 번 더 막는다.
// Preview 배포는 URL이 매번 바뀌어 OAuth redirect URI를 등록할 수 없으므로 허용한다.
function isMockHostAllowed(request: Request): boolean {
  if (process.env.VERCEL_ENV === "preview") return true;

  const host = request.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

const providers: NextAuthConfig["providers"] = [
  // Google과 DataGSM 모두 검증된 이메일을 주므로 같은 이메일이면 계정을 연결한다.
  // 이게 없으면 Google로 가입한 사람이 DataGSM으로 로그인할 때
  // OAuthAccountNotLinked 에러를 만난다.
  Google({ allowDangerousEmailAccountLinking: true }),
];

if (isDataGSMConfigured) providers.push(DataGSM());

if (isMockAuth) {
  providers.push(
    Credentials({
      id: "mock",
      name: "테스트 로그인",
      credentials: { email: { label: "email", type: "text" } },
      async authorize(credentials, request) {
        if (!isMockHostAllowed(request)) {
          console.error("[auth] 허용되지 않은 호스트에서 mock 로그인을 시도했다.");
          return null;
        }

        const email = credentials?.email;
        if (typeof email !== "string" || !email.includes("@")) return null;

        // 테스트가 같은 계정을 반복해서 쓰므로 있으면 그대로 돌려준다.
        return prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  logger: {
    error(error) {
      // OAuth 제공자가 돌려준 오류는 cause에 콜백 쿼리가 통째로 들어온다.
      // 그 안에는 authorization code도 있으므로, 원인 파악에 필요한 칸만 골라 남긴다.
      const cause = error.cause as
        | {
            err?: { name?: string; message?: string };
            providerId?: string;
            error?: string;
            error_description?: string;
            error_uri?: string;
          }
        | undefined;

      console.error("[auth:error]", {
        name: error.name,
        message: error.message,
        causeName: cause?.err?.name,
        causeMessage: cause?.err?.message,
        providerId: cause?.providerId,
        providerError: cause?.error,
        providerErrorDescription: cause?.error_description,
        providerErrorUri: cause?.error_uri,
      });
    },
  },
  // Credentials 프로바이더는 DB 세션 전략을 지원하지 않는다.
  // 평소에는 DB 세션(서버에서 강제 로그아웃 가능), 우회 모드일 때만 JWT.
  session: { strategy: isMockAuth ? "jwt" : "database" },
  // 오류도 로그인 화면에서 받는다. 기본 오류 화면은 영어로 "Server error"만 뜬다.
  // /login은 로그인을 요구하지 않으므로 되돌기 고리가 생기지 않는다.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    session({ session, user, token }) {
      // DB 전략은 user, JWT 전략은 token으로 들어온다.
      const id = user?.id ?? token?.sub;
      if (id) session.user.id = id;
      return session;
    },
  },
});
