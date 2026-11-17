"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { acceptAiChatConsent, applyAiPlan, undoAiPlan } from "@/app/(tabs)/ai/actions";
import type { ChatResponse } from "@/app/api/ai/chat/route";
import { Dori } from "@/components/dori";
import { useLocale, useT } from "@/components/locale-provider";
import { parseKSTDate, weekdayKST } from "@/lib/date";
import { formatMonthDay, weekdayName } from "@/lib/i18n/format";
import { aichat } from "@/lib/i18n/messages/aichat";
import type { PlanEvent, PlanTodo } from "@/lib/ai/plan";

type Proposal = { todos: PlanTodo[]; events: PlanEvent[] };
type Applied = { state: "idle" } | { state: "adding" } | { state: "added"; todos: number; events: number; batchIds: string[] } | { state: "undone" } | { state: "failed"; message: string };
type Message = { id: number; role: "user" | "assistant"; text: string; proposal?: Proposal; applied?: Applied; isError?: boolean };

/**
 * AI 도우미 대화 화면(2026-11-17, docs/decisions.md). 대화는 이 화면의 상태에만 있고 서버에 저장하지 않는다(새로 고치면 사라진다).
 * AI가 제안한 할 일·일정은 미리보기로 보이고, 사용자가 골라서 "모도리에 넣기"를 눌러야 저장된다.
 * 동의하지 않은 사람에게는 무엇이 어디로 전송되는지 먼저 보이고, 동의해야 대화창이 열린다.
 */
export function AiChat({ consented, configured }: { consented: boolean; configured: boolean }) {
  const t = useT(aichat);
  if (!configured) return <p role="note" className="rounded-2xl bg-surface p-5 text-sm leading-relaxed text-muted">{t("notConfigured")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="rounded-2xl bg-surface-hover px-4 py-3 text-[13px] leading-relaxed text-muted">
        {t("disclaimer")}
      </p>
      {consented ? <Conversation /> : <Consent />}
    </div>
  );
}

function Consent() {
  const t = useT(aichat);
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      await acceptAiChatConsent();
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="ai-consent-title" className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
      <h2 id="ai-consent-title" className="text-base font-bold">
        {t("consentTitle")}
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
        {(["consent1", "consent2", "consent3", "consent4", "consent5"] as const).map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-5 accent-brand" />
        {t("consentCheck")}
      </label>
      <button
        type="button"
        disabled={!checked || pending}
        onClick={accept}
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-50"
      >
        {pending ? t("consentSaving") : t("consentStart")}
      </button>
    </section>
  );
}

