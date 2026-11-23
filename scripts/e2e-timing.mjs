// Playwright JSON 결과에서 파일별 시험 시간을 뽑아 로그와 작업 요약에 남긴다.
// 샤드를 고르게 나누고 느린 시험을 찾으려면 "어느 파일이 몇 초 걸리는가"가 있어야 해서다.
// 사용: node scripts/e2e-timing.mjs <결과.json> [이름표]
import { appendFileSync, readFileSync } from "node:fs";

const [file, label = ""] = process.argv.slice(2);
if (!file) throw new Error("사용법: node scripts/e2e-timing.mjs <결과.json> [이름표]");

const report = JSON.parse(readFileSync(file, "utf8"));
const perFile = new Map();

function walk(suite) {
  for (const child of suite.suites ?? []) walk(child);
  for (const spec of suite.specs ?? []) {
    const ms = spec.tests.reduce(
      (sum, t) => sum + t.results.reduce((s, r) => s + r.duration, 0),
      0,
    );
    perFile.set(spec.file, (perFile.get(spec.file) ?? 0) + ms);
  }
}
for (const suite of report.suites) walk(suite);

const rows = [...perFile].sort((a, b) => b[1] - a[1]);
const { expected, unexpected, flaky, skipped, duration } = report.stats;
const head = `${label} 시험 ${expected + unexpected + flaky}개 통과 ${expected} 실패 ${unexpected} 불안정 ${flaky} 건너뜀 ${skipped}, 걸린 시간 ${(duration / 1000).toFixed(0)}초`;

console.log(head);
for (const [name, ms] of rows) console.log(`TIMING\t${label}\t${name}\t${ms}`);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const top = rows
    .slice(0, 10)
    .map(([name, ms]) => `| ${name} | ${(ms / 1000).toFixed(1)} |`)
    .join("\n");
  appendFileSync(summary, `### ${head}\n\n| 파일 | 초 |\n|---|---|\n${top}\n`);
}
