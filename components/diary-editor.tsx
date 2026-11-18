"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties, type FormEvent } from "react";

import { deleteDiary, saveDiary } from "@/app/(tabs)/diary/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { MOOD_COLORS, MoodIcon } from "@/components/mood-icon";
import { useSaveFailure } from "@/components/use-save-failure";
import { DIARY_MOODS, MAX_DIARY_LENGTH, MOOD_LABEL_KEYS, diaryLength, isDiaryMood } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";

export type DiaryDraft = { content: string; mood: string | null; isPublic: boolean };

/**
 * 하루치 일기를 쓰고 고치는 칸. 글과 오늘의 기분("마음 날씨" 여섯 가지)을 적고, 기본은 나만 보며 일기마다 친구 공개를 켤 수 있다.
 * 저장해도 칸을 비우지 않는다(이어서 고친다). 날짜가 바뀌면 부른 쪽이 key로 새로 그린다.
 */
export function DiaryEditor({ date, initial }: { date: string; initial: DiaryDraft | null }) {
  const t = useT(diary);
  const router = useRouter();
  const saveFailed = useSaveFailure();
  const [content, setContent] = useState(initial?.content ?? "");
  // 기분과 공개 여부도 값을 쥐고 있는다. 기본값만 주고 두면 저장 뒤 router.refresh()가 서버 값을 다시 내려줄 때, 그 사이에 바꾼 선택이 되돌아간다.
  const [mood, setMood] = useState(initial?.mood && isDiaryMood(initial.mood) ? initial.mood : "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [exists, setExists] = useState(initial !== null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const length = diaryLength(content);
  const tooLong = length > MAX_DIARY_LENGTH;
  const empty = content.trim() === "";

  // 무엇이든 바꾸면 "저장했어요."는 지난 저장에 대한 말이라 지운다.
  const changeMood = (value: string) => {
    setMood(value);
    setMessage(null);
  };
  const changePublic = (value: boolean) => {
    setIsPublic(value);
    setMessage(null);
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || empty || tooLong) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await saveDiary(formData);
        setMessage(result ? { text: result.message, ok: result.ok === true } : null);
        if (result?.ok) {
          setExists(true);
          router.refresh();
        }
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteDiary(date);
        router.push("/diary");
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-xs text-muted">{t("moodLabel")}</legend>
        {/* 마음 날씨 여섯 가지. 칸마다 대표색을 옅게 깔고, 고르면 그 색 테두리가 둘러지며 살짝 떠올라 톡 튄다. */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {DIARY_MOODS.map((key) => (
            <label key={key} className="block">
              <input type="radio" name="mood" value={key} checked={mood === key} onChange={() => changeMood(key)} className="peer sr-only" />
              <span
                style={{ "--mood": MOOD_COLORS[key] } as CSSProperties}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl bg-[color-mix(in_srgb,var(--mood)_14%,transparent)] px-1 pb-2.5 pt-3 text-xs text-muted ring-2 ring-transparent transition-all hover:-translate-y-0.5 active:scale-95 peer-checked:-translate-y-0.5 peer-checked:animate-pop peer-checked:font-semibold peer-checked:text-foreground peer-checked:ring-[color:var(--mood)] peer-focus-visible:ring-foreground"
              >
                <MoodIcon mood={key} size={56} />
                {t(MOOD_LABEL_KEYS[key])}
              </span>
            </label>
          ))}
        </div>
        <label className="self-start">
          <input type="radio" name="mood" value="" checked={mood === ""} onChange={() => changeMood("")} className="peer sr-only" />
          <span className="flex h-8 cursor-pointer items-center rounded-full bg-surface px-3 text-xs text-muted transition-colors hover:text-foreground peer-checked:bg-surface-hover peer-checked:font-semibold peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-foreground">
            {t("moodNone")}
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="diary-content" className="text-xs text-muted">
          {t("contentLabel")}
        </label>
        <textarea
          id="diary-content"
          name="content"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setMessage(null);
          }}
          rows={12}
          placeholder={t("placeholder")}
          className="min-h-64 w-full resize-y rounded-2xl bg-surface-hover p-4 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <p className={`self-end text-xs ${tooLong ? "text-danger" : "text-muted"}`}>{t("counter", { count: length, max: MAX_DIARY_LENGTH })}</p>
      </div>

      <LabeledSwitch name="public" title={t("publicTitle")} description={t("publicHint")} checked={isPublic} onChange={changePublic} />

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-muted" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || empty || tooLong}
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>

      {exists &&
        (confirming ? (
          <div role="alert" className="flex flex-col gap-2 rounded-xl bg-surface-hover p-3">
            <p className="text-sm leading-relaxed">{t("removeConfirm")}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="h-10 rounded-xl bg-surface px-4 text-sm font-semibold">
                {t("cancel")}
              </button>
              <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
                {t("removeAction")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="h-10 self-center rounded-lg px-3 text-sm font-medium text-danger">
            {t("remove")}
          </button>
        ))}
    </form>
  );
}
