import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

export const isMockAuth = process.env.AUTH_MODE === "mock";

// 우회 모드가 켜진 채로 프로덕션에 나가면 아무나 남의 계정으로 들어올 수 있다.
// Preview 배포는 URL이 매번 바뀌어 OAuth redirect URI를 등록할 수 없으므로 mock이
// 필요하다. 그래서 NODE_ENV가 아니라 VERCEL_ENV로 막는다.
if (isMockAuth && process.env.VERCEL_ENV === "production") {
  throw new Error(
    "AUTH_MODE=mock은 프로덕션에서 쓸 수 없다. Vercel Production 환경변수에서 지워라.",
  );
}

const providers: NextAuthConfig["providers"] = [
  // Google과 DataGSM 모두 검증된 이메일을 주므로 같은 이메일이면 계정을 연결한다.
  // 이게 없으면 Google로 가입한 사람이 DataGSM으로 로그인할 때
  // OAuthAccountNotLinked 에러를 만난다.
  Google({ allowDangerousEmailAccountLinking: true }),
];

if (isMockAuth) {
  providers.push(
    Credentials({
      id: "mock",
      name: "테스트 로그인",
      credentials: { email: { label: "email", type: "text" } },
      async authorize(credentials) {
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