function Conversation() {
  const t = useT(aichat);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  function errorText(response: Extract<ChatResponse, { ok: false }>): string {
    switch (response.error) {
      case "busy":
        return t("errorBusy");
      case "limit-burst":
        return t("errorBurst", { seconds: response.retryAfter ?? 10 });
      case "limit-day":
        return t("errorDay");
      case "blocked":
        return t("errorBlocked");
      case "unavailable":
        return t("errorUnavailable");
      case "format":
        return t("errorFormat");
      case "not-configured":
        return t("notConfigured");
      default:
        return t("errorGeneric");
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const user: Message = { id: nextId.current++, role: "user", text: trimmed };
    const history = [...messages, user];
    setMessages(history);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 오류 말풍선은 AI가 한 말이 아니므로 대화에 싣지 않는다.
        body: JSON.stringify({ messages: history.filter((message) => !message.isError).map((message) => ({ role: message.role, text: message.text })) }),
      });
      const data = (await response.json().catch(() => null)) as ChatResponse | null;
      if (data?.ok) {
        const proposal = data.todos.length > 0 || data.events.length > 0 ? { todos: data.todos, events: data.events } : undefined;
        setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: data.reply, proposal, applied: proposal ? { state: "idle" } : undefined }]);
      } else {
        const text = data && !data.ok ? errorText(data) : t("errorGeneric");
        setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text, isError: true }]);
      }
    } catch (error) {
      console.error("[ai] 대화를 보내지 못했다.", error instanceof Error ? error.name : error);
      setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: t("errorGeneric"), isError: true }]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function setApplied(id: number, applied: Applied) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, applied } : message)));
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <Dori mood="hello" size={80} />
          <p className="text-sm leading-relaxed text-muted">{t("intro")}</p>
          <p className="text-xs text-muted">{t("suggestionsLabel")}</p>
          <ul className="flex w-full flex-col gap-2">
            {(["suggestion1", "suggestion2", "suggestion3"] as const).map((key) => (
              <li key={key}>
                <button type="button" onClick={() => void send(t(key))} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm leading-relaxed">
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div role="log" aria-label={t("conversation")} aria-live="polite" className="flex flex-col gap-3">
          {messages.map((message) => (
            <Bubble key={message.id} message={message} onApplied={(applied) => setApplied(message.id, applied)} />
          ))}
          {pending && (
            <p role="status" className="px-1 text-sm text-muted">
              {t("thinking")}…
            </p>
          )}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={onSubmit} className="sticky bottom-2 flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-lg">
        <label className="sr-only" htmlFor="ai-input">
          {t("inputLabel")}
        </label>
        <textarea
          id="ai-input"
          value={input}
          maxLength={2000}
          rows={2}
          disabled={pending}
          placeholder={t("inputPlaceholder")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 입력 중(조합 중)의 Enter는 보내지 않는다.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send(input);
            }
          }}
          className="w-full resize-none rounded-xl bg-surface-hover px-3 py-2 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <div className="flex items-center justify-between gap-2">
          {messages.length > 0 ? (
            <button type="button" onClick={() => setMessages([])} disabled={pending} className="h-10 rounded-lg px-3 text-sm text-muted">
              {t("newChat")}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={pending || input.trim() === ""} className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast disabled:opacity-50">
            {t("send")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ message, onApplied }: { message: Message; onApplied: (applied: Applied) => void }) {
  const t = useT(aichat);
  const mine = message.role === "user";
  return (
    <div className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
      <span className="px-1 text-xs text-muted">{mine ? t("you") : t("assistant")}</span>
      <p
        className={`max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          mine ? "bg-brand text-brand-contrast" : message.isError ? "bg-surface text-danger" : "bg-surface"
        }`}
      >
        {message.text}
      </p>
      {message.proposal && message.applied && <ProposalCard proposal={message.proposal} applied={message.applied} onApplied={onApplied} />}
    </div>
  );
}

function ProposalCard({ proposal, applied, onApplied }: { proposal: Proposal; applied: Applied; onApplied: (applied: Applied) => void }) {
  const t = useT(aichat);
  const locale = useLocale();
  // 고르지 않은 것만 담는다(처음에는 모두 고른 상태).
  const [off, setOff] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const picked = {
    todos: proposal.todos.filter((_, index) => !off.has(`t${index}`)),
    events: proposal.events.filter((_, index) => !off.has(`e${index}`)),
  };
  const count = picked.todos.length + picked.events.length;

  const when = (value: string) => {
    const date = parseKSTDate(value);
    return `${formatMonthDay(locale, date)} (${weekdayName(locale, weekdayKST(date))})`;
  };

  function toggle(key: string) {
    setOff((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (count === 0) {
      onApplied({ state: "failed", message: t("addInvalid") });
      return;
    }
    onApplied({ state: "adding" });
    startTransition(async () => {
      try {
        const result = await applyAiPlan(picked);
        if (result.ok) onApplied({ state: "added", todos: result.todos, events: result.events, batchIds: result.batchIds });
        else onApplied({ state: "failed", message: result.reason === "partial" ? t("addPartial") : result.reason === "invalid" ? t("addInvalid") : t("addRejected") });
      } catch (error) {
        console.error("[ai] 제안을 저장하지 못했다.", error instanceof Error ? error.name : error);
        onApplied({ state: "failed", message: t("errorGeneric") });
      }
    });
  }

  function undo(batchIds: string[]) {
    startTransition(async () => {
      try {
        const result = await undoAiPlan(batchIds);
        onApplied(result.ok ? { state: "undone" } : { state: "failed", message: t("undoFailed") });
      } catch (error) {
        console.error("[ai] 되돌리지 못했다.", error instanceof Error ? error.name : error);
        onApplied({ state: "failed", message: t("undoFailed") });
      }
    });
  }

  return (
    <section aria-label={t("proposalTitle")} className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{t("proposalTitle")}</h3>
      {proposal.todos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted">{t("todosTitle")}</p>
          <ul className="flex flex-col gap-1">
            {proposal.todos.map((todo, index) => (
              <li key={`t${index}`}>
                <label className="flex items-start gap-3 py-1 text-sm leading-relaxed">
                  <input type="checkbox" checked={!off.has(`t${index}`)} onChange={() => toggle(`t${index}`)} disabled={applied.state !== "idle" && applied.state !== "failed"} className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span>
                    <span className="text-muted">{when(todo.date)}</span> {todo.content}
                    <span className="text-xs text-muted"> · {todo.category ?? t("uncategorized")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposal.events.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted">{t("eventsTitle")}</p>
          <ul className="flex flex-col gap-1">
            {proposal.events.map((event, index) => (
              <li key={`e${index}`}>
                <label className="flex items-start gap-3 py-1 text-sm leading-relaxed">
                  <input type="checkbox" checked={!off.has(`e${index}`)} onChange={() => toggle(`e${index}`)} disabled={applied.state !== "idle" && applied.state !== "failed"} className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span>
                    <span className="text-muted">{event.startDate === event.endDate ? when(event.startDate) : `${when(event.startDate)} ~ ${when(event.endDate)}`}</span>
                    {event.startTime ? <span className="text-muted"> {event.startTime}{event.endTime ? `-${event.endTime}` : ""}</span> : null} {event.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(applied.state === "idle" || applied.state === "failed" || applied.state === "adding") && (
        <button type="button" onClick={add} disabled={pending || applied.state === "adding"} className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60">
          {applied.state === "adding" ? t("adding") : t("addToModori", { count })}
        </button>
      )}
      {applied.state === "failed" && (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {applied.message}
        </p>
      )}
      {applied.state === "added" && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium">
            {t("added", { todos: applied.todos, events: applied.events })}
          </p>
          <button type="button" onClick={() => undo(applied.batchIds)} disabled={pending} className="h-10 self-start rounded-xl bg-surface-hover px-4 text-sm font-semibold disabled:opacity-60">
            {t("undo")}
          </button>
        </div>
      )}
      {applied.state === "undone" && (
        <p role="status" className="text-sm text-muted">
          {t("undone")}
        </p>
      )}
    </section>
  );
}
