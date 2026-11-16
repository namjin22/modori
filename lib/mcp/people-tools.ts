import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { alarmSentOnWhenSet, isAlarmMinute } from "@/lib/alarm";
import { notBlockedWith } from "@/lib/blocks";
import { isCharacterId } from "@/lib/characters";
import { expandEventRoutines } from "@/lib/event-routine";
import { formatTime } from "@/lib/event-time";
import { MCP_LIMITS } from "@/lib/mcp/inputs";
import { dayText, fail, isRange, ok, readRange, socialLimited, writeLimited, type McpContext, type ToolResult } from "@/lib/mcp/shared";
import { isNicknameTaken, normalizeNickname, validateNickname } from "@/lib/nickname";
import { followNotice, reactionNotice } from "@/lib/notices";
import { prisma } from "@/lib/prisma";
import { sendPushToUser, shouldNotify } from "@/lib/push";
import { isReactionValue } from "@/lib/reactions";
import { isAllowedTimezone } from "@/lib/timezones";

/**
 * 프로필·설정·친구·반응과, 토큰을 만든 사람이 허락했을 때 친구의 공개 할 일·일정을 읽는 도구.
 * 프로필·설정·팔로우·반응은 모든 권한(FULL) 토큰만, 사람 찾기·목록·내 프로필 읽기는 읽기 토큰도 쓴다.
 * 서버 액션(app/(tabs)/settings/profile/actions.ts, settings/actions.ts, feed/actions.ts)과 같은 규칙이다.
 *
 * 친구의 할 일·일정은 모도리 안에서 팔로우한 사람 누구에게나 보이는 만큼만(공개 카테고리의 할 일, "친구에게 보이기"를 켠 일정,
 * 공개로 켠 메모) 읽힌다. 그래도 그 친구가 고른 것은 "모도리 안의 팔로워에게 보이기"이지 "내 팔로워가 고른 AI 서비스로 보내기"가
 * 아니므로, 토큰마다 따로 켜야 한다(ApiToken.allowFriends, 기본 꺼짐).
 */
const PEOPLE_LIMIT = 200;
const SEARCH_LIMIT = 20;

export async function getProfile(ctx: McpContext): Promise<ToolResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: {
      nickname: true,
      bio: true,
      avatarCharacter: true,
      locale: true,
      timezone: true,
      notifyFriendDone: true,
      hideFromRecommend: true,
      eventDigestMinute: true,
      _count: {
        select: {
          following: { where: { following: { nickname: { not: null } } } },
          followers: { where: { follower: { nickname: { not: null } } } },
        },
      },
    },
  });
  return ok({
    nickname: user.nickname,
    bio: user.bio,
    avatarCharacter: user.avatarCharacter,
    locale: user.locale,
    timezone: user.timezone,
    notifyFriendDone: user.notifyFriendDone,
    hideFromRecommend: user.hideFromRecommend,
    eventDigestMinute: user.eventDigestMinute,
    eventDigestTime: user.eventDigestMinute === null ? null : formatTime(user.eventDigestMinute),
    following: user._count.following,
    followers: user._count.followers,
  });
}

export async function updateProfile(ctx: McpContext, input: { nickname?: string; bio?: string; avatarCharacter?: string }): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;
  if (input.nickname === undefined && input.bio === undefined && input.avatarCharacter === undefined) return fail("Give at least one of nickname, bio or avatarCharacter.");

  const data: Prisma.UserUpdateInput = {};
  if (input.nickname !== undefined) {
    const nickname = normalizeNickname(input.nickname);
    if (!validateNickname(nickname).ok) return fail("Nickname must be 1 to 20 characters.");
    if (await isNicknameTaken(nickname, ctx.userId)) return fail("That nickname is already taken.");
    data.nickname = nickname;
  }
  if (input.bio !== undefined) data.bio = input.bio ? input.bio : null;
  if (input.avatarCharacter !== undefined) {
    if (!isCharacterId(input.avatarCharacter)) return fail("Unknown avatarCharacter.");
    data.avatarCharacter = input.avatarCharacter;
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { nickname: true, bio: true, avatarCharacter: true } });
  try {
    await prisma.user.update({ where: { id: ctx.userId }, data });
  } catch (error) {
    // 같은 순간에 같은 이름으로 둘이 저장하면 여기서 걸린다.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("That nickname is already taken.");
    throw error;
  }
  revalidatePath("/settings");
  revalidatePath("/feed");
  return ok({ previous: before, now: { nickname: data.nickname ?? before.nickname, bio: "bio" in data ? data.bio : before.bio, avatarCharacter: data.avatarCharacter ?? before.avatarCharacter } });
}

