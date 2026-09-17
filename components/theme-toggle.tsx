"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 다른 탭에서 바꾼 경우와, 아직 고르지 않았을 때 기기 설정이 바뀐 경우도 따라간다.
  window.addEventListener("storage", onChange);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

/**
 * 고른 값이 있으면 그것, 없으면 기기 설정이 보여주는 쪽.
 * "기기 설정"을 따로 고르는 칸은 없앴지만, 처음 들어온 사람에게 라이트를 강요하면
 * 다크 모드 기기에서 화면이 한 번 하얗게 번쩍인다. 시작값으로만 기기 설정을 쓴다.
 */
function getTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch (error) {
    // 시크릿 모드처럼 저장소를 못 읽는 경우가 있다. 기기 설정으로 본다.
    console.warn("[theme] 저장된 테마를 읽지 못했다.", error);
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

// 서버에는 localStorage도 기기 설정도 없다. 마운트 후 실제 값으로 맞춘다.
function getServerTheme(): Theme {
  return "light";
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("theme", theme);
  } catch (error) {
    console.error("[theme] 테마를 저장하지 못했다.", error);
  }

  listeners.forEach((onChange) => onChange());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  return (
    <div
      role="radiogroup"
      aria-label="화면 테마"
      className="flex gap-1 rounded-xl bg-surface-hover p-1"
    >
      {OPTIONS.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              isActive
                ? "bg-surface font-semibold text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
