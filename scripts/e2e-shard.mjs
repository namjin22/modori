// E2E 시험 파일을 "걸리는 시간" 기준으로 고르게 나눠 한 조각의 파일 목록을 출력한다.
// Playwright의 --shard는 시험 개수로 나눠서, 오래 걸리는 파일이 몰린 조각이 전체 시간을 정한다
// (4조각일 때 가장 느린 조각 244초, 가장 빠른 조각 106초였다).
//
// 사용:
//   node scripts/e2e-shard.mjs <조각 번호 1부터> <전체 조각 수>   조각의 파일 목록(한 줄에 하나)
//   gh run view <실행 번호> --log | node scripts/e2e-shard.mjs --update   가중치 갱신(아래 설명)
//
// 어느 조각 번호로 불러도 같은 배치가 나오므로(파일 목록 + 가중치 파일이 같으면) 모든 파일이 정확히 한 조각에만 들어간다.
// 가중치에 없는 새 파일은 평균 무게로 친다. 그래서 가중치가 낡아도 균형이 덜 맞을 뿐 시험이 빠지지는 않는다.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = "tests/e2e";
const WEIGHTS = "scripts/e2e-weights.json";

export function listSpecs(dir = DIR) {
  return readdirSync(dir, { recursive: true })
    .map((p) => String(p).replaceAll("\\", "/"))
    .filter((p) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(p))
    .map((p) => `${dir}/${p}`)
    .sort();
}

// 무거운 파일부터 가장 가벼운 조각에 넣는다(LPT). 같은 무게는 이름 순, 같은 합계는 번호 순이라 결과가 늘 같다.
export function partition(files, weights, total) {
  const known = files.map((f) => weights[f]).filter((w) => typeof w === "number" && w > 0);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const weightOf = (f) => (typeof weights[f] === "number" && weights[f] > 0 ? weights[f] : fallback);

  const sorted = [...files].sort((a, b) => weightOf(b) - weightOf(a) || a.localeCompare(b));
  const bins = Array.from({ length: total }, () => ({ sum: 0, files: [] }));
  for (const file of sorted) {
    const bin = bins.reduce((min, b) => (b.sum < min.sum ? b : min));
    bin.sum += weightOf(file);
    bin.files.push(file);
  }
  return bins.map((b) => ({ sum: b.sum, files: b.files.sort() }));
}

// `TIMING\t이름표\t파일\t밀리초` 줄(scripts/e2e-timing.mjs가 로그에 남긴다)을 읽어 가중치를 다시 쓴다.
function update(input) {
  const sums = {};
  for (const line of input.split("\n")) {
    const m = line.match(/TIMING\t[^\t]*\t([^\t]+)\t(\d+)/);
    if (!m) continue;
    const file = `${DIR}/${m[1]}`;
    sums[file] = (sums[file] ?? 0) + Number(m[2]);
  }
  if (!Object.keys(sums).length) throw new Error("TIMING 줄이 없다. 로그를 e2e-timing.mjs가 쓴 실행에서 가져왔는지 본다.");
  const sorted = Object.fromEntries(Object.entries(sums).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(WEIGHTS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.error(`가중치 ${Object.keys(sorted).length}개를 ${WEIGHTS}에 썼다.`);
}

// 시험(vitest)이 partition만 불러 쓸 때는 아래 명령줄 부분이 돌지 않는다.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (a === "--update") {
    update(readFileSync(0, "utf8"));
  } else {
    const index = Number(a);
    const total = Number(b);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || index > total) {
      throw new Error("사용법: node scripts/e2e-shard.mjs <조각 번호 1부터> <전체 조각 수>");
    }
    const weights = JSON.parse(readFileSync(WEIGHTS, "utf8"));
    const bin = partition(listSpecs(), weights, total)[index - 1];
    console.log(bin.files.join("\n"));
    console.error(`조각 ${index}/${total}: 파일 ${bin.files.length}개, 예상 ${(bin.sum / 1000).toFixed(0)}초`);
  }
}
