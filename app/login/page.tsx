import { redirect } from "next/navigation";

import { auth, isMockAuth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div>
        <h1 className="text-3xl font-bold">모도리</h1>
        <p className="mt-2 text-muted">오늘 할 일을 색으로 남긴다</p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-contrast transition-colors hover:bg-brand-hover"
        >
          Google로 계속하기
        </button>
      </form>

      {isMockAuth && (
        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("mock", {
              email: formData.get("email"),
              redirectTo: "/",
            });
          }}
          className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4"
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
