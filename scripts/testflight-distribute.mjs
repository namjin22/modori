// iOS 빌드를 TestFlight **외부** 테스트 그룹에 넣고 베타 앱 심사에 낸다(2026-11-22).
// App Store Connect 화면 로그인은 친구 폰의 인증번호가 필요해서, iOS 빌드를 올릴 때 이미 쓰는 API 열쇠(ASC_*)로 대신한다.
// GitHub Actions의 `testflight` 워크플로가 부른다. 사용법은 docs/mobile-release.md.
//
// MODE=list        읽기만 한다. 빌드·그룹·상태를 보여 준다.
// MODE=distribute  베타 심사를 내고(필요할 때) 외부 그룹에 넣는다.
// 내부 그룹은 절대 건드리지 않는다. 내부 테스팅은 팀 멤버(교장 선생님)에게 알림 메일이 간다(docs/mobile-release.md).
import { createPrivateKey, sign } from "node:crypto";
import { pathToFileURL } from "node:url";

const API = "https://api.appstoreconnect.apple.com";
const BUNDLE_ID = "site.modori.app";
// 문서: 20분보다 먼 만료는 거절된다. 여유를 둔다.
const TOKEN_LIFETIME_SECONDS = 15 * 60;
// 앱의 기본 언어는 한국어다. 빌드에 "시험할 내용"이 하나도 없을 때만 이 글을 넣는다.
const WHATS_NEW = "홈 화면 위젯(오늘 남은 할 일)을 더했어요. 위젯을 놓은 뒤 앱을 한 번 열었다가 홈으로 나가면 로그인이 위젯으로 넘어가요.";

const base64Url = (input) => Buffer.from(input).toString("base64url");

