import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { UnblockButton } from "@/components/unblock-button";
import { social } from "@/lib/i18n/messages/social";
import { getT } from "@/lib/i18n/server";

/** 내가 차단한 사람의 화면. 할 일은 보이지 않고, 차단을 풀 수만 있다. */
export async function BlockedProfile({ nickname, avatar, targetId }: { nickname: string; avatar: string | null; targetId: string }) {
  const t = await getT(social);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label={t("toSocial")} />
      </header>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-10 text-center">
        <Avatar src={avatar} size={72} />
        <h1 className="text-xl font-bold">{nickname}</h1>
        <p className="max-w-xs text-sm text-muted text-balance">{t("blockedBody")}</p>
        <UnblockButton targetId={targetId} />
      </div>
    </div>
  );
}
