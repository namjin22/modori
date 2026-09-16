import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true },
  });
  if (user?.nickname) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div>
        <h1 className="text-2xl font-bold">뭐라고 부를까요?</h1>
        <p className="mt-2 text-muted">
          친구들이 검색할 때 보이는 이름이다. 나중에 바꿀 수 있다.
        </p>
      </div>

      <OnboardingForm />
    </main>
  );
}
