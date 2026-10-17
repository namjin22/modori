import Link from "next/link";
import { notFound } from "next/navigation";

import {
  daysBetween,
  endOfMonthKST,
  formatKST,
  formatMonthKST,
  parseKSTDate,
  parseKSTMonth,
  startOfMonthKST,
  todayIn,
} from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { BlockedProfile } from "@/components/blocked-profile";
import { FriendView, type FriendData } from "@/components/friend-view";
import { expandEventRoutines } from "@/lib/event-routine";
import { SafetyMenu } from "@/components/safety-menu";
import { BackLink } from "@/components/back-link";
import { LockedProfile } from "@/components/locked-profile";
import { SubmitButton } from "@/components/submit-button";
import { followUser, unfollowUser } from "../../actions";
import { avatarUrl } from "@/lib/avatar";

function readDate(raw: string | undefined, today: Date): Date {
  if (!raw) return today;

  try {
    return parseKSTDate(raw);
  } catch (error) {
    console.error("[친구] 날짜 형식이 잘못됐다.", error);
    return today;
  }
}

function readMonth(raw: string | undefined, fallback: Date): Date {
  if (!raw) return startOfMonthKST(fallback);

  try {
    return parseKSTMonth(raw);
  } catch (error) {
    console.error("[친구] 월 형식이 잘못됐다.", error);
    return startOfMonthKST(fallback);
  }
}

/**
 * 친구 한 명의 하루. 내 오늘 화면과 같은 구성으로 본다. 프로필, 한 달 달력, 카테고리별로 묶인 할 일.
 * 보이는 달 한 달치를 한 번에 넘겨 달 안의 날짜 이동은 브라우저가 그린다(components/friend-view.tsx).
 *
 * 팔로우한 사람의 공개 카테고리 할 일은 끝냈든 아니든 다 보인다(투두메이트처럼 무엇을 하려는지까지 본다).
 * 반응은 끝낸 일에만 보낸다. 소셜 피드는 끝낸 일만 흐르고, 일정은 보여주지 않는다.
 */
