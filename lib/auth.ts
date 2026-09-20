import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { OAuthConfig } from "next-auth/providers";

import { prisma } from "@/lib/prisma";

export const isMockAuth = process.env.AUTH_MODE === "mock";
export const isDataGSMConfigured = Boolean(process.env.DATAGSM_CLIENT_ID);

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
  if (!clientId) throw new Error("DATAGSM_CLIENT_ID가 설정되지 않았다.");

  return {
    id: "datagsm",
    name: "DataGSM",
    type: "oauth",
    clientId,
    clientSecret: process.env.DATAGSM_CLIENT_SECRET,
    authorization: {
      url: "https://oauth.authorization.datagsm.kr/v1/oauth/authorize",
      params: { scope: "datagsm:self_read", response_type: "code" },
    },
    token: "https://oauth.authorization.datagsm.kr/v1/oauth/token",
    userinfo: "https://oauth.resource.datagsm.kr/userinfo",
    checks: ["pkce", "state"],
    client: { token_endpoint_auth_method: "none" },
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
  // Credentials 프로바이더는 DB 세션 전략을 지원하지 않는다.
  // 평소에는 DB 세션(서버에서 강제 로그아웃 가능), 우회 모드일 때만 JWT.
  session: { strategy: isMockAuth ? "jwt" : "database" },
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user, token }) {
      // DB 전략은 user, JWT 전략은 token으로 들어온다.
      const id = user?.id ?? token?.sub;
      if (id) session.user.id = id;
      return session;
    },
  },
});
