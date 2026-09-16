"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "기기 설정" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 다른 탭에서 바꾼 경우도 따라간다.
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // 시크릿 모드처럼 저장소를 못 읽는 경우가 있다. 기기 설정으로 본다.
    return "system";
  }
}

// 서버에는 localStorage가 없다. 기기 설정을 기본으로 그리고, 마운트 후 실제 값으로 맞춘다.
function getServerTheme(): Theme {
  return "system";
}

function setTheme(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
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
