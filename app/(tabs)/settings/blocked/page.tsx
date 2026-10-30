import type { Metadata } from "next";

import { listBlocked } from "@/app/(tabs)/feed/safety-actions";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";
import { UnblockButton } from "@/components/unblock-button";
import { avatarUrl } from "@/lib/avatar";
import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(settings))("blockedPageTitle") };
}

export default async function BlockedPage() {
  const t = await getT(settings);
  const rows = await listBlocked();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label={t("toMyPage")} />
        <h1 className="text-2xl font-bold">{t("blockedHeading")}</h1>
      </header>

      {rows.length === 0 ? (
        <DoriMessage mood="calm">
          <p>{t("noBlocked")}</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ blocked }) => (
            <li key={blocked.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={avatarUrl(blocked)} size={36} />
                <span className="truncate font-medium">{blocked.nickname}</span>
              </span>
              <UnblockButton targetId={blocked.id} small />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
