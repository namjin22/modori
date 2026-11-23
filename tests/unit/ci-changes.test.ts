// scripts/ci-changes.mjs의 isDocsOnly: "문서만 바뀌었으니 시험을 건너뛴다"를 정하는 한 줄(2026-11-23).
// 이것이 코드 파일을 문서로 잘못 보면 검증 안 된 코드가 배포된다. 그래서 건너뛰면 안 되는 경우를 더 많이 적는다.
import { describe, expect, it } from "vitest";

import { isDocsOnly } from "../../scripts/ci-changes.mjs";

describe("isDocsOnly: 건너뛰어도 되는 변경", () => {
  it.each([
    [["docs/decisions.md"]],
    [["docs/screenshots/2026-11-23/home.png"]],
    [["README.md"]],
    [["CLAUDE.md", "docs/handoff.md"]],
    [["mobile/README.md"]],
    [["docs/privacy-inventory.md", "docs/screenshots/a.png", "README.md"]],
  ])("%j", (files) => {
    expect(isDocsOnly(files)).toBe(true);
  });
});

describe("isDocsOnly: 건너뛰면 안 되는 변경", () => {
  it.each([
    [[]], // 바뀐 것이 없으면(빈 커밋·비교 실패) 판단하지 않고 전부 돌린다
    [["app/page.tsx"]],
    [["lib/privacy.ts"]],
    [["docs/decisions.md", "lib/privacy.ts"]], // 문서가 섞여도 코드가 하나라도 있으면 돌린다
    [["package.json"]],
    [["package-lock.json"]],
    [["prisma/schema.prisma"]],
    [[".github/workflows/verify.yml"]],
    [["tests/e2e/todo.spec.ts"]],
    [["docs-site/index.ts"]], // 접두사만 비슷한 폴더
    [["docs.ts"]],
    [["notes.md.ts"]], // 확장자가 .md로 끝나지 않는다
    [["scripts/ci-changes.mjs"]],
    [["Dockerfile"]],
  ])("%j", (files) => {
    expect(isDocsOnly(files)).toBe(false);
  });
});
