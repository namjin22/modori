"use server";

import { signIn, signOut } from "@/lib/auth";
import { isChallenge } from "@/lib/desktop-login";

function readRequest(formData: FormData) {
  const provider = formData.get("provider");
  const challenge = formData.get("challenge");
  if ((provider !== "google" && provider !== "datagsm") || !isChallenge(challenge)) return null;
  return { provider, challenge };
}

// 앱에서 로그아웃해도 시스템 브라우저에는 이전 로그인이 남는다. 계정을 고를 수 있게 Google은 항상 계정 선택 창을 띄운다.
// DataGSM은 이 값을 모르면 무시한다.
const CHOOSE_ACCOUNT = { prompt: "select_account" };

/**
 * 앱에서 누른 로그인 버튼을 브라우저에서 이어 간다. 로그인을 마치면 같은 challenge로
 * /desktop/login에 돌아와 코드를 받는다.
 */
export async function continueDesktopLogin(formData: FormData) {
  const request = readRequest(formData);
  if (!request) return;
  await signIn(request.provider, { redirectTo: `/desktop/login?challenge=${request.challenge}` }, CHOOSE_ACCOUNT);
}

/** 이 브라우저에 남은 로그인(앞서 앱에서 쓰던 계정)을 끊고 다른 계정으로 로그인한다. */
export async function switchDesktopAccount(formData: FormData) {
  const request = readRequest(formData);
  if (!request) return;
  await signOut({ redirect: false });
  await signIn(request.provider, { redirectTo: `/desktop/login?challenge=${request.challenge}` }, CHOOSE_ACCOUNT);
}
