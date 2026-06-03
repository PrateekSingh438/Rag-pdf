"use client";
// Small set of reusable, styled primitives so the pages stay readable. Plain
// Tailwind, no component library.
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-transparent text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-indigo-900 ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
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
    ready: "bg-emerald-100 text-emerald-700",
    processing: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  return <Badge className={map[status] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}>{status}</Badge>;
}
