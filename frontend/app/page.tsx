"use client";
// Logged-out landing page. Authenticated visitors are sent straight to /dashboard.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui";

const FEATURES = [
  { emoji: "🔎", title: "Grounded, cited answers", body: "Every answer comes only from your uploaded notes and papers, with clickable [S1] citations — and says \"I couldn't find this\" instead of guessing." },
  { emoji: "🖼️", title: "Scanned PDFs welcome", body: "Most exam papers are scans. Built-in OCR reads image-only PDFs so they're searchable too." },
  { emoji: "🎯", title: "Know what to study", body: "Key-topics and exam-insight analysis surface the highest-yield, most-tested concepts across your material." },
  { emoji: "📅", title: "Quizzes & study plans", body: "Generate practice questions, take scored quizzes, and get a day-by-day revision plan tailored to your course." },
  { emoji: "💬", title: "Streaming chat with memory", body: "Ask follow-ups naturally — answers stream in token-by-token and remember the conversation." },
  { emoji: "📊", title: "Measured quality", body: "An evaluation dashboard quantifies retrieval quality (recall@k, MRR) and answer faithfulness — not just vibes." },
];

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!auth.loading && auth.token) router.replace("/dashboard");
  }, [auth.loading, auth.token, router]);

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
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">S</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">StudyMate</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Sign in
          </Link>
          <Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:py-24">
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          AI study companion
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
          Study from <span className="text-indigo-600 dark:text-indigo-400">your</span> notes and past papers — answered with citations.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Upload your notes and previous-year question papers, then ask anything. StudyMate answers only from your
          material, links concepts to past exam questions, and helps you practise.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
            Get started free
          </Link>
          <Link href="/login" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 text-2xl">{f.emoji}</div>
              <h3 className="mb-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
        StudyMate — grounded RAG study assistant. Built with FastAPI + Next.js.
      </footer>
    </div>
  );
}
