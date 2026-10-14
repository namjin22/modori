import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { PRIVACY_MANAGER } from "@/lib/privacy";

export const metadata: Metadata = { title: "문의와 도움말 · 모도리", alternates: { canonical: "/support" } };

// App Store Connect의 "지원 URL". 로그인하지 않아도 볼 수 있고, 문의 방법과 자주 묻는 것을 적는다.
export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-16 pt-8 md:max-w-2xl">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="돌아가기" />
        <h1 className="text-2xl font-bold">문의와 도움말</h1>
      </header>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">문의하기</h2>
          <p className="text-muted">
            버그, 불편한 점, 신고, 그 밖의 궁금한 점은{" "}
            <a href={`mailto:${PRIVACY_MANAGER.email}`} className="text-brand underline">
              {PRIVACY_MANAGER.email}
            </a>
            으로 보내 주세요. 보통 하루 안에 답해요.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">자주 묻는 것</h2>
          <dl className="flex flex-col gap-3 text-muted">
            <div>
              <dt className="font-medium text-foreground">로그인이 안 돼요.</dt>
              <dd>Google, Apple, DataGSM 중 처음 가입할 때 쓴 방법으로 로그인해 주세요. 같은 이메일이어도 다른 방법이면 막힐 수 있어요.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">친구를 어떻게 찾나요?</dt>
              <dd>소셜 탭의 &quot;친구 찾기&quot;에서 닉네임을 검색하거나 추천 친구를 눌러 팔로우해요. 팔로우하면 친구가 공개한 카테고리의 할 일이 보여요.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">할 일 순서는 어떻게 바꾸나요?</dt>
              <dd>폰에서는 할 일을 길게 눌러 집은 뒤 끌어요. 컴퓨터에서는 줄을 잡고 끌어요.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">불쾌한 사람을 어떻게 하나요?</dt>
              <dd>그 사람의 화면 위쪽 &quot;⋯&quot;에서 신고하거나 차단할 수 있어요. 신고는 운영자가 확인해요.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">날짜가 하루 어긋나요.</dt>
              <dd>마이페이지의 &quot;시간대&quot;에서 지금 있는 나라·도시를 골라 주세요.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">계정을 지우고 싶어요.</dt>
              <dd>
                마이페이지 맨 아래 &quot;계정 지우기&quot;에서 바로 지울 수 있어요. 자세한 방법은{" "}
                <Link prefetch={false} href="/account-deletion" className="text-brand underline">
                  계정과 데이터 삭제
                </Link>
                에 있어요.
              </dd>
            </div>
          </dl>
        </section>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
          <Link prefetch={false} href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          <Link prefetch={false} href="/terms" className="underline">
            이용약관
          </Link>
        </p>
      </div>
    </main>
  );
}
