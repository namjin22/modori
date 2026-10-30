"use client";

import { useEffect, useRef } from "react";

import { setLocale } from "@/app/locale-actions";
import type { Locale } from "@/lib/i18n";

/**
 * 기기의 쿠키와 계정의 언어가 어긋났을 때 한 번 맞춘다((tabs)/layout.tsx가 어긋난 때만 그린다).
 * 이 기기에 고른 적이 없으면(새 기기) 계정의 언어를 쿠키에 적고, 로그인 화면에서 방금 언어를 골랐으면 그 언어를 계정에 적는다.
 * 쿠키는 서버 화면을 그리는 도중에는 바꿀 수 없어서, 처음 한 번은 옛 언어로 그려진 뒤 바뀐다.
 */
export function LocaleSync({ target }: { target: Locale }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    setLocale(target).catch((error) => console.warn("[locale] 언어를 맞추지 못했다.", error instanceof Error ? error.name : error));
  }, [target]);
  return null;
}
