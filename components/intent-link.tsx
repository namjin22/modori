"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

import { LinkPending } from "@/components/link-pending";

/**
 * 화면에 보인다고 미리 받기엔 너무 많은 링크(달력 한 달 30칸)를 위한 링크. 손가락이 닿거나 마우스를 올리는 순간
 * 그 칸만 데이터까지 미리 받는다(prefetch를 그때 켠다). 누르기까지의 0.1~0.3초 동안 서버를 다녀와 기다림이 준다.
 * router.prefetch는 동적 화면에서 뼈대만 받아 와서(데이터 없음) 효과가 없었다.
 */
export function IntentLink({ href, children, ...rest }: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const [warm, setWarm] = useState(false);
  const heat = () => setWarm(true);
  return (
    <Link href={href} prefetch={warm} onPointerEnter={heat} onTouchStart={heat} onFocus={heat} {...rest}>
      {children}
      <LinkPending />
    </Link>
  );
}
