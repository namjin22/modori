"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { blockUser, reportUser } from "@/app/(tabs)/feed/safety-actions";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { useSaveFailure } from "@/components/use-save-failure";
import { MAX_REPORT_DETAIL, REPORT_REASONS, type ReportReason } from "@/lib/report";

type Step = "menu" | "report" | "block";

/**
 * 다른 사람의 화면 위쪽의 "⋯" 버튼. 신고하기와 차단하기가 여기 있다(App Store 심사 지침 1.2: 사용자가 만든 내용이 보이는 앱은
 * 신고와 차단 수단이 있어야 한다). 신고는 운영자가 확인하고, 차단하면 서로의 팔로우·반응이 지워지고 서로 보이지 않는다.
 */
export function SafetyMenu({ targetId, nickname }: { targetId: string; nickname: string }) {
  const [step, setStep] = useState<Step | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();
  const router = useRouter();

  const close = () => {
    setStep(null);
    setReason("");
  };

  function report(formData: FormData) {
    if (!reason) return;
    const detail = String(formData.get("detail") ?? "");
    startTransition(async () => {
      try {
        const result = await reportUser(targetId, reason, detail);
        toast({ message: result.message });
        if (result.ok) close();
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  function block() {
    startTransition(async () => {
      try {
        const result = await blockUser(targetId);
        toast({ message: result.message });
        if (result.ok) {
          close();
          router.push("/feed");
        }
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  const row = "flex h-12 w-full items-center rounded-xl bg-surface-hover px-4 text-left text-[15px] font-medium";

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("menu")}
        aria-label={`${nickname} 신고·차단`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted hover:bg-surface-hover"
      >
        ⋯
      </button>

      <Modal open={step !== null} onClose={close} title={step === "report" ? "신고하기" : step === "block" ? "차단하기" : nickname}>
        {step === "menu" && (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setStep("report")} className={row}>
              신고하기
            </button>
            <button type="button" onClick={() => setStep("block")} className={`${row} text-danger`}>
              차단하기
            </button>
          </div>
        )}

        {step === "report" && (
          <form action={report} className="flex flex-col gap-3">
            <p className="text-sm text-muted">{nickname}님의 어떤 점이 문제인가요? 운영자가 확인해요.</p>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">신고 이유</legend>
              {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex h-11 cursor-pointer items-center gap-3 rounded-xl px-4 text-[15px] ${
                    reason === key ? "bg-brand-subtle ring-1 ring-brand" : "bg-surface-hover"
                  }`}
                >
                  <input type="radio" name="reason" value={key} checked={reason === key} onChange={() => setReason(key)} className="accent-brand" />
                  {label}
                </label>
              ))}
            </fieldset>
            <textarea
              name="detail"
              maxLength={MAX_REPORT_DETAIL}
              rows={3}
              placeholder="자세한 내용 (선택)"
              aria-label="신고 내용"
              className="w-full resize-none rounded-xl bg-surface-hover px-4 py-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={!reason || pending}
              className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-50"
            >
              {pending ? "보내는 중" : "신고하기"}
            </button>
          </form>
        )}

        {step === "block" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {nickname}님을 차단하면 서로의 팔로우와 반응이 지워지고, 서로 찾거나 팔로우할 수 없어요. 마이페이지의 차단한 사용자에서
              언제든 풀 수 있어요.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={block}
              className="h-11 rounded-xl bg-danger text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "차단하는 중" : "차단하기"}
            </button>
            <button type="button" onClick={close} className="h-11 rounded-xl bg-surface-hover text-sm font-medium">
              취소
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
