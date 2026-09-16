// 유닛 테스트를 서로 다른 프로세스 TZ에서 반복 실행한다.
// 날짜 로직이 개발자 PC의 타임존에서만 통과하는 상황을 막기 위한 것이다.
// npm scripts는 Windows에서 cmd.exe로 돌아 `TZ=UTC cmd` 문법을 쓸 수 없어서
// 셸 대신 이 스크립트로 환경변수를 넘긴다.

import { spawnSync } from "node:child_process";

const TIMEZONES = ["UTC", "Asia/Seoul", "America/New_York"];

for (const tz of TIMEZONES) {
  console.log(`\n=== TZ=${tz} ===`);

  // 인자를 배열로 넘기면서 shell:true를 쓰면 Node가 DEP0190 경고를 낸다.
  // 고정 문자열이므로 명령 전체를 한 번에 넘긴다.
  const result = spawnSync("npx vitest run", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, TZ: tz },
  });

  if (result.status !== 0) {
    console.error(`TZ=${tz} 에서 실패했다.`);
    process.exit(result.status ?? 1);
  }
}
