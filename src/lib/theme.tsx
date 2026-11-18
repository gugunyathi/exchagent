import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'switchboard_theme';
const THEME_EVENT = 'switchboard:theme';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const isDark = mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = mode;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', isDark ? '#09090b' : '#f4f4f5');
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors in restricted contexts
  }
  window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: mode }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    const sync = (ev: Event) => {
      const next = (ev as CustomEvent<ThemeMode>).detail;
      if (next === 'light' || next === 'dark') {
        setThemeState(next);
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === THEME_STORAGE_KEY) {
        const next: ThemeMode = ev.newValue === 'dark' ? 'dark' : 'light';
        applyTheme(next);
        setThemeState(next);
      }
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}

interface ThemeToggleProps {
  variant?: 'header' | 'segmented';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'header' }) => {
  const { theme, setTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Color theme"
        className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 p-0.5 text-xs font-medium"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
          className={`flex-1 min-h-[34px] px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors ${
            theme === 'light'
              ? 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
          className={`flex-1 min-h-[34px] px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-800 text-zinc-50 font-semibold shadow-xs border border-white/15'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <>
      {/* Compact single-tap toggle on narrow phones so header icons never clip */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="sm:hidden w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 inline-flex items-center justify-center shrink-0 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-sky-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </button>

      {/* Dual segmented selector on >= 640px */}
      <div
        role="group"
        aria-label="Theme selector"
        className="hidden sm:inline-flex h-9 items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 p-0.5 gap-0.5 shrink-0"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-label="Light mode"
          aria-pressed={theme === 'light'}
          title="Light Mode"
          className={`h-7 px-2 rounded-lg inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
            theme === 'light'
              ? 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200/80'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Sun className={`w-3.5 h-3.5 shrink-0 ${theme === 'light' ? 'text-amber-500' : ''}`} />
          <span className="hidden xl:inline">Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-label="Dark mode"
          aria-pressed={theme === 'dark'}
          title="Dark Mode"
          className={`h-7 px-2 rounded-lg inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-zinc-800 text-zinc-50 font-semibold shadow-xs border border-white/15'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Moon className={`w-3.5 h-3.5 shrink-0 ${theme === 'dark' ? 'text-sky-400' : ''}`} />
          <span className="hidden xl:inline">Dark</span>
        </button>
      </div>
    </>
  );
};
