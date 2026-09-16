import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { saveNickname } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true },
  });
  if (user?.nickname) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          뭐라고 부를까요?
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          친구들이 검색할 때 보이는 이름이다. 나중에 바꿀 수 있다.
        </p>
      </div>

      <form action={saveNickname} className="flex w-full max-w-xs flex-col gap-3">
        <input
          name="nickname"
          type="text"
          maxLength={20}
          required
          autoFocus
          placeholder="닉네임"
          className="h-12 rounded-lg border border-black/10 px-4 dark:border-white/20"
        />
        {error === "length" && (
          <p className="text-sm text-red-600">닉네임은 1~20자로 적어주세요.</p>
        )}
        <button
          type="submit"
          className="h-12 rounded-lg bg-foreground font-medium text-background"
        >
          시작하기
        </button>
      </form>
    </main>
  );
}
