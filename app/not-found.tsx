import Link from "next/link";

import { Dori } from "@/components/dori";
import { errors } from "@/lib/i18n/messages/errors";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT(errors);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <Dori mood="confused" size={110} className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("notFoundBody")}</p>
      </div>

      <Link prefetch={false}
        href="/"
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {t("toToday")}
      </Link>
    </main>
  );
}
