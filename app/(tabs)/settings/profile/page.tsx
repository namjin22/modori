import { DEFAULT_CHARACTER, isCharacterId } from "@/lib/characters";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { ProfileForm } from "@/components/profile-form";
import { BackLink } from "@/components/back-link";

export default async function ProfilePage() {
  const user = await requireUser();

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { nickname: true, profileImage: true, avatarCharacter: true, bio: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">프로필</h1>
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
