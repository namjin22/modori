"use server";

import { signIn } from "@/lib/auth";
import { isChallenge } from "@/lib/desktop-login";

/**
 * 앱에서 누른 로그인 버튼을 브라우저에서 이어 간다. 로그인을 마치면 같은 challenge로
 * /desktop/login에 돌아와 코드를 받는다.
 */
export async function continueDesktopLogin(formData: FormData) {
  const provider = formData.get("provider");
  const challenge = formData.get("challenge");
  if ((provider !== "google" && provider !== "datagsm") || !isChallenge(challenge)) return;
  await signIn(provider, { redirectTo: `/desktop/login?challenge=${challenge}` });
}