export default async function FriendDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const params_ = await searchParams;

  // 차단 관계. 나를 차단한 사람은 없는 주소처럼, 내가 차단한 사람은 "차단한 사람" 화면(풀기만 가능)을 보인다.
  const [iBlocked, blockedMe] = await Promise.all([
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: id } }, select: { blockedId: true } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: id, blockedId: viewer.id } }, select: { blockerId: true } }),
  ]);
  if (blockedMe) notFound();
  if (iBlocked) {
    const blocked = await prisma.user.findFirst({
      where: { id, nickname: { not: null } },
      select: { id: true, nickname: true, profileImage: true, avatarCharacter: true },
    });
    if (!blocked?.nickname) notFound();
    return <BlockedProfile nickname={blocked.nickname} avatar={avatarUrl(blocked)} targetId={blocked.id} />;
  }

  const friend = await prisma.user.findFirst({
    where: {
      id,
      nickname: { not: null },
      // 팔로우한 사람만 볼 수 있다. 피드와 같은 규칙이다.
      followers: { some: { followerId: viewer.id } },
    },
    select: {
      id: true,
      nickname: true,
      profileImage: true, avatarCharacter: true,
      bio: true,
      // 가입을 마치지 않은(닉네임 없는) 계정은 목록에도 안 나오므로 세지 않는다.
      _count: {
        select: {
          following: { where: { following: { nickname: { not: null } } } },
          followers: { where: { follower: { nickname: { not: null } } } },
        },
      },
    },
  });
  if (!friend) {
    // 팔로우하지 않은 사람이면 없는 주소가 아니라 "팔로우하면 볼 수 있어요" 안내를 보여준다. 자기 자신과 가입 전 계정은 없는 주소다.
    const stranger =
      id === viewer.id
        ? null
        : await prisma.user.findFirst({
            where: { id, nickname: { not: null } },
            select: { id: true, nickname: true, profileImage: true, avatarCharacter: true },
          });
    if (!stranger?.nickname) notFound();
    return (
      <LockedProfile
        nickname={stranger.nickname}
        avatar={avatarUrl(stranger)}
        follow={followUser}
        targetId={stranger.id}
      />
    );
  }

  const today = todayIn(viewer.timezone);
  const date = readDate(params_.date, today);
  const monthStart = readMonth(params_.month, date);
  const monthEnd = endOfMonthKST(monthStart);
  // 받아 둘 기간: 보이는 달, 그리고 달 밖의 날을 골라 둔 경우 그 날까지(홈과 같다).
  const from = daysBetween(date, monthStart) > 0 ? date : monthStart;
  const to = daysBetween(monthEnd, date) > 0 ? date : monthEnd;
  const basePath = `/feed/u/${friend.id}`;

  const [todos, events, eventRoutines, eventSkips] = await Promise.all([
    prisma.todo.findMany({
      where: { category: { isPublic: true }, userId: friend.id, date: { gte: from, lte: to } },
      orderBy: { order: "asc" },
      select: {
        id: true,
        date: true,
        content: true,
        done: true,
        doneAt: true,
        color: true,
        // 메모는 친구가 공개로 켠 것만 내보낸다(아래에서 걸러 비공개 메모는 브라우저로 가지 않는다).
        memo: true,
        memoPublic: true,
        user: { select: { id: true, nickname: true } },
        category: { select: { id: true, name: true, color: true } },
        reactions: {
          select: { emoji: true, userId: true, user: { select: { nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    // 친구가 "친구에게 보이기"를 켠 일정만(2026-10-17). 메모는 메모까지 켠 것만.
    prisma.event.findMany({
      where: { userId: friend.id, isPublic: true, startDate: { lte: to }, endDate: { gte: from } },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { startTime: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, color: true, memo: true, memoPublic: true },
    }),
    prisma.eventRoutine.findMany({
      where: { userId: friend.id, isPublic: true, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
    }),
    prisma.eventRoutineSkip.findMany({
      where: { date: { gte: from, lte: to }, eventRoutine: { userId: friend.id, isPublic: true } },
      select: { eventRoutineId: true, date: true },
    }),
  ]);

  const data: FriendData = {
    friendId: friend.id,
    viewerId: viewer.id,
    today: formatKST(today),
    initialDate: formatKST(date),
    month: formatMonthKST(monthStart),
    from: formatKST(from),
    to: formatKST(to),
    todos: todos.map(({ date: day, doneAt, memo, memoPublic, ...todo }) => ({
      ...todo,
      memo: memoPublic ? memo : null,
      date: formatKST(day),
      doneAt: doneAt?.getTime() ?? null,
    })),
    events: [
      ...events.map(({ memo, memoPublic, ...event }) => ({ ...event, memo: memoPublic ? memo : null })),
      ...expandEventRoutines(eventRoutines, eventSkips, from, to).map((event) => ({ ...event, memo: null })),
    ],
  };

  return (
    <FriendView
      data={data}
      profile={
        <div className="flex items-center gap-3">
          <BackLink href="/feed" label="소셜로" />
          <Avatar src={avatarUrl(friend)} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{friend.nickname}</h1>
            {friend.bio && <p className="truncate text-sm text-muted">{friend.bio}</p>}
            {/* 좁은 화면에서는 줄이 바뀌어 버튼이 다음 줄로 내려간다. 글자가 한 글자씩 꺾이지 않게 각 조각은 한 덩어리로 둔다. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <Link prefetch={false} href={`${basePath}/following`} className="whitespace-nowrap hover:text-foreground">
                팔로우 <b className="font-semibold text-foreground">{friend._count.following}</b>
              </Link>
              <Link prefetch={false} href={`${basePath}/followers`} className="whitespace-nowrap hover:text-foreground">
                팔로워 <b className="font-semibold text-foreground">{friend._count.followers}</b>
              </Link>
              {/* 이미 팔로우한 사람이라 여기서 바로 끊을 수 있다. 끊으면 이 화면이 팔로우 안내로 바뀐다. */}
              <form action={unfollowUser}>
                <input type="hidden" name="targetId" value={friend.id} />
                <SubmitButton pendingLabel="처리 중" className="h-7 whitespace-nowrap rounded-full bg-surface px-3 text-xs font-medium text-muted">
                  언팔로우
                </SubmitButton>
              </form>
            </div>
          </div>
          <SafetyMenu targetId={friend.id} nickname={friend.nickname ?? ""} />
        </div>
      }
    />
  );
}
