"use client";

import { type FormEvent, useState, useSyncExternalStore, useTransition } from "react";

import { createApiToken, deleteApiToken } from "@/app/(tabs)/settings/ai/actions";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { API_TOKEN_EXPIRY_DAYS, MAX_API_TOKENS, MAX_TOKEN_NAME_LENGTH, NO_EXPIRY } from "@/lib/api-token";
import { ai } from "@/lib/i18n/messages/ai";
import { common } from "@/lib/i18n/messages/common";

export type ApiTokenItem = {
  id: string;
  name: string;
  scope: "READ" | "WRITE" | "FULL";
  allowFriends: boolean;
  hint: string;
  /** 비어 있으면 만료 없음. */
  expiresOn: string | null;
  expired: boolean;
  lastUsedOn: string | null;
};

const subscribeNothing = () => () => {};

/** 서버는 Cloudflare 뒤 127.0.0.1에서 돌아 서버 쪽에서는 바깥 주소를 알 수 없다. 브라우저가 보고 있는 주소를 쓴다. */
function useOrigin(): string {
  return useSyncExternalStore(subscribeNothing, () => window.location.origin, () => "");
}

/** 접근 토큰 목록과 만들기(마이페이지 > AI 연결). 새 토큰의 값은 만든 직후 이 화면에서 한 번만 보인다. */
export function ApiTokenManager({ tokens }: { tokens: ApiTokenItem[] }) {
  const t = useT(ai);
  const serverUrl = `${useOrigin()}/mcp`;
  const [created, setCreated] = useState<string | null>(null);
  const full = tokens.length >= MAX_API_TOKENS;

  // 위에서부터: 연결 방법과 서버 주소, 토큰 만들기, 내 토큰(2026-11-16 요청: 중요한 것만 바로 보이게). 긴 설명은 아래 도움말(components/ai-guide.tsx).
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">{t("howTitle")}</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed">
          <li>{t("howStep1")}</li>
          <li>{t("howStep2")}</li>
          <li>{t("howStep3")}</li>
          <li>{t("howStep4")}</li>
        </ol>
        <CopyField label={t("serverUrl")} value={serverUrl} />
        <p className="text-xs leading-relaxed text-muted">{t("howNote")}</p>
      </section>

      {created !== null && <CreatedPanel token={created} serverUrl={serverUrl} onDone={() => setCreated(null)} />}

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">{t("createTitle")}</h2>
        {full ? <p className="text-sm text-muted">{t("full", { max: MAX_API_TOKENS })}</p> : <CreateForm onCreated={setCreated} />}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">{t("tokensTitle")}</h2>
        {tokens.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul aria-label={t("tokensTitle")} className="flex flex-col gap-2">
            {tokens.map((token) => (
              <TokenRow key={token.id} token={token} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TokenRow({ token }: { token: ApiTokenItem }) {
  const t = useT(ai);
  const tc = useT(common);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function remove() {
    startTransition(async () => {
      try {
        await deleteApiToken(token.id);
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <li className={`flex flex-col gap-2 rounded-2xl bg-surface p-4 ${token.expired ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-medium">{token.name}</span>
          <span className="text-xs text-muted">
            {token.hint}… · {token.scope === "FULL" ? t("scopeFull") : token.scope === "WRITE" ? t("scopeWrite") : t("scopeRead")}
            {token.allowFriends && ` · ${t("tagFriends")}`}
          </span>
          <span className="text-xs text-muted">
            {token.expired ? t("expired") : token.expiresOn ? t("until", { date: token.expiresOn }) : t("noExpiry")} ·{token.lastUsedOn ? t("lastUsed", { date: token.lastUsedOn }) : t("neverUsed")}
          </span>
        </div>
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-danger">
            {t("remove")}
          </button>
        )}
      </div>
      {confirming && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-surface-hover p-3">
          <p className="text-sm leading-relaxed">{t("removeConfirm", { name: token.name })}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="h-10 rounded-xl bg-surface px-4 text-sm font-semibold">
              {tc("cancel")}
            </button>
            <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
              {t("remove")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateForm({ onCreated }: { onCreated: (token: string) => void }) {
  const t = useT(ai);
  const [problem, setProblem] = useState("");
  // "만료 없음"을 골랐는지, 그때 권한이 모든 권한인지. 값은 폼이 들고 있고 여기서는 경고를 보일지만 안다.
  const [noExpiry, setNoExpiry] = useState(false);
  const [full, setFull] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function sync(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    setNoExpiry(data.get("days") === NO_EXPIRY);
    setFull(data.get("scope") === "FULL");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const result = await createApiToken(formData);
        if (result.ok) {
          setProblem("");
          form.reset();
          setNoExpiry(false);
          setFull(false);
          onCreated(result.token);
        } else {
          setProblem(result.message);
        }
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  const field = "h-12 rounded-xl bg-surface-hover px-4 text-[15px] text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={submit} onChange={sync} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        {t("nameLabel")}
        <input name="name" required maxLength={MAX_TOKEN_NAME_LENGTH} placeholder={t("namePlaceholder")} className={field} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">{t("scopeLabel")}</legend>
        <label className="flex items-start gap-3 rounded-xl bg-surface-hover p-3 text-sm">
          <input type="radio" name="scope" value="READ" defaultChecked className="mt-1 accent-brand" />
          <span className="flex flex-col">
            <span className="font-medium">{t("scopeRead")}</span>
            <span className="text-xs text-muted">{t("scopeReadHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl bg-surface-hover p-3 text-sm">
          <input type="radio" name="scope" value="WRITE" className="mt-1 accent-brand" />
          <span className="flex flex-col">
            <span className="font-medium">{t("scopeWrite")}</span>
            <span className="text-xs text-muted">{t("scopeWriteHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl bg-surface-hover p-3 text-sm">
          <input type="radio" name="scope" value="FULL" className="mt-1 accent-brand" />
          <span className="flex flex-col">
            <span className="font-medium">{t("scopeFull")}</span>
            <span className="text-xs text-muted">{t("scopeFullHint")}</span>
          </span>
        </label>
      </fieldset>

      {/* 친구의 공개 정보를 읽게 하는 것은 권한과 따로 고르고, 기본은 끈다. 친구가 정한 공개 범위는 "모도리 안의 팔로워"까지였다. */}
      <label className="flex items-start gap-3 rounded-xl bg-surface-hover p-3 text-sm">
        <input type="checkbox" name="friends" className="mt-1 accent-brand" />
        <span className="flex flex-col">
          <span className="font-medium">{t("friendsLabel")}</span>
          <span className="text-xs text-muted">{t("friendsHint")}</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        {t("expiryLabel")}
        <select name="days" defaultValue={90} className={field}>
          {API_TOKEN_EXPIRY_DAYS.map((days) => (
            <option key={days} value={days}>
              {t("days", { days })}
            </option>
          ))}
          <option value={NO_EXPIRY}>{t("noExpiry")}</option>
        </select>
      </label>
      {noExpiry && (
        <p role="note" className="-mt-2 text-xs leading-relaxed text-danger">
          {t("noExpiryWarn")}
          {full && ` ${t("noExpiryWarnFull")}`}
        </p>
      )}

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}

      <button type="submit" disabled={pending} className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60">
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}

/** 새 토큰의 값. 닫으면 다시 볼 수 없다. Claude Code에 넣는 명령도 값이 채워진 채로 보여 준다. */
function CreatedPanel({ token, serverUrl, onDone }: { token: string; serverUrl: string; onDone: () => void }) {
  const t = useT(ai);
  const command = `claude mcp add --transport http modori ${serverUrl} --header "Authorization: Bearer ${token}"`;

  return (
    <section role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-brand bg-surface p-5">
      <h2 className="text-base font-bold">{t("createdTitle")}</h2>
      <p className="text-sm leading-relaxed">{t("createdNote")}</p>
      <CopyField label={t("tokenLabel")} value={token} />
      <CopyField label={t("commandLabel")} value={command} />
      <button type="button" onClick={onDone} className="h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast">
        {t("done")}
      </button>
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useT(ai);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(t("copied"));
    } catch (error) {
      console.warn("[ai] 클립보드에 복사하지 못했다.", error);
      setMessage(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-brand"
        />
        <button type="button" onClick={copy} className="h-11 shrink-0 rounded-xl bg-surface-hover px-4 text-sm font-semibold">
          {t("copy")}
        </button>
      </div>
      {message && (
        <span role="status" className="text-xs text-muted">
          {message}
        </span>
      )}
    </div>
  );
}
