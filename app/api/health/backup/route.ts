import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

// 백업은 매일 04:00에 돈다. 하루 반이 지나도 새 파일이 없으면 백업이 멈춘 것이다.
const MAX_AGE_MS = 36 * 60 * 60 * 1000;
// backup.sh가 백업용 Neon 복원까지 성공한 뒤에만 날짜를 새로 쓰는 파일(deploy/backup.sh).
const RESTORE_MARKER = "neon-restore.ok";

/**
 * 가장 최근 백업이 너무 오래됐으면 503. 백업 스크립트가 조용히 실패해도 GitHub `health`가 알린다.
 * 백업 폴더(VM의 /opt/modori/backups)를 읽기 전용으로 붙인 컨테이너에서만 의미가 있고, 폴더가 없는
 * 로컬·테스트에서는 검사하지 않는다(deploy/docker-compose.yml).
 *
 * 기준은 복원 성공 표시(neon-restore.ok)가 있으면 그 날짜다. 덤프 파일은 복원보다 먼저 만들어져서, 덤프 날짜만 보면 백업용 Neon
 * 복원이 25일 동안 실패해도 정상으로 보였다(2026-11-22, docs/incidents.md INC-23). 표시가 아직 없으면(스크립트를 바꾼 뒤 첫 실행 전)
 * 예전처럼 덤프 날짜를 본다.
 */
export async function GET() {
  const dir = process.env.BACKUP_DIR ?? "/backups";
  let names: string[];
  try {
    // 경로가 환경 변수라 번들러가 프로젝트 전체를 서버 이미지에 넣으려 한다. 런타임에만 읽는 폴더라 무시하게 한다.
    names = await readdir(/*turbopackIgnore: true*/ dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ status: "skipped" });
    }
    console.error("[health] 백업 폴더를 읽지 못했다.", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  const mtime = async (name: string) => (await stat(path.join(/*turbopackIgnore: true*/ dir, name))).mtimeMs;
  const dumpTimes = await Promise.all(names.filter((name) => name.endsWith(".dump")).map(mtime));
  const restored = names.includes(RESTORE_MARKER);
  const newest = restored ? await mtime(RESTORE_MARKER) : Math.max(0, ...dumpTimes);
  const what = restored ? "백업용 Neon 복원" : "백업 파일";
  const ageHours = Math.round((Date.now() - newest) / 3_600_000);
  if (newest === 0 || Date.now() - newest > MAX_AGE_MS) {
    console.error(`[health] 백업이 멈췄다. 가장 최근 ${what}이 ${newest === 0 ? "없다" : `${ageHours}시간 전이다`}.`);
    return NextResponse.json({ status: "stale", of: restored ? "restore" : "dump", ageHours: newest === 0 ? null : ageHours }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", of: restored ? "restore" : "dump", ageHours });
}
