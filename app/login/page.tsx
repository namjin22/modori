import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { isDataGSMConfigured, isMockAuth, signIn } from "@/lib/auth";
import { isDesktopApp, isInAppBrowser, isMobileApp } from "@/lib/desktop";
import { safeNext } from "@/lib/next-path";
import { getCurrentUser } from "@/lib/session";

import { NativeLoginButtons } from "@/components/native-login-buttons";

// Auth.js가 붙여 보내는 오류 코드. 사람이 읽을 말로 바꾼다.
// 모르는 코드는 일반 안내로 받는다.
const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "로그인 설정에 문제가 있어요. 잠시 뒤 다시 시도해주세요.",
  AccessDenied: "로그인이 취소됐거나 권한이 없어요.",
  Verification: "로그인 링크가 만료됐어요. 다시 시도해주세요.",
  DesktopLogin: "앱 로그인 시간이 지났어요. 다시 눌러 주세요.",
  OAuthAccountNotLinked:
    "같은 이메일로 이미 다른 방법으로 가입했어요. 처음 쓰던 방법으로 로그인해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; switch?: string }>;
}) {
  const { error, next: rawNext, switch: switchAccount } = await searchParams;
  // 로그인 뒤에 돌아갈 곳. 친구가 보낸 링크를 로그인 전에 열었으면 그 화면이다.
  const next = safeNext(rawNext) ?? "/";

  // 세션만 보고 보내면, 계정이 사라진 세션에서 탭 화면과 서로 튕겨낸다.
  if (await getCurrentUser()) redirect(next);
  const desktop = await isDesktopApp();
  const mobile = await isMobileApp();
  const inApp = !desktop && !mobile && (await isInAppBrowser());

  const message = error
    ? (ERROR_MESSAGES[error] ?? "로그인하지 못했어요. 다시 시도해주세요.")
    : null;

  return (
    // 이름만 덩그러니 있으면 첫 화면이 휑하다. 위아래로 갈라서, 가운데는 브랜드,
    // 아래는 누를 것을 둔다. 손가락이 닿는 곳에 버튼이 오는 배치이기도 하다.
    // 태블릿·넓은 화면은 화면이 길어서, 갈라 두면 로고와 버튼이 너무 멀다. 가운데로 모은다.
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10 md:justify-center md:gap-12 md:pb-0">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center md:flex-none">
        <Logo size={64} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">모도리</h1>
          <p className="mt-2 text-muted">모도리에서 친구들과 함께 매일을 채워가요</p>
        </div>
      </div>

      {/* 버튼들은 한 묶음이다. 넓은 화면의 큰 간격(gap-12)은 로고와 이 묶음 사이에만 들어가야 한다.
          묶지 않으면 버튼 하나하나 사이까지 48px씩 벌어진다. */}
      <div className="flex flex-col gap-3">
        {message && (
          <p
            role="alert"
            className="rounded-2xl bg-surface p-4 text-center text-sm text-danger"
          >
            {message}
          </p>
        )}

        {inApp && (
          <p role="note" className="rounded-2xl bg-surface p-4 text-center text-sm">
            카카오톡 같은 앱 안에서는 Google 로그인이 막혀요. 오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>(크롬·사파리)를 눌러
            주세요.
          </p>
        )}

        {mobile ? (
          // 모바일 앱도 앱 안에서는 Google이 로그인을 막는다. 시스템 로그인 창에서 로그인하고 modori://로 돌아온다.
          <NativeLoginButtons
            providers={[
              { id: "google", label: "Google로 계속하기", primary: true },
              ...(isDataGSMConfigured ? [{ id: "datagsm" as const, label: "DataGSM으로 계속하기", primary: false }] : []),
            ]}
          />
        ) : desktop ? (
          // 앱 창 안에서는 Google이 로그인을 막는다. 버튼은 웹과 같게 두고, 누르면 평소 브라우저에서
          // 그 로그인을 시작한다. 이 주소는 앱(desktop/main.js)이 가로챈다. 웹에서는 보이지 않는 버튼이다.
          <>
            <a
              href="/desktop/start?provider=google"
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-contrast transition-colors hover:bg-brand-hover active:scale-[0.98]"
            >
              Google로 계속하기
            </a>
            {isDataGSMConfigured && (
              <a
                href="/desktop/start?provider=datagsm"
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-surface text-base font-semibold text-foreground transition-colors hover:bg-surface-hover active:scale-[0.98]"
              >
                DataGSM으로 계속하기
              </a>
            )}
            <p className="text-center text-xs text-muted">
              누르면 평소 쓰는 브라우저가 열려요. 로그인을 마치면 앱으로 돌아와요.
            </p>
          </>
        ) : (
          <>
            <form
              action={async () => {
                "use server";
                // 계정을 바꾸러 온 사람(온보딩에서 로그아웃)은 Google이 이전 계정으로 바로 들어가지 않게 계정 선택 창을 띄운다.
                await signIn("google", { redirectTo: next }, switchAccount === "1" ? { prompt: "select_account" } : undefined);
              }}
            >
              <button
                type="submit"
                className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-contrast transition-colors hover:bg-brand-hover active:scale-[0.98]"
              >
                Google로 계속하기
              </button>
            </form>

            {isDataGSMConfigured && (
              <form
                action={async () => {
                  "use server";
                  await signIn("datagsm", { redirectTo: next });
                }}
              >
                <button
                  type="submit"
                  className="h-14 w-full rounded-2xl bg-surface text-base font-semibold text-foreground transition-colors hover:bg-surface-hover active:scale-[0.98]"
                >
                  DataGSM으로 계속하기
                </button>
              </form>
            )}
          </>
        )}

        {isMockAuth && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("mock", {
                email: formData.get("email"),
                redirectTo: next,
              });
            }}
            className="mt-1 flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4"
          >
            <p className="text-sm text-muted">테스트 전용 로그인</p>
            <input
              name="email"
              type="email"
              required
              placeholder="email"
              aria-label="테스트 이메일"
              className="h-11 rounded-xl bg-surface px-3 outline-none ring-border focus:ring-2"
            />
            <button
              type="submit"
              className="h-11 rounded-xl bg-surface-hover text-sm font-medium"
            >
              테스트 로그인
            </button>
          </form>
        )}

        {/* 가입 전에 읽을 수 있어야 한다. */}
        <Link
          href="/privacy"
          prefetch={false}
          className="mt-3 self-center py-2 text-xs text-muted underline underline-offset-4"
        >
          개인정보처리방침
        </Link>
      </div>
    </main>
  );
}
