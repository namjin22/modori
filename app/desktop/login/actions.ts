"use server";

import { signIn, signOut } from "@/lib/auth";
import { isAppLoginProvider, isChallenge, isMobileSource } from "@/lib/desktop-login";

function readRequest(formData: FormData) {
  const provider = formData.get("provider");
  const challenge = formData.get("challenge");
  if (!isAppLoginProvider(provider) || !isChallenge(challenge)) return null;
  // 모바일 앱이 보낸 경로 이름. 로그인 뒤 돌아올 주소에 이어 붙여야 가입을 앱 안에서 마칠 수 있다(app/desktop/login/page.tsx).
  const from = formData.get("from");
  return { provider, challenge, from: isMobileSource(from) ? from : null };
}

function returnPath({ challenge, from }: { challenge: string; from: string | null }): string {
  return `/desktop/login?challenge=${challenge}${from ? `&from=${from}` : ""}`;
}

// 앱에서 로그아웃해도 시스템 브라우저에는 이전 로그인이 남는다. 계정을 고를 수 있게 Google은 항상 계정 선택 창을 띄운다.
// DataGSM·Apple은 이 값을 모르면 무시한다.
const CHOOSE_ACCOUNT = { prompt: "select_account" };

/**
 * 앱에서 누른 로그인 버튼을 브라우저에서 이어 간다. 로그인을 마치면 같은 challenge로
 * /desktop/login에 돌아와 코드를 받는다.
 */
export async function continueDesktopLogin(formData: FormData) {
  const request = readRequest(formData);
  if (!request) return;
  await signIn(request.provider, { redirectTo: returnPath(request) }, CHOOSE_ACCOUNT);
}

/** 이 브라우저에 남은 로그인(앞서 앱에서 쓰던 계정)을 끊고 다른 계정으로 로그인한다. */
export async function switchDesktopAccount(formData: FormData) {
  const request = readRequest(formData);
  if (!request) return;
  await signOut({ redirect: false });
  await signIn(request.provider, { redirectTo: returnPath(request) }, CHOOSE_ACCOUNT);
}
