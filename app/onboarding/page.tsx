import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import { Dori } from "@/components/dori";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.nickname) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div>
        <Dori mood="hello" size={88} className="-ml-2 mb-2" />
        <h1 className="text-2xl font-bold">뭐라고 부를까요?</h1>
        <p className="mt-2 text-muted">
          친구가 나를 찾을 때 쓰는 이름이에요. 나중에 바꿔도 돼요.
        </p>
      </div>

      <OnboardingForm />
    </main>
  );
}