/** App Store Connect API용 JWT(ES256). 서명은 DER이 아니라 r‖s(ieee-p1363)여야 한다. */
export function makeToken({ keyId, issuerId, privateKey, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: issuerId, iat: issuedAt, exp: issuedAt + TOKEN_LIFETIME_SECONDS, aud: "appstoreconnect-v1" }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(privateKey), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64Url(signature)}`;
}

/** 외부 그룹이 딱 하나일 때만 그것을 돌려준다. 없거나 여럿이면 어느 그룹인지 모르니 멈춘다(내부 그룹은 늘 뺀다). */
export function pickExternalGroup(groups) {
  const external = groups.filter((group) => group.attributes?.isInternalGroup === false);
  if (external.length === 1) return external[0];
  const names = groups.map((group) => `${group.attributes?.name}(${group.attributes?.isInternalGroup ? "내부" : "외부"})`).join(", ");
  throw new Error(external.length === 0 ? `외부 테스트 그룹이 없다. 그룹: ${names || "없음"}` : `외부 그룹이 ${external.length}개라 어느 쪽인지 모른다. 그룹: ${names}`);
}

/** 빌드의 externalBuildState에서 다음에 할 일을 정한다. */
export function stepFor(externalBuildState) {
  switch (externalBuildState) {
    case "READY_FOR_BETA_SUBMISSION":
      return "submit";
    case "WAITING_FOR_BETA_REVIEW":
    case "IN_BETA_REVIEW":
    case "IN_EXPORT_COMPLIANCE_REVIEW":
    case "BETA_APPROVED":
    case "READY_FOR_BETA_TESTING":
    case "IN_BETA_TESTING":
      return "add-only";
    case "PROCESSING":
      return "wait";
    default:
      // PROCESSING_EXCEPTION, MISSING_EXPORT_COMPLIANCE, EXPIRED, BETA_REJECTED, NOT_APPLICABLE, 모르는 값
      return "blocked";
  }
}

async function call(token, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  // 오류는 Apple이 준 그대로 보여 준다(요청 열쇠는 들어 있지 않다).
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

const query = (params) => `?${new URLSearchParams(params)}`;

async function main() {
  const { MODE = "list", BUILD, VERSION = "1.1.0", ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 } = process.env;
  for (const [name, value] of Object.entries({ BUILD, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 })) {
    if (!value) throw new Error(`${name}이(가) 없다`);
  }
  if (MODE !== "list" && MODE !== "distribute") throw new Error(`MODE는 list나 distribute여야 한다: ${MODE}`);
  const token = makeToken({ keyId: ASC_KEY_ID, issuerId: ASC_ISSUER_ID, privateKey: ASC_KEY_P8 });

  const apps = (await call(token, "GET", `/v1/apps${query({ "filter[bundleId]": BUNDLE_ID })}`)).data;
  if (apps.length !== 1) throw new Error(`앱 ${BUNDLE_ID}을(를) 하나로 찾지 못했다: ${apps.length}개`);
  const appId = apps[0].id;

  const builds = (
    await call(token, "GET", `/v1/builds${query({ "filter[app]": appId, "filter[version]": BUILD, "filter[preReleaseVersion.version]": VERSION, limit: "5" })}`)
  ).data;
  if (builds.length !== 1) throw new Error(`버전 ${VERSION} 빌드 ${BUILD}을(를) 하나로 찾지 못했다: ${builds.length}개`);
  const build = builds[0];
  console.log(`빌드 ${VERSION} (${BUILD}): processingState=${build.attributes.processingState}, expired=${build.attributes.expired}, 올린 때=${build.attributes.uploadedDate}`);
  if (build.attributes.processingState !== "VALID" || build.attributes.expired) throw new Error("빌드가 아직 처리 중이거나 만료·실패 상태라 넣을 수 없다");

  const detail = (await call(token, "GET", `/v1/builds/${build.id}/buildBetaDetail`)).data.attributes;
  console.log(`외부 테스트 상태 externalBuildState=${detail.externalBuildState}, 내부 internalBuildState=${detail.internalBuildState}`);

  const groups = (await call(token, "GET", `/v1/apps/${appId}/betaGroups${query({ limit: "50" })}`)).data;
  for (const group of groups) {
    const { name, isInternalGroup, publicLinkEnabled, hasAccessToAllBuilds } = group.attributes;
    console.log(`그룹 "${name}": ${isInternalGroup ? "내부" : "외부"}, 공개 링크 ${publicLinkEnabled ? "켜짐" : "꺼짐"}, 모든 빌드 접근 ${hasAccessToAllBuilds ? "예" : "아니오"}`);
  }
  const localizations = (await call(token, "GET", `/v1/builds/${build.id}/betaBuildLocalizations`)).data;
  console.log(`"시험할 내용" 글: ${localizations.length ? localizations.map((item) => item.attributes.locale).join(", ") : "없음"}`);

  const group = pickExternalGroup(groups);
  const step = stepFor(detail.externalBuildState);
  console.log(`대상 외부 그룹: "${group.attributes.name}", 다음 할 일: ${step}`);
  if (MODE === "list") return;

  if (step === "wait" || step === "blocked") throw new Error(`externalBuildState=${detail.externalBuildState}라 지금은 넣지 않는다`);
  if (localizations.length === 0) {
    await call(token, "POST", "/v1/betaBuildLocalizations", {
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale: "ko", whatsNew: WHATS_NEW },
        relationships: { build: { data: { type: "builds", id: build.id } } },
      },
    });
    console.log('"시험할 내용" 글을 넣었다(ko)');
  }
  if (step === "submit") {
    await call(token, "POST", "/v1/betaAppReviewSubmissions", {
      data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build.id } } } },
    });
    console.log("베타 앱 심사에 냈다");
  }
  await call(token, "POST", `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: "builds", id: build.id }] });
  console.log(`외부 그룹 "${group.attributes.name}"에 넣었다`);

  const after = (await call(token, "GET", `/v1/builds/${build.id}/buildBetaDetail`)).data.attributes;
  console.log(`끝난 뒤 externalBuildState=${after.externalBuildState}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
