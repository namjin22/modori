import Link from "next/link";

import { DoriMessage } from "@/components/dori-message";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { SubmitButton } from "@/components/submit-button";

import { unfollowUser } from "../actions";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { avatarUrl } from "@/lib/avatar";
import { social } from "@/lib/i18n/messages/social";
import { getT } from "@/lib/i18n/server";

export default async function FollowingPage() {
  const user = await requireUser();
  const t = await getT(social);

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      following: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label={t("toSocial")} />
        <h1 className="text-2xl font-bold">{t("followingTitle")}</h1>
      </header>

      {following.length === 0 ? (
        <DoriMessage mood="hello">
          <p>{t("noFollowing")}</p>
          <Link prefetch={false} href="/feed/search" className="mt-1 inline-block text-brand">
            {t("searchByNickname")}
          </Link>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {following.map(({ following: person }) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4"
            >
              <Link prefetch={false}
                href={`/feed/u/${person.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar src={avatarUrl(person)} size={36} />
                <span className="truncate font-medium">{person.nickname}</span>
              </Link>

              <form action={unfollowUser}>
                <input type="hidden" name="targetId" value={person.id} />
                <SubmitButton
                  pendingLabel={t("working")}
                  className="h-9 rounded-full bg-surface-hover px-4 text-sm text-muted"
                >
                  {t("unfollow")}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
