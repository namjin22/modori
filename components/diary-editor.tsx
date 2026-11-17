"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { deleteDiary, saveDiary } from "@/app/(tabs)/diary/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useLocale, useT } from "@/components/locale-provider";
import { ReactionGlyph } from "@/components/reaction-glyph";
import { useSaveFailure } from "@/components/use-save-failure";
import type { CharacterId } from "@/lib/characters";
import { MAX_DIARY_LENGTH, diaryLength, diaryMoodOptions } from "@/lib/diary";
import { diary } from "@/lib/i18n/messages/diary";
import { labelOfReaction } from "@/lib/reactions";

export type DiaryDraft = { content: string; mood: string | null; isPublic: boolean };

/**
 * 하루치 일기를 쓰고 고치는 칸. 글과 오늘의 기분(내 캐릭터의 표정)을 적고, 기본은 나만 보며 일기마다 친구 공개를 켤 수 있다.
 * 저장해도 칸을 비우지 않는다(이어서 고친다). 날짜가 바뀌면 부른 쪽이 key로 새로 그린다.
 */
export function DiaryEditor({ date, initial, character }: { date: string; initial: DiaryDraft | null; character: CharacterId }) {
  const t = useT(diary);
  const locale = useLocale();
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

  const length = diaryLength(content);
  const tooLong = length > MAX_DIARY_LENGTH;
  const empty = content.trim() === "";
  // 지금 캐릭터의 표정 열 개. 예전에 다른 캐릭터로 고른 기분이 저장돼 있으면 그것도 맨 앞에 둬서 그대로 보이고 다시 고를 수 있다.
  const options = diaryMoodOptions(character);
  if (initial?.mood && !options.includes(initial.mood)) options.unshift(initial.mood);

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

  const faceBox =
    "flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-surface-hover transition-transform hover:scale-105 active:scale-95 peer-checked:bg-brand/25 peer-checked:ring-2 peer-checked:ring-brand peer-focus-visible:ring-2 peer-focus-visible:ring-foreground";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="date" value={date} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">{t("moodLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="radio" name="mood" value="" checked={mood === ""} onChange={() => changeMood("")} className="peer sr-only" />
            <span className="flex h-14 cursor-pointer items-center justify-center rounded-2xl bg-surface-hover px-3 text-sm text-muted transition-colors peer-checked:bg-brand peer-checked:text-brand-contrast peer-focus-visible:ring-2 peer-focus-visible:ring-foreground">
              {t("moodNone")}
            </span>
          </label>
          {options.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="mood"
                value={option}
                checked={mood === option}
                onChange={() => changeMood(option)}
                aria-label={labelOfReaction(option, locale)}
                className="peer sr-only"
              />
              <span aria-hidden className={faceBox}>
                <ReactionGlyph value={option} size={44} />
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
