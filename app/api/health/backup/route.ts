import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

// 백업은 매일 04:00에 돈다. 하루 반이 지나도 새 파일이 없으면 백업이 멈춘 것이다.
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

/**
 * 가장 최근 백업 파일이 너무 오래됐으면 503. 백업 스크립트가 조용히 실패해도 GitHub `health`가 알린다.
 * 백업 폴더(VM의 /opt/modori/backups)를 읽기 전용으로 붙인 컨테이너에서만 의미가 있고, 폴더가 없는
 * 로컬·테스트에서는 검사하지 않는다(deploy/docker-compose.yml).
 */
export async function GET() {
  const dir = process.env.BACKUP_DIR ?? "/backups";
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ status: "skipped" });
    }
    console.error("[health] 백업 폴더를 읽지 못했다.", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  const times = await Promise.all(
    names.filter((name) => name.endsWith(".dump")).map(async (name) => (await stat(path.join(dir, name))).mtimeMs),
  );
  const newest = Math.max(0, ...times);
  const ageHours = Math.round((Date.now() - newest) / 3_600_000);
  if (newest === 0 || Date.now() - newest > MAX_AGE_MS) {
    console.error(`[health] 백업이 멈췄다. 가장 최근 파일이 ${newest === 0 ? "없다" : `${ageHours}시간 전이다`}.`);
    return NextResponse.json({ status: "stale", ageHours: newest === 0 ? null : ageHours }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", ageHours });
}
