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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div>
        <h1 className="text-2xl font-bold">뭐라고 부를까요?</h1>
        <p className="mt-2 text-muted">
          친구들이 검색할 때 보이는 이름이다. 나중에 바꿀 수 있다.
        </p>
      </div>

      <form action={saveNickname} className="flex flex-col gap-3">
        <input
          name="nickname"
          type="text"
          maxLength={20}
          required
          autoFocus
          placeholder="닉네임"
          className="h-14 rounded-2xl bg-surface px-4 text-base outline-none ring-border focus:ring-2"
        />
        {error === "length" && (
          <p className="text-sm text-red-500">닉네임은 1~20자로 적어주세요.</p>
        )}
        <button
          type="submit"
          className="h-14 rounded-2xl bg-brand text-base font-semibold text-brand-contrast transition-colors hover:bg-brand-hover"
        >
          시작하기
        </button>
      </form>
    </main>
  );
}
