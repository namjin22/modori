import { DEFAULT_CHARACTER, isCharacterId } from "@/lib/characters";
import { profile as profileMessages } from "@/lib/i18n/messages/profile";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { ProfileForm } from "@/components/profile-form";
import { BackLink } from "@/components/back-link";

/**
 * 프로필 수정. 마이페이지의 프로필 줄과 피드의 내 프로필(?from=feed) 두 곳에서 들어온다. 뒤로가기는 들어온 곳으로 돌아간다(2026-11-16 신고).
 * from은 "feed"일 때만 믿고, 그 밖의 값은 무시해 마이페이지로 둔다.
 */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const fromFeed = (await searchParams).from === "feed";
  const user = await requireUser();
  const t = await getT(profileMessages);

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { nickname: true, profileImage: true, avatarCharacter: true, bio: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href={fromFeed ? "/" : "/settings"} label={fromFeed ? t("backToFeed") : t("backToMyPage")} />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>

      <section className="rounded-2xl bg-surface p-5">
        <ProfileForm
          nickname={profile.nickname ?? ""}
          profileImage={profile.profileImage}
          avatarCharacter={isCharacterId(profile.avatarCharacter) ? profile.avatarCharacter : DEFAULT_CHARACTER}
          bio={profile.bio ?? ""}
        />
      </section>

    </div>
  );
}
