"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "campusgpt-theme";

export function ThemeToggle({ onToggle }: { onToggle?: () => void }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    document.documentElement.style.colorScheme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
    onToggle?.();
  }

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="theme-toggle inline-flex min-h-10 items-center gap-2 rounded-full border border-[#dce3db] bg-white px-3 text-xs font-semibold text-[#516157] transition hover:bg-[#f7f9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      type="button"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
