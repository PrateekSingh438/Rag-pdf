"use client";
// Logged-out landing page. Authenticated visitors are sent straight to /dashboard.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui";
import * as api from "@/lib/api";
import {
  IconGradCap, IconSun, IconMoon, IconSearch, IconFile, IconTarget,
  IconCalendar, IconMessage, IconChart, IconArrowRight, IconUsers,
} from "@/components/icons";

const FEATURES = [
  { icon: IconSearch, title: "Grounded, cited answers", body: "Every answer comes only from your uploaded notes and papers, with clickable [S1] citations — and says \"I couldn't find this\" instead of guessing." },
  { icon: IconFile, title: "Scanned PDFs welcome", body: "Most exam papers are scans. Built-in OCR reads image-only PDFs so they're searchable too." },
  { icon: IconTarget, title: "Know what to study", body: "Key-topics and exam-insight analysis surface the highest-yield, most-tested concepts across your material." },
  { icon: IconCalendar, title: "Quizzes & study plans", body: "Generate practice questions, take scored quizzes, and get a day-by-day revision plan tailored to your course." },
  { icon: IconMessage, title: "Streaming chat with memory", body: "Ask follow-ups naturally — answers stream in token-by-token and remember the conversation." },
  { icon: IconChart, title: "Measured quality", body: "An evaluation dashboard quantifies retrieval quality (recall@k, MRR) and answer faithfulness — not just vibes." },
];

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [site, setSite] = useState<api.SiteStats | null>(null);

  useEffect(() => {
    if (!auth.loading && auth.token) router.replace("/dashboard");
  }, [auth.loading, auth.token, router]);

  useEffect(() => {
    api.recordVisit().then(setSite).catch(() => {});
  }, []);

  if (auth.loading || auth.token) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <IconGradCap size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">StudyMate</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Sign in
          </Link>
          <Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-4xl px-4 py-16 text-center sm:py-24">
        {/* soft glow */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/20" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
          <IconGradCap size={14} /> AI study companion
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
          Study from <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">your</span> notes and past papers — answered with citations.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Upload your notes and previous-year question papers, then ask anything. StudyMate answers only from your
          material, links concepts to past exam questions, and helps you practise.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
            Get started free <IconArrowRight size={16} />
          </Link>
          <Link href="/login" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            Sign in
          </Link>
        </div>

        {/* Social proof — live counts */}
        {site && (
          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <IconUsers size={16} className="text-indigo-500" />
              <strong className="font-semibold text-slate-700 dark:text-slate-200">{site.total_users.toLocaleString()}</strong> learners
            </span>
            <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="inline-flex items-center gap-1.5">
              <IconMessage size={16} className="text-indigo-500" />
              <strong className="font-semibold text-slate-700 dark:text-slate-200">{site.total_questions.toLocaleString()}</strong> questions answered
            </span>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900">
              <div className="mb-3.5 grid h-11 w-11 place-items-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Icon size={22} />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/benchmark" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            See how retrieval quality is measured <IconArrowRight size={15} />
          </Link>
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
        StudyMate — grounded RAG study assistant. Built with FastAPI + Next.js.
      </footer>
    </div>
  );
}
