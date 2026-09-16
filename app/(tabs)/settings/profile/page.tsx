import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const user = await requireUser();

  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { nickname: true, profileEmoji: true, bio: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="설정으로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">프로필</h1>
      </header>

      <section className="rounded-2xl bg-surface p-5">
        <ProfileForm
          nickname={profile.nickname ?? ""}
          profileEmoji={profile.profileEmoji}
          bio={profile.bio ?? ""}
        />
      </section>

      <p className="text-xs text-muted">
        닉네임과 이모지는 친구들이 보는 이름이다. 소개는 아직 화면에 쓰이지 않지만
        나중에 프로필에 보인다.
      </p>
    </div>
  );
}