type SettingsInput = { timezone?: string; notifyFriendDone?: boolean; hideFromRecommend?: boolean; eventDigestMinute?: number | null };

export async function updateSettings(ctx: McpContext, input: SettingsInput): Promise<ToolResult> {
  const limited = writeLimited(ctx);
  if (limited) return limited;
  if (Object.values(input).every((value) => value === undefined)) return fail("Give at least one setting to change.");
  if (input.timezone !== undefined && !isAllowedTimezone(input.timezone)) return fail("Unknown timezone. Use an IANA name from the app's list, e.g. Asia/Seoul.");
  if (typeof input.eventDigestMinute === "number" && !isAlarmMinute(input.eventDigestMinute)) return fail("eventDigestMinute must be minutes after midnight in steps of 5 (360 = 06:00), or null.");

  const before = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { timezone: true, notifyFriendDone: true, hideFromRecommend: true, eventDigestMinute: true },
  });
  const timezone = input.timezone ?? before.timezone;
  await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.notifyFriendDone !== undefined && { notifyFriendDone: input.notifyFriendDone }),
      ...(input.hideFromRecommend !== undefined && { hideFromRecommend: input.hideFromRecommend }),
      // 오늘의 그 시각이 이미 지났으면 오늘 몫은 보낸 것으로 쳐서, 고르자마자 알림이 울리지 않게 한다(서버 액션 setEventDigest와 같다).
      ...(input.eventDigestMinute !== undefined && {
        eventDigestMinute: input.eventDigestMinute,
        eventDigestSentOn: input.eventDigestMinute === null ? null : alarmSentOnWhenSet(input.eventDigestMinute, timezone, new Date()),
      }),
    },
  });
  revalidatePath("/", "layout");
  return ok({
    previous: before,
    now: {
      timezone,
      notifyFriendDone: input.notifyFriendDone ?? before.notifyFriendDone,
      hideFromRecommend: input.hideFromRecommend ?? before.hideFromRecommend,
      eventDigestMinute: input.eventDigestMinute === undefined ? before.eventDigestMinute : input.eventDigestMinute,
    },
  });
}

export async function searchUsers(ctx: McpContext, input: { query: string }): Promise<ToolResult> {
  // 닉네임과 같은 규칙으로 정리한다(친구 찾기 화면과 같다).
  const query = normalizeNickname(input.query).slice(0, 20);
  if (!query) return fail("query is empty.");
  const [users, following] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: ctx.userId }, nickname: { contains: query, mode: "insensitive" }, ...notBlockedWith(ctx.userId) },
      orderBy: { nickname: "asc" },
      take: SEARCH_LIMIT,
      // 소개는 팔로우한 사람의 화면에서만 보인다(친구 찾기에는 닉네임과 사진뿐). 팔로우하지 않은 사람의 소개는 내보내지 않는다.
      select: { id: true, nickname: true },
    }),
    prisma.follow.findMany({ where: { followerId: ctx.userId }, select: { followingId: true } }),
  ]);
  const followingIds = new Set(following.map((row) => row.followingId));
  return ok({ users: users.map((user) => ({ nickname: user.nickname, following: followingIds.has(user.id) })) });
}

