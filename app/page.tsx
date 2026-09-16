import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true, profileEmoji: true },
  });
  if (!user?.nickname) redirect("/onboarding");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <p className="text-xl">
        {user.profileEmoji} {user.nickname}
      </p>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
