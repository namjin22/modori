import { redirect } from "next/navigation";

import { Dori } from "@/components/dori";
import { isDataGSMConfigured, isMockAuth, signIn } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

// Auth.js가 붙여 보내는 오류 코드. 사람이 읽을 말로 바꾼다.
// 모르는 코드는 일반 안내로 받는다.
const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "로그인 설정에 문제가 있어요. 잠시 뒤 다시 시도해주세요.",
  AccessDenied: "로그인이 취소됐거나 권한이 없어요.",
  Verification: "로그인 링크가 만료됐어요. 다시 시도해주세요.",
  OAuthAccountNotLinked:
    "같은 이메일로 이미 다른 방법으로 가입했어요. 처음 쓰던 방법으로 로그인해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 세션만 보고 보내면, 계정이 사라진 세션에서 탭 화면과 서로 튕겨낸다.
  if (await getCurrentUser()) redirect("/");

  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? "로그인하지 못했어요. 다시 시도해주세요.")
    : null;

  return (
    // 이름만 덩그러니 있으면 첫 화면이 휑하다. 위아래로 갈라서, 가운데는 브랜드,
    // 아래는 누를 것을 둔다. 손가락이 닿는 곳에 버튼이 오는 배치이기도 하다.
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Dori mood="hello" size={120} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">모도리</h1>
          <p className="mt-2 text-muted">오늘 할 일을 색으로 남겨요</p>
        </div>
      </div>

      {message && (
        <p
          role="alert"
          className="mb-4 rounded-2xl bg-surface p-4 text-center text-sm text-red-500"
        >
          {message}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
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
            await signIn("datagsm", { redirectTo: "/" });
          }}
          className="mt-3"
        >
          <button
            type="submit"
            className="h-12 w-full rounded-2xl bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover active:scale-[0.98]"
          >
            DataGSM으로 계속하기
          </button>
        </form>
      )}

      {isMockAuth && (
        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("mock", {
              email: formData.get("email"),
              redirectTo: "/",
            });
          }}
          className="mt-4 flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4"
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
    </main>
  );
}