export async function listPeople(ctx: McpContext, input: { kind: "following" | "followers" }): Promise<ToolResult> {
  const mine = input.kind === "following" ? { followerId: ctx.userId } : { followingId: ctx.userId };
  const other = input.kind === "following" ? "following" : "follower";
  const rows = await prisma.follow.findMany({
    where: { ...mine, [other]: { nickname: { not: null }, ...notBlockedWith(ctx.userId) } },
    orderBy: [{ createdAt: "desc" }],
    take: PEOPLE_LIMIT + 1,
    select: { following: { select: { nickname: true } }, follower: { select: { nickname: true } } },
  });
  return ok({
    truncated: rows.length > PEOPLE_LIMIT,
    people: rows.slice(0, PEOPLE_LIMIT).map((row) => {
      const person = input.kind === "following" ? row.following : row.follower;
      return { nickname: person.nickname };
    }),
  });
}

/** 닉네임으로 사람을 찾는다. 나·가입을 마치지 않은 계정·차단 관계인 사람은 없는 사람으로 친다(친구 찾기와 같다). */
async function findPerson(ctx: McpContext, rawNickname: string): Promise<{ id: string; nickname: string } | null> {
  const nickname = normalizeNickname(rawNickname);
  if (!nickname) return null;
  const person = await prisma.user.findFirst({
    where: { id: { not: ctx.userId }, nickname: { equals: nickname, mode: "insensitive" }, ...notBlockedWith(ctx.userId) },
    select: { id: true, nickname: true },
  });
  return person?.nickname ? { id: person.id, nickname: person.nickname } : null;
}

const noOne = (nickname: string) => fail(`No user with the nickname "${nickname}" (check search_users).`);

export async function followUser(ctx: McpContext, input: { nickname: string }): Promise<ToolResult> {
  const limited = socialLimited(ctx);
  if (limited) return limited;
  const target = await findPerson(ctx, input.nickname);
  if (!target) return noOne(input.nickname);

  // 새 친구는 친구 줄의 맨 앞에 둔다(서버 액션 followUser와 같다).
  const first = await prisma.follow.aggregate({ where: { followerId: ctx.userId }, _min: { sortOrder: true } });
  const created = await prisma.follow.createMany({
    data: [{ followerId: ctx.userId, followingId: target.id, sortOrder: Math.min(0, first._min.sortOrder ?? 0) - 1 }],
    skipDuplicates: true,
  });
  // 새로 팔로우했을 때만, 같은 사람에게 10분에 한 번만 알린다. 응답은 알림을 기다리지 않는다.
  if (created.count > 0 && shouldNotify(`follow:${ctx.userId}:${target.id}`)) {
    after(() =>
      sendPushToUser(target.id, (locale) => ({ ...followNotice(locale, ctx.nickname), url: "/feed/followers", tag: `follow:${ctx.userId}` })).catch((error) =>
        console.error("[push] 팔로우 알림을 보내지 못했다.", error),
      ),
    );
  }
  revalidatePath("/feed", "layout");
  revalidatePath("/settings");
  return ok({ following: target.nickname, alreadyFollowing: created.count === 0 });
}

export async function unfollowUser(ctx: McpContext, input: { nickname: string }): Promise<ToolResult> {
  const limited = socialLimited(ctx);
  if (limited) return limited;
  const nickname = normalizeNickname(input.nickname);
  // 차단한 사람도 팔로우를 끊을 수 있어야 해서 차단 조건을 걸지 않는다.
  const removed = await prisma.follow.deleteMany({ where: { followerId: ctx.userId, following: { nickname: { equals: nickname, mode: "insensitive" } } } });
  revalidatePath("/feed", "layout");
  revalidatePath("/settings");
  return ok({ unfollowed: removed.count > 0, nickname });
}

