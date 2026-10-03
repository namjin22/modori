import type { Metadata } from "next";

import { AutoSubmit } from "@/components/auto-submit";
import { DesktopHandoff } from "@/components/desktop-handoff";
import { Dori } from "@/components/dori";
import { isChallenge, issueDesktopCode } from "@/lib/desktop-login";
import { getCurrentUser, requireUser } from "@/lib/session";

import { continueDesktopLogin, switchDesktopAccount } from "./actions";

export const metadata: Metadata = { title: "앱으로 돌아가기 · 모도리" };

/**
 * 데스크톱 앱이 연 브라우저 화면. 로그인이 안 돼 있으면 requireUser가 로그인(가입) 뒤 이리로 돌려보낸다.
 * 한 번 쓰는 코드를 만들어 modori:// 주소로 앱을 연다(lib/desktop-login.ts).
 */
export default async function DesktopLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; provider?: string; confirmed?: string }>;
}) {
  const { challenge, provider, confirmed } = await searchParams;
  if (!isChallenge(challenge)) {
    return (
      <Frame mood="confused" title="앱에서 다시 시작해 주세요">
        이 주소는 모도리 앱의 로그인 버튼으로 열어야 해요.
      </Frame>
    );
  }

  // 앱에서 Google·DataGSM 버튼을 눌러 왔고 아직 로그인 전이면, 로그인 버튼을 한 번 더 누르지 않게 바로 이어 간다.
  if ((provider === "google" || provider === "datagsm") && !(await getCurrentUser())) {
    return (
      <Frame mood="hello" title="로그인으로 넘어가는 중이에요">
        <AutoSubmit action={continueDesktopLogin}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="challenge" value={challenge} />
          <button
            type="submit"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
          >
            {provider === "google" ? "Google" : "DataGSM"}로 계속하기
          </button>
        </AutoSubmit>
      </Frame>
    );
  }

  const user = await requireUser();

  // 앱에서 로그아웃해도 이 브라우저의 로그인은 남는다. 앱에서 로그인 버튼을 눌렀는데 이미 로그인돼 있으면
  // 그 계정으로 바로 넘기지 않고, 이 계정으로 갈지 다른 계정으로 갈지 묻는다.
  if ((provider === "google" || provider === "datagsm") && confirmed !== "1") {
    return (
      <Frame mood="hello" title={`${user.nickname}님으로 로그인할까요?`}>
        <p>이 브라우저에 이미 로그인된 계정이에요.</p>
        <a
          href={`/desktop/login?challenge=${encodeURIComponent(challenge)}&provider=${provider}&confirmed=1`}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-contrast"
        >
          {user.nickname}님으로 계속
        </a>
        <form action={switchDesktopAccount} className="flex w-full flex-col">
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="challenge" value={challenge} />
          <button
            type="submit"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-surface text-base font-semibold text-foreground"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </Frame>
    );
  }

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
