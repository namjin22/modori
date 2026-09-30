import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { PRIVACY_MANAGER } from "@/lib/privacy";

export const metadata: Metadata = { title: "계정과 데이터 삭제 · 모도리" };

// 스토어(Google Play)가 앱을 설치하지 않아도 볼 수 있는 삭제 안내 주소를 요구한다.
export default function AccountDeletionPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-16 pt-8 md:max-w-2xl">
      <header className="flex items-center gap-1">
        <BackLink href="/" label="돌아가기" />
        <h1 className="text-2xl font-bold">계정과 데이터 삭제</h1>
      </header>

      <div className="flex flex-col gap-5 text-sm leading-relaxed">
        <p className="text-muted">
          모도리(Modori) 계정을 지우면 내 정보가 모두 사라져요. 아래 방법으로 직접 지울 수 있어요.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">1. 앱이나 웹에서 지우기</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted">
            <li>모도리에 로그인해요.</li>
            <li>아래 탭에서 마이페이지를 열어요.</li>
            <li>맨 아래의 &quot;계정 지우기&quot;를 눌러요.</li>
            <li>지워질 기록의 개수를 확인하고, 닉네임을 그대로 입력한 뒤 지워요.</li>
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">2. 로그인할 수 없을 때</h2>
          <p className="text-muted">
            <a href={`mailto:${PRIVACY_MANAGER.email}`} className="text-brand underline">
              {PRIVACY_MANAGER.email}
            </a>
            으로 가입한 이메일 주소를 적어 보내 주세요. 본인 확인 뒤 계정을 지워요.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">3. 무엇이 지워지나요</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            <li>
              이메일, 로그인한 계정의 고유 번호, 닉네임, 소개, 프로필 사진, 개인정보 동의 시각
            </li>
            <li>할 일, 카테고리, 루틴, 일정, 메모</li>
            <li>보낸 반응과 받은 반응, 팔로우와 팔로워 관계, 알림 기록</li>
            <li>로그인 유지 정보와 모도리를 쓴 날짜 기록</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">4. 얼마나 남나요</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            <li>서비스 화면에서는 지우는 즉시 사라져요.</li>
            <li>사고에 대비한 백업에는 최대 7일 동안 남았다가 지워져요.</li>
            <li>
              누구인지 알 수 없는 하루 합계 숫자(몇 명이 썼는지)는 남아요. 개인을 알아볼 수 없어요.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">5. 계정은 두고 일부만 지우고 싶다면</h2>
          <p className="text-muted">
            앱 안에서 할 일, 카테고리, 루틴, 일정을 하나씩 지울 수 있어요.
          </p>
        </section>
      </div>
    </main>
  );
}
