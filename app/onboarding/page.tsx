import { redirect } from "next/navigation";

import { auth } from "@/lib/i18n/messages/auth";
import { getT } from "@/lib/i18n/server";
import { loginHref, safeNext } from "@/lib/next-path";
import { getCurrentUser } from "@/lib/session";

import { Dori } from "@/components/dori";
import { OnboardingForm } from "@/components/onboarding-form";

import { leaveOnboarding } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(next));
  if (user.nickname) redirect(next ?? "/");
  const t = await getT(auth);

  return (
    // 한 화면에 몰아 넣지 않고 위아래 여백을 넉넉히 둔다. 길면 스크롤한다. 위가 화면 끝에 붙지 않게 py를 둔다.
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-14 px-6 py-14">
      {/* 가입을 마치지 않은 계정은 다른 화면으로 못 간다. 잘못 고른 계정에서 빠져나오는 길을 맨 위에도 둔다(아래에도 있다). */}
      <form action={leaveOnboarding} className="-mb-6 flex justify-end">
        <button type="submit" className="h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-foreground">
          {t("leaveTop")}
        </button>
      </form>

      <div>
        <Dori mood="hello" size={88} className="-ml-2 mb-4" />
        <h1 className="text-2xl font-bold">{t("onboardingTitle")}</h1>
        <p className="mt-4 text-muted">{t("onboardingBody")}</p>
      </div>

      <OnboardingForm next={next} />

      {/* 가입을 마치지 않은 계정은 다른 화면으로 못 간다. 잘못 고른 계정에서 빠져나오는 길을 둔다. */}
      <form action={leaveOnboarding} className="flex flex-col items-center gap-2 pt-2 text-center">
        <p className="text-xs text-muted">{t("notYourAccount")}</p>
        <button type="submit" className="h-10 rounded-xl px-4 text-sm font-semibold text-brand underline-offset-4 hover:underline">
          {t("leaveBottom")}
        </button>
      </form>
    </main>
  );
}
