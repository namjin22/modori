"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { deleteDiary, saveDiary } from "@/app/(tabs)/diary/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { DIARY_EMOJIS, DIARY_MOODS, MAX_DIARY_LENGTH, diaryLength } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";

export type DiaryDraft = { content: string; mood: string | null; isPublic: boolean };

/**
 * 하루치 일기를 쓰고 고치는 칸. 글과 이모지(오늘의 기분, 글 사이에 끼우는 이모지)를 적고, 기본은 나만 보며 일기마다 친구 공개를 켤 수 있다.
 * 저장해도 칸을 비우지 않는다(이어서 고친다). 날짜가 바뀌면 부른 쪽이 key로 새로 그린다.
 */
export function DiaryEditor({ date, initial }: { date: string; initial: DiaryDraft | null }) {
  const t = useT(diary);
  const router = useRouter();
  const saveFailed = useSaveFailure();
  const [content, setContent] = useState(initial?.content ?? "");
  // 기분과 공개 여부도 값을 쥐고 있는다. 기본값만 주고 두면 저장 뒤 router.refresh()가 서버 값을 다시 내려줄 때, 그 사이에 바꾼 선택이 되돌아간다.
  const [mood, setMood] = useState(initial?.mood ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [exists, setExists] = useState(initial !== null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const length = diaryLength(content);
  const tooLong = length > MAX_DIARY_LENGTH;
  // 무엇이든 바꾸면 "저장했어요."는 지난 저장에 대한 말이라 지운다.
  const changeMood = (value: string) => {
    setMood(value);
    setMessage(null);
  };
  const changePublic = (value: boolean) => {
    setIsPublic(value);
    setMessage(null);
  };
  const empty = content.trim() === "";

  /** 커서가 있는 자리(글을 고르고 있었다면 그 글을 대신해서)에 이모지를 끼운다. */
  function insert(emoji: string) {
    const element = textarea.current;
    const start = element?.selectionStart ?? content.length;
    const end = element?.selectionEnd ?? start;
    setContent(content.slice(0, start) + emoji + content.slice(end));
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      const caret = start + emoji.length;
      element.setSelectionRange(caret, caret);
    });
  }

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

  const moodItem =
    "flex size-11 cursor-pointer items-center justify-center rounded-xl bg-surface-hover text-2xl transition-colors peer-checked:bg-brand peer-checked:ring-2 peer-checked:ring-brand peer-focus-visible:ring-2 peer-focus-visible:ring-foreground";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">{t("moodLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="radio" name="mood" value="" checked={mood === ""} onChange={() => changeMood("")} className="peer sr-only" />
            <span className="flex h-11 cursor-pointer items-center justify-center rounded-xl bg-surface-hover px-3 text-sm text-muted transition-colors peer-checked:bg-brand peer-checked:text-brand-contrast peer-focus-visible:ring-2 peer-focus-visible:ring-foreground">
              {t("moodNone")}
            </span>
          </label>
          {DIARY_MOODS.map((option) => (
            <label key={option}>
              <input type="radio" name="mood" value={option} checked={mood === option} onChange={() => changeMood(option)} aria-label={option} className="peer sr-only" />
              <span aria-hidden className={moodItem}>
                {option}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="diary-content" className="text-xs text-muted">
          {t("contentLabel")}
        </label>
        <textarea
          id="diary-content"
          ref={textarea}
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
        <div className="flex items-start justify-between gap-3">
          <details className="group min-w-0 flex-1">
            <summary className="flex h-9 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full bg-surface px-3 text-sm text-muted hover:text-foreground">
              <span aria-hidden>😊</span>
              {t("emojiLabel")}
            </summary>
            <div role="group" aria-label={t("emojiLabel")} className="mt-2 flex flex-wrap gap-1 rounded-2xl bg-surface p-2">
              {DIARY_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={emoji}
                  onClick={() => insert(emoji)}
                  className="flex size-10 items-center justify-center rounded-lg text-xl hover:bg-surface-hover active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </details>
          <span className={`shrink-0 pt-2 text-xs ${tooLong ? "text-danger" : "text-muted"}`}>{t("counter", { count: length, max: MAX_DIARY_LENGTH })}</span>
        </div>
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
