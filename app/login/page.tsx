import { redirect } from "next/navigation";

import { auth, isMockAuth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">모도리</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          오늘 할 일을 색으로 남긴다
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="h-12 rounded-full border border-black/10 px-6 font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
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
          className="flex w-full max-w-xs flex-col gap-2 border-t border-dashed border-black/20 pt-6 dark:border-white/20"
        >
          <p className="text-sm text-zinc-500">테스트 전용 로그인</p>
          <input
            name="email"
            type="email"
            required
            placeholder="email"
            aria-label="테스트 이메일"
            className="h-10 rounded border border-black/10 px-3 dark:border-white/20"
          />
          <button type="submit" className="h-10 rounded border border-black/10 dark:border-white/20">
            테스트 로그인
          </button>
        </form>
      )}
    </main>
  );
}
