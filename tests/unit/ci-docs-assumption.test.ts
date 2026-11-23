// CI는 docs/와 .md 파일만 바뀐 변경의 시험을 건너뛴다(scripts/ci-changes.mjs의 isDocsOnly, 2026-11-23).
// 그것이 안전한 까닭은 시험과 앱이 그 파일들을 읽지 않기 때문이다. 누가 읽기 시작하면 이 시험이 먼저 깨져서
// "문서만 바뀐 변경은 시험을 건너뛴다"는 규칙을 다시 보게 한다. 주석 속 언급(예: "docs/decisions.md 참고")은 읽는 것이 아니라서 센다.
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const ROOTS = ["tests", "app", "lib", "components", "prisma"];
// 이 규칙의 시험이라 문서 경로를 예로 적는다.
const SELF = ["tests/unit/ci-changes.test.ts", "tests/unit/ci-docs-assumption.test.ts"];

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true })
    .map((p) => `${root}/${String(p).replaceAll("\\", "/")}`)
    .filter((p) => /\.(ts|tsx|mjs|js)$/.test(p) && !SELF.includes(p));
}

// 파일 전체에서 주석을 공백으로 바꾼다. 줄 수는 그대로라 줄 번호가 맞는다. 여러 줄 블록 주석(JSX의 {/* … */} 포함)도 걷는다.
// 줄 주석은 앞이 공백이거나 줄 처음일 때만 본다("https://…"의 //를 주석으로 보지 않는다).
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

describe("문서 파일은 시험·앱 코드가 읽지 않는다", () => {
  it("코드(주석 제외)에 docs/ 경로나 .md 파일 이름이 없다", () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const text = readFileSync(file, "utf8");
        const original = text.split("\n");
        stripComments(text)
          .split("\n")
          .forEach((code, i) => {
            if (/docs\/|\.md\b/.test(code)) hits.push(`${file}:${i + 1}: ${original[i].trim().slice(0, 100)}`);
          });
      }
    }
    expect(hits, "문서를 읽는 코드가 생겼다. scripts/ci-changes.mjs의 isDocsOnly(문서만 바뀌면 시험을 건너뜀)를 다시 정해야 한다").toEqual([]);
  });

  it("검사하는 파일이 실제로 있다(경로가 틀려 아무것도 안 보고 통과하지 않게)", () => {
    expect(ROOTS.flatMap(sourceFiles).length).toBeGreaterThan(100);
  });
});