export async function removeFollower(ctx: McpContext, input: { nickname: string }): Promise<ToolResult> {
  const limited = socialLimited(ctx);
  if (limited) return limited;
  const nickname = normalizeNickname(input.nickname);
  // 서버 액션 removeFollower와 같다: 그 사람은 더 이상 내 할 일을 보지 못하고 반응도 못 보낸다. 다시 팔로우하는 것은 막지 않는다(차단이 아니다).
  const removed = await prisma.follow.deleteMany({ where: { followingId: ctx.userId, follower: { nickname: { equals: nickname, mode: "insensitive" } } } });
  revalidatePath("/feed", "layout");
  revalidatePath("/settings");
  return ok({ removed: removed.count > 0, nickname });
}

export async function setReaction(ctx: McpContext, input: { todoId: string; emoji: string; on?: boolean }): Promise<ToolResult> {
  const limited = socialLimited(ctx);
  if (limited) return limited;
  if (!isReactionValue(input.emoji)) return fail("That is not one of the app's reaction emoji.");

  const mine = await prisma.reaction.findFirst({ where: { userId: ctx.userId, todoId: input.todoId, emoji: input.emoji }, select: { id: true } });
  if (input.on === false) {
    // 내가 이미 보낸 반응은 언팔로우·비공개 전환 뒤에도 취소할 수 있다.
    if (mine) await prisma.reaction.deleteMany({ where: { id: mine.id } });
    revalidatePath("/feed", "layout");
    return ok({ reacted: false, removed: mine !== null });
  }
  if (mine) return ok({ reacted: true, alreadyReacted: true });

  // 서버 액션 toggleReaction과 같다: 팔로우한 사람의, 끝낸, 공개 카테고리 할 일에만 반응할 수 있다.
  const todo = await prisma.todo.findFirst({
    where: { id: input.todoId, done: true, category: { isPublic: true }, user: { followers: { some: { followerId: ctx.userId } } } },
    select: { id: true, userId: true },
  });
  if (!todo) return fail("You can only react to a finished todo of someone you follow, in a category that is visible to followers.");

  try {
    await prisma.reaction.create({ data: { userId: ctx.userId, todoId: todo.id, todoUserId: todo.userId, emoji: input.emoji } });
  } catch (error) {
    // 같은 순간에 두 번 보내 먼저 온 요청이 이미 만들었다. 결과는 같으니 넘긴다.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return ok({ reacted: true, alreadyReacted: true });
    throw error;
  }
  // 같은 할 일에 이 사람의 첫 반응일 때만, 같은 사람에게 10분에 한 번만 알린다.
  const count = await prisma.reaction.count({ where: { userId: ctx.userId, todoId: todo.id } });
  if (count === 1 && shouldNotify(`reaction:${ctx.userId}:${todo.userId}`)) {
    after(() =>
      sendPushToUser(todo.userId, (locale) => ({ ...reactionNotice(locale, ctx.nickname), url: "/feed/reactions", tag: `reaction:${todo.id}` })).catch((error) =>
        console.error("[push] 반응 알림을 보내지 못했다.", error),
      ),
    );
  }
  revalidatePath("/feed", "layout");
  return ok({ reacted: true });
}

const needFriends = "Reading friends' todos and events is off for this token. The user can create a token with that option turned on in modori (My page > Settings > AI connection).";

/** 친구의 공개 정보를 읽는 도구의 공통 앞부분: 허락·기간·사람·팔로우를 확인한다. 통과하면 친구와 기간을, 아니면 돌려줄 오류를 준다. */
type FriendTarget =
  | { error: ToolResult; friend?: undefined; range?: undefined }
  | { error?: undefined; friend: { id: string; nickname: string }; range: { from: Date; to: Date } };

