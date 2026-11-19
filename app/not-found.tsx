import Link from "next/link";

import { Dori } from "@/components/dori";
import { ErrorScreen } from "@/components/error-screen";
import { errors } from "@/lib/i18n/messages/errors";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT(errors);
  return (
    <ErrorScreen code="404" title={t("notFoundTitle")} body={t("notFoundBody")} mascot={<Dori mood="confused" size={110} className="mx-auto" />}>
      <Link prefetch={false}
        href="/"
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-brand-contrast"
      >
        {t("toToday")}
      </Link>
    </ErrorScreen>
  );
}
