// CI가 "이 실행에서 일을 해야 하는가"를 정한다. 결과는 GITHUB_OUTPUT에 쓴다.
//
//   node scripts/ci-changes.mjs verify   verify.yml의 changes 작업: 시험(static·e2e)을 건너뛸까
//     skip=true|false  reason=...  tree=<검사한 코드 묶음의 git tree 해시>
//   node scripts/ci-changes.mjs deploy   deploy.yml: 마지막으로 성공한 배포 뒤로 문서만 바뀌었나
//     docs_only=true|false
//
// 원칙: 확신이 없으면 건너뛰지 않는다. 이 스크립트가 틀려서 생기는 손해는 "시간 낭비"까지여야 하고
// "검증 안 된 코드가 배포됨"이 되어서는 안 된다. 그래서 어느 단계든 실패하면 전부 돌린다(실패는 로그에 남긴다).
//
// 필요한 환경 변수: GH_TOKEN, REPO, EVENT_NAME, BEFORE(push일 때), GITHUB_OUTPUT
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 시험은 docs/나 .md 파일을 읽지 않는다(tests/, scripts/test-tz.mjs, eslint·tsc 설정 확인).
// 그래서 이 파일들만 바뀐 변경은 시험 결과를 바꿀 수 없다. 접두사는 "docs/"까지 봐서 "docs-x/"나 "docs.ts"를 문서로 치지 않는다.
export function isDocsOnly(files) {
  return files.length > 0 && files.every((f) => f.startsWith("docs/") || f.endsWith(".md"));
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

// 실패하면 null을 돌려준다. 호출한 쪽이 "전부 돌린다"로 물러난다. 삼키지 않고 로그에는 남긴다.
function attempt(cmd, args) {
  try {
    return run(cmd, args);
  } catch (error) {
    console.error(`${cmd} ${args.join(" ")} 실패: ${String(error.message).split("\n")[0]}`);
    return null;
  }
}

function changedFiles(base) {
  const raw = attempt("git", ["-c", "core.quotepath=false", "diff", "--name-only", "-z", base, "HEAD"]);
  return raw === null ? null : raw.split("\0").filter(Boolean);
}

function output(name, value) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function say(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

function decide(skip, reason) {
  output("skip", skip);
  output("reason", reason);
  say(reason);
}

// 비교할 기준 커밋. 못 구하면 null이고, 그러면 문서만 바뀐 것인지 알 수 없으니 전부 돌린다.
function verifyBase() {
  if (process.env.EVENT_NAME === "pull_request") {
    // PR은 합쳐진 결과(merge commit)를 검사한다. 첫 부모가 기준 브랜치다. 부모가 둘이 아니면 그 가정이 깨진 것이다.
    const parents = attempt("git", ["rev-list", "--parents", "-n", "1", "HEAD"]);
    if (!parents || parents.split(" ").length !== 3) return null;
    return attempt("git", ["rev-parse", "HEAD^1"]);
  }
  if (process.env.EVENT_NAME === "push") {
    const before = process.env.BEFORE ?? "";
    if (!before || /^0+$/.test(before)) return null;
    return attempt("git", ["fetch", "--no-tags", "--depth=1", "origin", before]) === null ? null : before;
  }
  return null;
}

// main에 합친 코드 묶음이 이미 PR에서 통과한 것과 똑같은지 본다. 트리 해시가 같으면 파일 내용이 한 글자도 다르지 않다.
// PR 검증이 끝까지 통과하면 verified-<트리 해시> 아티팩트를 남긴다(verify.yml의 record 작업).
function alreadyVerified(tree) {
  const repo = process.env.REPO;
  const ids = attempt("gh", [
    "api",
    `repos/${repo}/actions/artifacts?name=verified-${tree}`,
    "--jq",
    ".artifacts[] | select(.expired == false) | .workflow_run.id",
  ]);
  for (const id of ids ? ids.split("\n").filter(Boolean) : []) {
    // 표식의 이름만 믿지 않는다. 그 실행이 이 저장소의 verify 워크플로를 PR로 돌려 성공했는지 직접 본다.
    const info = attempt("gh", [
      "api",
      `repos/${repo}/actions/runs/${id}`,
      "--jq",
      '[.conclusion, .event, .path, .head_repository.full_name] | join(" ")',
    ]);
    if (info === `success pull_request .github/workflows/verify.yml ${repo}`) return id;
  }
  return null;
}

function verify() {
  const tree = attempt("git", ["rev-parse", "HEAD^{tree}"]);
  output("tree", tree ?? "");
  if (!tree) return decide(false, "코드 묶음의 해시를 읽지 못해 시험을 전부 돌린다");

  const base = verifyBase();
  if (base) {
    const files = changedFiles(base);
    if (files && isDocsOnly(files)) return decide(true, `문서만 바뀌어(${files.length}개 파일) 시험을 건너뛴다`);
  }

  if (process.env.EVENT_NAME === "push") {
    const runId = alreadyVerified(tree);
    if (runId) {
      return decide(true, `같은 코드 묶음(tree ${tree.slice(0, 12)})을 PR 검증(실행 ${runId})이 이미 통과시켜 시험을 건너뛴다`);
    }
  }
  decide(false, "시험을 전부 돌린다");
}

// 마지막으로 성공한 배포의 커밋과 지금 커밋을 비교한다. 직전 커밋만 보면 여러 커밋을 한꺼번에 올렸을 때나
// 앞 배포가 실패했을 때 코드 변경을 놓친다. 성공한 배포는 "그 커밋까지 운영에 반영됨"이라는 뜻이라 기준으로 맞다.
function deploy() {
  const last = attempt("gh", [
    "run", "list", "--workflow", "deploy.yml", "--status", "success", "--limit", "1",
    "--json", "headSha", "--jq", ".[0].headSha // empty",
  ]);
  let docsOnly = false;
  if (last && attempt("git", ["fetch", "--no-tags", "--depth=1", "origin", last]) !== null) {
    const files = changedFiles(last);
    docsOnly = Boolean(files && isDocsOnly(files));
    say(docsOnly ? `마지막 배포(${last.slice(0, 7)}) 뒤로 문서만 바뀌어 배포를 건너뛴다` : `마지막 배포(${last.slice(0, 7)}) 뒤로 앱에 닿는 변경이 있어 배포한다`);
  } else {
    say("마지막 배포 커밋을 확인하지 못해 배포한다");
  }
  output("docs_only", docsOnly);
}

// 시험(vitest)이 isDocsOnly만 불러 쓸 때는 아래 명령줄 부분이 돌지 않는다.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const mode = process.argv[2];
  if (mode === "verify") verify();
  else if (mode === "deploy") deploy();
  else throw new Error("사용법: node scripts/ci-changes.mjs verify|deploy");
}
