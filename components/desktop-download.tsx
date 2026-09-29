"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";

/**
 * "Windows 앱 받기". 누르면 다운로드가 시작되고 설치 안내 창이 같이 뜬다.
 *
 * 설치 파일에 코드 서명이 없어 처음 실행하면 Windows가 "Windows의 PC 보호"(게시자 알 수 없음)를 띄운다.
 * 인증서는 비용이 들어 아직 없다. 여기서 누를 곳을 모르면 설치를 포기하므로 그 순서를 미리 보여준다.
 * 링크는 그대로 두어 다운로드는 브라우저가 한다(창은 안내만 한다).
 */
export function DesktopDownload() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <a
        href={DESKTOP_DOWNLOAD_URL}
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl bg-surface p-5"
      >
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-semibold">Windows 앱 받기</span>
          <span className="text-xs text-muted">브라우저를 열지 않고 바탕화면에서 바로 써요</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-contrast">
          다운로드
        </span>
      </a>

      <Modal open={open} onClose={() => setOpen(false)} title="설치하는 방법">
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <p className="text-muted">다운로드가 시작됐어요. 아래 순서대로 설치해 주세요.</p>
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              다운로드가 끝나면 <b>Modori-Setup.exe</b>를 실행해요. 브라우저의 다운로드 목록이나 다운로드 폴더에 있어요.
            </Step>
            <Step n={2}>
              <b>&ldquo;Windows의 PC 보호&rdquo;</b> 창이 뜨면 <b>추가 정보</b>를 누르고, 아래에 생긴 <b>실행</b>을 눌러요.
              <span className="mt-1 block text-xs text-muted">
                모도리가 아직 유료 서명 인증서가 없어서 &ldquo;게시자: 알 수 없음&rdquo;으로 뜨는 경고예요. 파일은 모도리 GitHub에서
                직접 만든 것이에요.
              </span>
            </Step>
            <Step n={3}>설치 창 없이 바로 설치되고 모도리가 열려요. 바탕화면과 시작 메뉴에 아이콘이 생겨요.</Step>
          </ol>
          <div className="rounded-xl bg-surface-hover p-3 text-xs text-muted">
            <p className="font-semibold text-foreground">이미 설치했다면</p>
            <p className="mt-1">
              다시 실행해도 괜찮아요. 새 버전으로 바뀌고 로그인과 설정은 그대로예요. 모도리가 켜져 있으면 &ldquo;실행
              중입니다&rdquo; 창이 뜨는데, <b>확인</b>을 누르면 닫고 설치한 뒤 다시 열어요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            알겠어요
          </button>
        </div>
      </Modal>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-contrast">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
