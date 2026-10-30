import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DesktopNotifySwitch } from "@/components/desktop-notify-switch";
import { DoriMessage } from "@/components/dori-message";
import { FriendDoneSwitch } from "@/components/friend-done-switch";
import { MarkNotificationsSeen, NewMark, NotificationRow } from "@/components/notifications-seen";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";
import { dateIn } from "@/lib/date";
import { friendDoneWhere } from "@/lib/friend-done";
import { formatMonthDay } from "@/lib/i18n/format";
import { reactions as reactionMessages } from "@/lib/i18n/messages/reactions";
import { getLocale, getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { labelOfReaction } from "@/lib/reactions";
import { requireUser } from "@/lib/session";

import { followUser } from "../actions";

/** 제목은 화면 언어를 따른다. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(reactionMessages))("pageTitle") };
}

const MAX_ITEMS = 50;
// 친구가 끝낸 일은 묶기 전에 이만큼만 받는다. 묶으면 줄 수는 훨씬 적다.
const MAX_DONE_TODOS = 200;

type DoneTodo = {
  content: string;
  doneAt: Date | null;
  user: { id: string; nickname: string | null; profileImage: string | null; avatarCharacter: string | null };
};

/** 친구가 끝낸 일을 친구·날짜(내 시간대)마다 묶는다. 목록은 끝낸 시각 내림차순으로 와서, 묶음의 첫 일이 가장 최근 것이다. */
function groupFriendDone(todos: DoneTodo[], timezone: string) {
  const groups = new Map<string, { key: string; friend: DoneTodo["user"]; day: Date; at: Date; latest: string; count: number }>();
  for (const todo of todos) {
    if (!todo.doneAt) continue;
    const day = dateIn(todo.doneAt, timezone);
    const key = `${todo.user.id}:${day.getTime()}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { key, friend: todo.user, day, at: todo.doneAt, latest: todo.content, count: 1 });
  }
  return [...groups.values()];
}

/**
 * 알림: 친구가 내 할 일에 보낸 반응, 나를 새로 팔로우한 사람, 친구가 끝낸 할 일(2026-10-17)을 시간순으로 모은다.
 * 친구가 끝낸 일은 친구·날짜마다 한 줄로 묶는다(하나씩 늘어놓으면 반응·팔로우 알림이 묻힌다).
 * 주소는 예전 이름(받은 반응) 그대로 둔다. 하단 탭 뱃지가 여기로 온다.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  const t = await getT(reactionMessages);
  const locale = await getLocale();

  // 이 화면을 그린 시각이 "읽음" 기준이다. 목록보다 먼저 잡아, 그 사이에 온 알림을 읽은 것으로 치지 않는다.
  const lastSeenAt = user.lastSeenAt;
  const renderedAt = new Date();

  const [reactions, follows, myFollowing, friendDone] = await Promise.all([
    prisma.reaction.findMany({
      where: { todoUserId: user.id, userId: { not: user.id } },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      include: {
        user: { select: { nickname: true } },
        todo: { select: { content: true, date: true } },
      },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      select: {
        createdAt: true,
        follower: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } },
      },
    }),
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    // 친구 끝냄 알림을 끈 사람에게는 묻지도 보이지도 않는다(위의 스위치).
    user.notifyFriendDone
      ? prisma.todo.findMany({
          where: friendDoneWhere(user.id),
          orderBy: { doneAt: "desc" },
          take: MAX_DONE_TODOS,
          select: {
            content: true,
            doneAt: true,
            user: { select: { id: true, nickname: true, profileImage: true, avatarCharacter: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const doneGroups = groupFriendDone(friendDone, user.timezone);
  const following = new Set(myFollowing.map((follow) => follow.followingId));

  // 두 종류를 한 줄로 세운다. 가장 최근 것이 위.
  const items = [
    ...reactions.map((reaction) => ({ kind: "reaction" as const, at: reaction.createdAt, reaction })),
    ...follows.map((follow) => ({ kind: "follow" as const, at: follow.createdAt, follow })),
    ...doneGroups.map((done) => ({ kind: "done" as const, at: done.at, done })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_ITEMS);

  // 응답을 보내기 전에 남긴다. 화면을 열자마자 떠나도 읽은 것으로 친다. updateMany를 쓰는 이유는 그 사이 계정이
  // 사라져도 화면 전체가 죽지 않게 하려는 것이다(update는 대상이 없으면 던진다).
  await prisma.user.updateMany({
    where: { id: user.id, lastSeenAt: { lt: renderedAt } },
    data: { lastSeenAt: renderedAt },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 링크로 오갈 때는 탭 공통 레이아웃(아래 탭의 알림 수)이 다시 그려지지 않는다. 화면이 뜬 뒤 액션으로 다시 그리게 한다. */}
      <MarkNotificationsSeen renderedAt={renderedAt.toISOString()} />
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label={t("toSocial")} />
        <h1 className="text-2xl font-bold">{t("notificationsTitle")}</h1>
      </header>

      {/* 친구가 끝낸 일은 많이 쌓일 수 있어 여기서 바로 끄고 켠다(2026-10-18 요청). 반응·팔로우 알림은 그대로다. */}
      <section aria-label={t("settingsLabel")} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <FriendDoneSwitch on={user.notifyFriendDone} />
        {/* 웹·데스크톱 창의 컴퓨터 알림(2026-10-19 요청). 알림을 띄울 수 없는 곳(모바일 앱)에서는 그리지 않는다. */}
        <DesktopNotifySwitch userId={user.id} />
      </section>

      {items.length === 0 ? (
        <DoriMessage mood="calm">
          <p>{t("emptyTitle")}</p>
          <p className="text-xs">{t("emptyBody")}</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isNew = item.at > lastSeenAt;
            const newMark = <NewMark isNew={isNew} />;

            if (item.kind === "done") {
              const { done } = item;
              return (
                <NotificationRow key={`done-${done.key}`} isNew={isNew}>
                  <Link prefetch={false} href={`/feed/u/${done.friend.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={avatarUrl(done.friend)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {done.count > 1 ? t("doneMany", { nickname: done.friend.nickname ?? "", count: done.count }) : t("doneOne", { nickname: done.friend.nickname ?? "" })}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {done.latest}
                        {done.count > 1 && t("doneMore", { count: done.count - 1 })} · {formatMonthDay(locale, done.day)}
                      </p>
                    </div>
                  </Link>
                  {newMark}
                </NotificationRow>
              );
            }

            if (item.kind === "follow") {
              const person = item.follow.follower;
              return (
                <NotificationRow key={`follow-${person.id}`} isNew={isNew}>
                  <Avatar src={avatarUrl(person)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{person.nickname}</p>
                    <p className="truncate text-xs text-muted">
                      {t("followedMe")} · {formatMonthDay(locale, dateIn(item.at, user.timezone))}
                    </p>
                  </div>
                  {newMark}
                  {/* 아직 팔로우하지 않은 사람이면 그 자리에서 맞팔로우한다. */}
                  {!following.has(person.id) && (
                    <form action={followUser} className="shrink-0">
                      <input type="hidden" name="targetId" value={person.id} />
                      <SubmitButton
                        pendingLabel={t("working")}
                        className="h-8 rounded-full bg-brand px-3 text-xs font-semibold text-brand-contrast"
                      >
                        {t("followBack")}
                      </SubmitButton>
                    </form>
                  )}
                </NotificationRow>
              );
            }

            const { reaction } = item;
            return (
              <NotificationRow key={reaction.id} isNew={isNew}>
                <span
                  role="img"
                  aria-label={labelOfReaction(reaction.emoji, locale)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xl"
                >
                  <ReactionGlyph value={reaction.emoji} size={30} />
                </span>
                {/* 좁은 폰에서 이름과 할 일을 한 줄에 두면 둘 다 몇 글자만 남는다. 두 줄로 나눈다. */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{reaction.user.nickname}</p>
                  <p className="truncate text-xs text-muted">
                    {reaction.todo.content} · {formatMonthDay(locale, reaction.todo.date)}
                  </p>
                </div>
                {newMark}
              </NotificationRow>
            );
          })}
        </ul>
      )}
    </div>
  );
}
