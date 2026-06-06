"use client";
// Tiny toast system: a provider holds a queue, useToast() pushes messages, and
// each auto-dismisses. Used for transient feedback (copied to clipboard, an
// upload/chat error, the server waking up) instead of swallowing it silently.
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { IconCheck, IconX } from "./icons";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}
interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-slate-800 text-white dark:bg-slate-700",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium shadow-lg ${STYLES[t.kind]}`}
          >
            {t.kind === "success" && <IconCheck size={16} />}
            <span>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="ml-1 opacity-70 hover:opacity-100"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

// Falls back to a no-op if used outside the provider, so components never crash.
export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { toast: () => {} };
}
