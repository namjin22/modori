// 친구 줄 순서 저장(app/(tabs)/feed/actions.ts의 reorderFriends): 남의 id·중복 id는 통째로 무시하고, 값은 가장 작은 순서 아래로 준다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const transaction = vi.fn(async (ops: unknown[]) => ops);
const count = vi.fn();
const aggregate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    follow: { count: (...args: unknown[]) => count(...args), aggregate: (...args: unknown[]) => aggregate(...args), updateMany: (...args: unknown[]) => updateMany(...args) },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "me", nickname: "나" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendPushToUser: vi.fn(), shouldNotify: () => true }));

import { reorderFriends } from "@/app/(tabs)/feed/actions";

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(3);
  aggregate.mockResolvedValue({ _min: { sortOrder: 0 } });
});

describe("reorderFriends", () => {
  it("보이는 순서대로 가장 작은 순서 아래의 값을 저장한다", async () => {
    aggregate.mockResolvedValue({ _min: { sortOrder: -5 } });
    await reorderFriends(["c", "a", "b"]);
    expect(updateMany.mock.calls.map(([arg]) => [arg.where.followingId, arg.data.sortOrder])).toEqual([
      ["c", -8],
      ["a", -7],
      ["b", -6],
    ]);
    // 내 팔로우만 건드린다.
    expect(updateMany.mock.calls.every(([arg]) => arg.where.followerId === "me")).toBe(true);
  });

  it("아직 아무도 순서를 바꾸지 않았으면(0) -n부터 시작한다", async () => {
    await reorderFriends(["c", "a", "b"]);
    expect(updateMany.mock.calls.map(([arg]) => arg.data.sortOrder)).toEqual([-3, -2, -1]);
  });

  it("내가 팔로우하지 않은 사람이 섞여 오면(개수가 맞지 않으면) 아무것도 저장하지 않는다", async () => {
    count.mockResolvedValue(2);
    await reorderFriends(["a", "b", "stranger"]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("같은 사람이 두 번 오거나 빈 목록·너무 긴 목록이면 무시한다", async () => {
    await reorderFriends(["a", "a"]);
    await reorderFriends([]);
    await reorderFriends(Array.from({ length: 21 }, (_, index) => `id${index}`));
    await reorderFriends("a" as unknown as string[]);
    expect(count).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
