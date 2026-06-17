"use client";
// Small set of reusable, styled primitives so the pages stay readable. Plain
// Tailwind + the glass/aurora tokens from globals.css — no component library.
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  // Solid ink button — black in light, white in dark (Apple-style).
  primary:
    "bg-[var(--btn)] text-[var(--on-btn)] shadow-lg shadow-black/15 hover:opacity-90 disabled:opacity-50 disabled:shadow-none",
  // Same ink treatment (kept as a separate name for call sites).
  accent:
    "bg-[var(--btn)] text-[var(--on-btn)] shadow-lg shadow-black/15 hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-slate-300/70 bg-white/70 text-slate-700 backdrop-blur-sm hover:bg-white hover:border-slate-300 disabled:opacity-50 dark:border-slate-600/70 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800",
  ghost:
    "text-slate-600 hover:bg-slate-900/5 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10",
  danger: "text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-300/80 bg-white/70 px-3.5 py-2.5 text-sm text-slate-900 backdrop-blur-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--primary)] focus:bg-white focus:ring-2 focus:ring-black/10 dark:border-slate-600/80 dark:bg-slate-800/55 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-white/20 ${className}`}
      {...props}
    />
  );
}

// Frosted glass surface. Add `lift` to make it rise + glow on hover (globals.css).
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--primary)] dark:border-slate-600 ${className}`}
      aria-label="loading"
    />
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready:
      "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    processing:
      "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300",
    failed: "bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20 dark:text-red-300",
  };
  return (
    <Badge
      className={
        map[status] ||
        "bg-slate-500/10 text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300"
      }
    >
      {status}
    </Badge>
  );
}
