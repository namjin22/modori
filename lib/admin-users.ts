import { addDays, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { DIRECT_SOURCE } from "@/lib/signup-source";

export type UserRow = {
  id: string;
  nickname: string | null;
  email: string | null;
  createdAt: Date;
  providers: string[];
  source: string;
  consented: boolean;
  profile: "photo" | "character";
  character: string;
  hideFromRecommend: boolean;
  lastActive: Date | null;
  activeDays: number;
  active7: boolean;
  todos: number;
  todosDone: number;
  categories: number;
  routines: number;
  events: number;
  following: number;
  followers: number;
  reactionsSent: number;
  reactionsReceived: number;
  pushDevices: number;
};

export const SORTS = {
  joined: "가입 최근",
  active: "최근 사용",
  todos: "할 일 많은 순",
  following: "팔로우 많은 순",
  reactions: "보낸 반응 많은 순",
} as const;
export type SortKey = keyof typeof SORTS;

export function parseSort(value: string | undefined): SortKey {
  return value && value in SORTS ? (value as SortKey) : "joined";
}

const MAX_ROWS = 500;

/**
 * 운영자 화면용 사용자별 이용 현황. 개수와 날짜만 모으고 할 일·메모·소개 같은 내용은 읽지 않는다.
 * 사용자가 수백 명 이하라 사람마다 개수를 한 번에 센다(groupBy 세 번 + 목록 한 번).
 */
export async function loadUserRows(query: string): Promise<UserRow[]> {
  const today = todayKST();
  const q = query.trim();
  const [users, doneByUser, receivedByUser, lastByUser] = await Promise.all([
    prisma.user.findMany({
      where: {
        nickname: { not: null },
        ...(q ? { OR: [{ nickname: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      },
      take: MAX_ROWS,
      select: {
        id: true,
        nickname: true,
        email: true,
        createdAt: true,
        signupSource: true,
        privacyAgreedAt: true,
        profileImage: true,
        avatarCharacter: true,
        hideFromRecommend: true,
        accounts: { select: { provider: true } },
        _count: {
          select: {
            todos: true,
            categories: true,
            routines: true,
            events: true,
            following: true,
            followers: true,
            reactions: true,
            pushTokens: true,
            activeDays: true,
          },
        },
      },
    }),
    prisma.todo.groupBy({ by: ["userId"], where: { done: true }, _count: { _all: true } }),
    prisma.reaction.groupBy({ by: ["todoUserId"], _count: { _all: true } }),
    prisma.activeDay.groupBy({ by: ["userId"], _max: { date: true } }),
  ]);

  const done = new Map(doneByUser.map((row) => [row.userId, row._count._all]));
  const received = new Map(receivedByUser.map((row) => [row.todoUserId, row._count._all]));
  const last = new Map(lastByUser.map((row) => [row.userId, row._max.date]));
  const weekAgo = addDays(today, -6);

  return users.map((user) => {
    const lastActive = last.get(user.id) ?? null;
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      createdAt: user.createdAt,
      providers: [...new Set(user.accounts.map((account) => account.provider))].sort(),
      source: user.signupSource ?? DIRECT_SOURCE,
      consented: user.privacyAgreedAt !== null,
      profile: user.profileImage ? "photo" : "character",
      character: user.avatarCharacter ?? "dori",
      hideFromRecommend: user.hideFromRecommend,
      lastActive,
      activeDays: user._count.activeDays,
      active7: lastActive !== null && lastActive >= weekAgo,
      todos: user._count.todos,
      todosDone: done.get(user.id) ?? 0,
      categories: user._count.categories,
      routines: user._count.routines,
      events: user._count.events,
      following: user._count.following,
      followers: user._count.followers,
      reactionsSent: user._count.reactions,
      reactionsReceived: received.get(user.id) ?? 0,
      pushDevices: user._count.pushTokens,
    };
  });
}

/** 정렬. 같으면 가입이 늦은 사람이 위. */
export function sortRows(rows: UserRow[], sort: SortKey): UserRow[] {
  const key: Record<SortKey, (row: UserRow) => number> = {
    joined: (row) => row.createdAt.getTime(),
    active: (row) => row.lastActive?.getTime() ?? 0,
    todos: (row) => row.todos,
    following: (row) => row.following,
    reactions: (row) => row.reactionsSent,
  };
  return [...rows].sort((a, b) => key[sort](b) - key[sort](a) || b.createdAt.getTime() - a.createdAt.getTime());
}
