// /api/health/backup: 백업이 멈췄는지(app/api/health/backup/route.ts). 덤프 파일은 백업용 Neon 복원보다 먼저 만들어지므로
// 복원이 실패하는 동안에도 덤프는 새로 생긴다(INC-23). 그래서 복원 성공 표시가 있으면 그 날짜를 본다.
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/backup/route";

const HOUR = 60 * 60 * 1000;
let dir: string;

/** 파일을 만들고 수정 날짜를 지금에서 hoursAgo 시간 전으로 둔다. */
async function touch(name: string, hoursAgo: number) {
  const file = path.join(dir, name);
  await writeFile(file, "x");
  const when = new Date(Date.now() - hoursAgo * HOUR);
  await utimes(file, when, when);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "modori-backup-"));
  vi.stubEnv("BACKUP_DIR", dir);
  // 오류 기록은 시험 출력에 섞이지 않게 막는다. 무엇이 기록되는지는 아래에서 본다.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/health/backup", () => {
  it("백업 폴더가 없으면(로컬·시험) 검사하지 않는다", async () => {
    vi.stubEnv("BACKUP_DIR", path.join(dir, "없는폴더"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "skipped" });
  });

  it("복원 표시가 아직 없으면 덤프 날짜를 본다(스크립트를 바꾼 뒤 첫 실행 전)", async () => {
    await touch("modori-20261122-0400.dump", 5);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", of: "dump", ageHours: 5 });
  });

  it("덤프도 표시도 없으면 멈춘 것이다", async () => {
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "stale", ageHours: null });
  });

  it("덤프가 36시간 넘게 새로 안 생기면 멈춘 것이다", async () => {
    await touch("modori-20261120-0400.dump", 40);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "stale", of: "dump", ageHours: 40 });
  });

  it("복원 표시가 최근이면 정상이다", async () => {
    await touch("modori-20261122-0400.dump", 5);
    await touch("neon-restore.ok", 5);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", of: "restore", ageHours: 5 });
  });

  it("덤프는 새로 생기는데 복원 표시가 낡았으면 멈춘 것이다(복원이 계속 실패하는 경우)", async () => {
    await touch("modori-20261122-0400.dump", 5);
    await touch("neon-restore.ok", 60);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "stale", of: "restore", ageHours: 60 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("백업용 Neon 복원"));
  });
});
