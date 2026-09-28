import type { Metadata } from "next";

import { DesktopHandoff } from "@/components/desktop-handoff";
import { Dori } from "@/components/dori";
import { isChallenge, issueDesktopCode } from "@/lib/desktop-login";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "앱으로 돌아가기 · 모도리" };

/**
 * 데스크톱 앱이 연 브라우저 화면. 로그인이 안 돼 있으면 requireUser가 로그인(가입) 뒤 이리로 돌려보낸다.
 * 한 번 쓰는 코드를 만들어 modori:// 주소로 앱을 연다(lib/desktop-login.ts).
 */
export default async function DesktopLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;
  if (!isChallenge(challenge)) {
    return (
      <Frame mood="confused" title="앱에서 다시 시작해 주세요">
        이 주소는 모도리 앱의 “브라우저에서 로그인하기”로 열어야 해요.
      </Frame>
    );
  }

  const user = await requireUser();
  const code = await issueDesktopCode(user.id, challenge);

  return (
    <Frame mood="hello" title={`${user.nickname}님, 앱으로 돌아가요`}>
      <DesktopHandoff href={`modori://login?code=${encodeURIComponent(code)}`} />
    </Frame>
  );
}

function Frame({
  mood,
  title,
  children,
}: {
  mood: "hello" | "confused";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Dori mood={mood} size={110} />
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="flex w-full flex-col gap-3 text-sm text-muted">{children}</div>
    </main>
  );
}
