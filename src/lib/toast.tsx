import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

const TOAST_EVENT = 'switchboard:toast';

export function emitToast(message: string, tone: ToastTone = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        message,
        tone,
      },
    })
  );
}

export const ToastViewport: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<ToastItem>;
      if (!custom.detail?.message) return;
      const item = custom.detail;
      setToasts((prev) => [...prev.slice(-2), item]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 3200);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[72px] md:bottom-5 left-3 right-3 md:right-auto md:max-w-sm z-[90] pointer-events-none flex flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const icon =
            t.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : t.tone === 'warning' || t.tone === 'error' ? (
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  t.tone === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              />
            ) : (
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            );

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-300 dark:border-white/15 shadow-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs text-zinc-950 dark:text-zinc-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                {icon}
                <span className="truncate font-medium">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="p-1 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