async function friendTarget(ctx: McpContext, input: { nickname: string; from: string; to?: string }): Promise<FriendTarget> {
  if (!ctx.allowFriends) return { error: fail(needFriends) };
  const range = readRange(input);
  if (!isRange(range)) return { error: range };
  const friend = await findPerson(ctx, input.nickname);
  if (!friend) return { error: noOne(input.nickname) };
  // 팔로우한 사람만 볼 수 있다(친구 화면과 같다).
  const follows = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: ctx.userId, followingId: friend.id } }, select: { followerId: true } });
  if (!follows) return { error: fail(`You do not follow ${friend.nickname}, so their todos and events are not visible. Use follow_user first.`) };
  return { friend, range };
}

export async function listFriendTodos(ctx: McpContext, input: { nickname: string; from: string; to?: string }): Promise<ToolResult> {
  const target = await friendTarget(ctx, input);
  if (target.error) return target.error;
  const { friend, range } = target;

  const rows = await prisma.todo.findMany({
    // 공개 카테고리의 할 일만(끝냈든 아니든). 비공개 카테고리·카테고리 없는 할 일은 친구 화면에도 안 보인다.
    where: { userId: friend.id, category: { isPublic: true }, date: { gte: range.from, lte: range.to } },
    orderBy: [{ date: "asc" }, { order: "asc" }],
    take: MCP_LIMITS.listRows + 1,
    select: { id: true, date: true, content: true, done: true, memo: true, memoPublic: true, category: { select: { name: true } } },
  });
  return ok({
    nickname: friend.nickname,
    from: dayText(range.from),
    to: dayText(range.to),
    truncated: rows.length > MCP_LIMITS.listRows,
    todos: rows.slice(0, MCP_LIMITS.listRows).map((row) => ({
      id: row.id,
      date: dayText(row.date),
      content: row.content,
      done: row.done,
      category: row.category?.name ?? null,
      // 메모는 친구가 공개로 켠 것만 나간다.
      ...(row.memoPublic && row.memo ? { memo: row.memo } : {}),
    })),
  });
}

export async function listFriendEvents(ctx: McpContext, input: { nickname: string; from: string; to?: string }): Promise<ToolResult> {
  const target = await friendTarget(ctx, input);
  if (target.error) return target.error;
  const { friend, range } = target;

  const [events, routines, skips] = await Promise.all([
    // 친구가 "친구에게 보이기"를 켠 일정만.
    prisma.event.findMany({
      where: { userId: friend.id, isPublic: true, startDate: { lte: range.to }, endDate: { gte: range.from } },
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      take: MCP_LIMITS.listRows + 1,
      select: { title: true, startDate: true, endDate: true, startTime: true, endTime: true, memo: true, memoPublic: true },
    }),
    prisma.eventRoutine.findMany({ where: { userId: friend.id, isPublic: true, startDate: { lte: range.to }, OR: [{ endDate: null }, { endDate: { gte: range.from } }] } }),
    prisma.eventRoutineSkip.findMany({ where: { date: { gte: range.from, lte: range.to }, eventRoutine: { userId: friend.id, isPublic: true } }, select: { eventRoutineId: true, date: true } }),
  ]);
  const clock = (minutes: number | null) => (minutes === null ? null : formatTime(minutes));
  return ok({
    nickname: friend.nickname,
    from: dayText(range.from),
    to: dayText(range.to),
    truncated: events.length > MCP_LIMITS.listRows,
    events: [
      ...events.slice(0, MCP_LIMITS.listRows).map((event) => ({
        title: event.title,
        startDate: dayText(event.startDate),
        endDate: dayText(event.endDate),
        startTime: clock(event.startTime),
        endTime: clock(event.endTime),
        repeats: false,
        ...(event.memoPublic && event.memo ? { memo: event.memo } : {}),
      })),
      // 반복 일정은 날짜로 펼쳐 보여 준다. 반복 일정에는 메모가 없다.
      ...expandEventRoutines(routines, skips, range.from, range.to).map((event) => ({
        title: event.title,
        startDate: dayText(event.startDate),
        endDate: dayText(event.endDate),
        startTime: clock(event.startTime),
        endTime: clock(event.endTime),
        repeats: true,
      })),
    ],
  });
}
