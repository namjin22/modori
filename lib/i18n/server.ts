import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, translator, type Locale, type MessageBundle, type Translate } from "@/lib/i18n";

/** 이 기기에 적어 둔 언어. 고른 적이 없으면 null. */
export async function getLocaleCookie(): Promise<Locale | null> {
  try {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : null;
  } catch (error) {
    // 화면을 정적으로 미리 만드는 중이라는 신호 같은 Next의 제어용 예외는 그대로 올려야 이 화면이 요청마다 그려진다.
    unstable_rethrow(error);
    // 요청 밖(시험 등)에서 부르면 쿠키를 읽을 수 없다. 기본 언어로 그린다.
    console.warn("[locale] 쿠키를 읽지 못해 기본 언어로 그린다.", error instanceof Error ? error.name : error);
    return null;
  }
}

/** 지금 요청의 화면 언어. 서버 화면과 서버 동작이 쓴다(브라우저 쪽은 components/locale-provider.tsx). */
export async function getLocale(): Promise<Locale> {
  return (await getLocaleCookie()) ?? DEFAULT_LOCALE;
}

export async function getT<K extends string>(bundle: MessageBundle<K>): Promise<Translate<K>> {
  return translator(bundle, await getLocale());
}
