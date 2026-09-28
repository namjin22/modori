import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseKSTDate } from "@/lib/date";

const db = vi.hoisted(() => ({
  snapshots: new Set<string>(),
  failOn: null as string | null,
  activeDay: {
    createMany: vi.fn(async () => ({ count: 1 })),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    findFirst: vi.fn(async () => null as { date: Date } | null),
    count: vi.fn(async () => 1),
    groupBy: vi.fn(async () => []),
  },
  dailyStat: {
    findUnique: vi.fn(async ({ where }: { where: { date: Date } }) =>
      db.snapshots.has(where.date.toISOString().slice(0, 10)) ? { date: where.date } : null),
    findFirst: vi.fn(async ({ orderBy }: { orderBy: { date: "asc" | "desc" } }) => {
      const dates = [...db.snapshots].sort();
      const selected = orderBy.date === "asc" ? dates[0] : dates.at(-1);
      return selected ? { date: new Date(`${selected}T00:00:00Z`) } : null;
    }),
    findMany: vi.fn(async ({ where }: { where: { date: { gte: Date; lte: Date } } }) =>
      [...db.snapshots].filter((date) => date >= where.date.gte.toISOString().slice(0, 10)
        && date <= where.date.lte.toISOString().slice(0, 10)).map((date) => ({ date: new Date(`${date}T00:00:00Z`) }))),
    createMany: vi.fn(async ({ data }: { data: { date: Date }[] }) => {
      const day = data[0].date.toISOString().slice(0, 10);
      if (db.failOn === day) throw new Error("temporary DB failure");
      db.snapshots.add(day);
      return { count: 1 };
    }),
  },
  user: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
  todo: { count: vi.fn(async () => 0) },
  reaction: { count: vi.fn(async () => 0) },
  follow: { count: vi.fn(async () => 0) },
  session: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

const day = (s: string) => parseKSTDate(s);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T02:00:00Z"));
  db.snapshots.clear();
  db.snapshots.add("2026-09-20");
  db.failOn = null;
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());

describe("daily metric snapshot recovery", () => {
  it("starts recovery from the health route without an authenticated visit", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
    expect([...db.snapshots].sort()).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
  });

  it("retries failed session cleanup without delaying snapshots", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    db.session.deleteMany.mockRejectedValueOnce(new Error("session DB failure"));
    try {
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
      await runDailyOnce();
      expect(db.session.deleteMany).toHaveBeenCalledTimes(2);
      expect(logged).toHaveBeenCalledWith("[daily] 만료된 세션을 지우지 못했다.", expect.any(Error));
    } finally {
      logged.mockRestore();
    }
  });
  it("returns from daily maintenance without waiting for a long catch-up", async () => {
    vi.setSystemTime(new Date("2026-10-23T02:00:00Z"));
    db.activeDay.findFirst.mockResolvedValueOnce({ date: day("2026-09-19") });
    let resume!: () => void;
    const paused = new Promise<void>((resolve) => { resume = resolve; });
    db.dailyStat.createMany.mockImplementationOnce(async ({ data }) => {
      await paused;
      db.snapshots.add(data[0].date.toISOString().slice(0, 10));
      return { count: 1 };
    });
    const { runDailyOnce } = await import("@/lib/daily");
    let settled = false;
    const visit = runDailyOnce().then(() => { settled = true; });
    try {
      await vi.waitFor(() => expect(db.dailyStat.createMany).toHaveBeenCalledTimes(1), { timeout: 100 });
      await Promise.resolve();
      expect(settled).toBe(true);
      expect(db.session.deleteMany).toHaveBeenCalledTimes(1);
      expect(db.activeDay.deleteMany).not.toHaveBeenCalled();
    } finally {
      resume();
      await visit;
    }
    expect(db.activeDay.deleteMany).not.toHaveBeenCalled();
    expect(db.snapshots.has("2026-09-19")).toBe(true);
    expect(db.snapshots.has("2026-10-22")).toBe(false);
    expect(db.dailyStat.findMany).toHaveBeenCalledTimes(1);
    await vi.waitFor(async () => {
      await runDailyOnce();
      expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1);
    });
    expect(db.snapshots.has("2026-10-22")).toBe(true);
    expect(db.dailyStat.findMany).toHaveBeenCalledTimes(2);
  });
  it("recovers an older missing day even when a newer snapshot exists", async () => {
    db.activeDay.findFirst.mockResolvedValueOnce({ date: day("2026-09-19") });
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
    expect([...db.snapshots].sort()).toEqual([
      "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22",
    ]);
    expect(db.dailyStat.createMany).toHaveBeenCalledTimes(3);
  });
  it("fills every elapsed day, not only yesterday", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
    expect([...db.snapshots].sort()).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
    expect(db.dailyStat.createMany).toHaveBeenCalledTimes(2);
  });

  it("starts at the oldest known active day when no snapshot exists", async () => {
    db.snapshots.clear();
    db.activeDay.findFirst.mockResolvedValueOnce({ date: day("2026-09-21") });
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();
    await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
    expect([...db.snapshots].sort()).toEqual(["2026-09-21", "2026-09-22"]);
  });

  it("shares one snapshot run across concurrent visits and caches success", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    await Promise.all([runDailyOnce(), runDailyOnce()]);
    await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
    await runDailyOnce();
    expect(db.dailyStat.findFirst).toHaveBeenCalledTimes(1);
    expect(db.dailyStat.findMany).toHaveBeenCalledTimes(1);
    expect(db.dailyStat.createMany).toHaveBeenCalledTimes(2);
    expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("retries a failed snapshot on a later visit that same day", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.failOn = "2026-09-21";
      await runDailyOnce();
      await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1));
      expect(db.snapshots.has("2026-09-21")).toBe(false);
      expect(db.snapshots.has("2026-09-22")).toBe(true);
      expect(db.activeDay.deleteMany).not.toHaveBeenCalled();
      db.failOn = null;
      await runDailyOnce();
      await vi.waitFor(() => expect(db.activeDay.deleteMany).toHaveBeenCalledTimes(1));
      expect([...db.snapshots].sort()).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
      expect(logged).toHaveBeenCalledTimes(1);
    } finally {
      logged.mockRestore();
    }
  });
});
