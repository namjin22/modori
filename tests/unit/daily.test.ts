// 하루 정리(lib/daily.ts)와 빠진 합계 채우기(lib/metrics.ts). PR #110·#111(junjuny0227)의 시험 상황을 합친 구조에 맞춰 옮겼다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addDays, formatKST, parseKSTDate } from "@/lib/date";

const db = vi.hoisted(() => {
  const state = {
    snapshots: new Set<string>(),
    oldestActive: null as string | null,
    failSnapshotOn: null as string | null,
  };
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
  return {
    state,
    activeDay: {
      deleteMany: vi.fn<(args: { where: { date: { lt: Date } } }) => Promise<{ count: number }>>(async () => ({ count: 0 })),
      findFirst: vi.fn(async () => (state.oldestActive ? { date: asDate(state.oldestActive) } : null)),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    dailyStat: {
      findFirst: vi.fn(async () => {
        const first = [...state.snapshots].sort()[0];
        return first ? { date: asDate(first) } : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { date?: { gte: Date; lte: Date } } }) => {
        const range = where.date;
        // 새 열 채우기(sources가 빈 행 찾기)는 날짜 조건이 없다. 이 시험에서는 채울 행이 없다.
        if (!range) return [];
        return [...state.snapshots]
          .filter((day) => day >= key(range.gte) && day <= key(range.lte))
          .map((day) => ({ date: asDate(day) }));
      }),
      createMany: vi.fn(async ({ data }: { data: { date: Date }[] }) => {
        const day = key(data[0].date);
        if (state.failSnapshotOn === day) throw new Error("잠깐 DB 오류");
        state.snapshots.add(day);
        return { count: 1 };
      }),
    },
    user: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    todo: { count: vi.fn(async () => 0) },
    reaction: { count: vi.fn(async () => 0) },
    follow: { count: vi.fn(async () => 0) },
    session: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $queryRaw: vi.fn(async () => [{ ok: 1 }]),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));

const day = (value: string) => parseKSTDate(value);
const snapshots = () => [...db.state.snapshots].sort();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 한국 시각 2026-09-23 11:00
  vi.setSystemTime(new Date("2026-09-23T02:00:00Z"));
  db.state.snapshots.clear();
  db.state.snapshots.add("2026-09-20");
  db.state.oldestActive = null;
  db.state.failSnapshotOn = null;
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());

describe("빠진 하루 합계 채우기", () => {
  it("로그인 없이 health 감시만 와도 어제까지 빠진 날을 채운다", async () => {
    const { GET } = await import("@/app/api/health/route");
    expect((await GET()).status).toBe(200);
    await vi.waitFor(() => expect(snapshots()).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]));
  });

  it("더 오래된 쓴 날짜가 남아 있으면 그 날부터 채운다", async () => {
    db.state.oldestActive = "2026-09-18";
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    await vi.waitFor(() =>
      expect(snapshots()).toEqual(["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"]),
    );
  });

  it("합계가 하나도 없으면 가장 오래된 쓴 날짜부터 채운다", async () => {
    db.state.snapshots.clear();
    db.state.oldestActive = "2026-09-21";
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    await vi.waitFor(() => expect(snapshots()).toEqual(["2026-09-21", "2026-09-22"]));
  });

  it("오래 비었으면 기다리지 않고 30일씩 나눠 채운다", async () => {
    vi.setSystemTime(new Date("2026-11-10T02:00:00Z"));
    let resume!: () => void;
    const paused = new Promise<void>((resolve) => {
      resume = resolve;
    });
    db.dailyStat.createMany.mockImplementationOnce(async ({ data }) => {
      await paused;
      db.state.snapshots.add(data[0].date.toISOString().slice(0, 10));
      return { count: 1 };
    });
    const { runDailyOnce } = await import("@/lib/daily");

    // 첫 날짜를 쓰는 중에 멈춰 있어도 부른 쪽은 끝난다.
    await runDailyOnce();
    await vi.waitFor(() => expect(db.dailyStat.createMany).toHaveBeenCalledTimes(1));
    resume();

    // 첫 합계(9/20)부터 30일(10/19까지)을 확인하고 멈춘다. 다음 요청이 이어서 어제(11/9)까지 채운다.
    await vi.waitFor(() => expect(db.state.snapshots.has("2026-10-19")).toBe(true));
    expect(db.state.snapshots.has("2026-10-20")).toBe(false);
    await vi.waitFor(async () => {
      await runDailyOnce();
      expect(db.state.snapshots.has("2026-11-09")).toBe(true);
    });
    expect(db.state.snapshots.has("2026-11-10")).toBe(false);
  });

  it("보관 기간(오늘~89일 전)보다 오래된 날은 채우지 않는다", async () => {
    db.state.snapshots.clear();
    db.state.oldestActive = "2026-01-01";
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    // 이번 차례(30일)가 끝날 때까지 기다린다. 뒤에서 도는 채우기가 다음 테스트의 가짜 DB에 섞이지 않게.
    await vi.waitFor(() => expect(db.dailyStat.createMany).toHaveBeenCalledTimes(30));
    const firstFilled = db.dailyStat.createMany.mock.calls[0][0].data[0].date;
    expect(formatKST(firstFilled)).toBe(formatKST(addDays(day("2026-09-23"), -89)));
  });

  it("동시에 온 요청은 한 번만 채우고, 다 채운 뒤에는 다시 확인하지 않는다", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    await Promise.all([runDailyOnce(), runDailyOnce()]);
    await vi.waitFor(() => expect(snapshots()).toHaveLength(3));
    await runDailyOnce();
    expect(db.dailyStat.findFirst).toHaveBeenCalledTimes(1);
    expect(db.dailyStat.createMany).toHaveBeenCalledTimes(2);
  });

  it("한 날이 실패해도 뒤의 날은 채우고, 실패한 날은 다음 요청이 채운다", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.state.failSnapshotOn = "2026-09-21";
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1));
      expect(snapshots()).toEqual(["2026-09-20", "2026-09-22"]);

      db.state.failSnapshotOn = null;
      await runDailyOnce();
      await vi.waitFor(() => expect(snapshots()).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]));
    } finally {
      logged.mockRestore();
    }
  });
});

describe("90일 지난 쓴 날짜 지우기", () => {
  it("오늘부터 89일 전까지 남기고 90일 전부터 지운다", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    const cutoff = db.activeDay.deleteMany.mock.calls[0][0].where.date.lt;
    expect(formatKST(cutoff)).toBe(formatKST(addDays(day("2026-09-23"), -89)));
  });

  it("합계가 실패해도 지운다", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.dailyStat.findFirst.mockRejectedValueOnce(new Error("합계 표를 못 읽음"));
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1);
    } finally {
      logged.mockRestore();
    }
  });

  it("지우기가 실패하면 같은 날 다음 요청에서 다시 하고, 세션 정리는 되풀이하지 않는다", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.activeDay.deleteMany.mockRejectedValueOnce(new Error("잠깐 DB 오류"));
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      await runDailyOnce();
      await runDailyOnce();
      expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(2);
      expect(db.session.deleteMany).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith("[metrics] 90일 지난 쓴 날짜를 지우지 못했다.", expect.any(Error));
    } finally {
      logged.mockRestore();
    }
  });

  it("세션 정리가 실패하면 같은 날 다음 요청에서 다시 한다", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.session.deleteMany.mockRejectedValueOnce(new Error("잠깐 DB 오류"));
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      await runDailyOnce();
      await runDailyOnce();
      expect(db.session.deleteMany).toHaveBeenCalledTimes(2);
    } finally {
      logged.mockRestore();
    }
  });
});
