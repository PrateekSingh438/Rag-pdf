"use client";
// Public "how good is the search, and how do I know" page. The numbers are a
// STATIC snapshot of an offline benchmark (backend/app/eval/run_eval.py) measured
// on a fixed, hand-labeled test set — not the visitor's live data — so they're
// baked in here and the page needs no backend or login. Written to be readable by
// a non-technical visitor while still showing a technical reviewer real rigor.
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { NavBar } from "@/components/NavBar";
import { Card } from "@/components/ui";
import {
  IconGradCap, IconSun, IconMoon, IconSearch, IconTarget, IconCheck,
  IconArrowRight, IconArrowLeft,
} from "@/components/icons";

// Real output of `python -m app.eval.run_eval` (18 questions, 9 docs, k=3).
const BENCHMARK = {
  num_questions: 18,
  num_documents: 9,
  k: 3,
  // MRR is identical across chunk sizes, so these summarize the reranker's effect.
  mrr_without: 0.88,
  mrr_with: 0.97,
  recall_without: 0.89, // at 256-word chunks
  recall_with: 0.92,
  runs: [
    { chunk: 256, reranker: false, recall: 0.889, hit: 1.0, mrr: 0.88 },
    { chunk: 256, reranker: true, recall: 0.917, hit: 1.0, mrr: 0.972 },
    { chunk: 512, reranker: false, recall: 1.0, hit: 1.0, mrr: 0.88 },
    { chunk: 512, reranker: true, recall: 1.0, hit: 1.0, mrr: 0.972 },
  ],
};

const METRICS = [
  {
    icon: IconCheck,
    name: "Hit-rate@3",
    plain: "Did it find the right material at all?",
    detail: "How often at least one correct source appears in the top 3 results.",
  },
  {
    icon: IconSearch,
    name: "Recall@3",
    plain: "Did it find the right pages?",
    detail: "Of the chunks that actually contain the answer, the share that made the top 3.",
  },
  {
    icon: IconTarget,
    name: "MRR",
    plain: "Did it put the best source first?",
    detail: "How high the first correct source ranks. 1.0 means it was always the #1 result.",
  },
];

function Bar({ value, highlight }: { value: number; highlight?: boolean }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div
        className={`h-3 rounded-full ${highlight ? "bg-indigo-600" : "bg-slate-400 dark:bg-slate-500"}`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export default function BenchmarkPage() {
  const auth = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
      {auth.token ? (
        <NavBar />
      ) : (
        <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <IconGradCap size={18} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">StudyMate</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              Get started
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Link
          href={auth.token ? "/dashboard" : "/"}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <IconArrowLeft size={15} /> Back
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          How good is the search?
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          A RAG app is only as good as its retrieval: if it pulls the wrong pages, the answer is
          wrong no matter how smart the model is. So StudyMate is measured on a fixed set of
          questions whose correct sources are known in advance. Here are the results.
        </p>

        {/* Headline */}
        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            Headline result
          </div>
          <div className="px-6 py-6">
            <p className="text-lg text-slate-800 dark:text-slate-100">
              Adding a <strong>cross-encoder reranker</strong> raised <strong>MRR from {BENCHMARK.mrr_without} to {BENCHMARK.mrr_with}</strong> —
              it reads each candidate against the question and pushes the correct source to the top.
            </p>
            <div className="mt-5 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>Without reranker</span><span>{BENCHMARK.mrr_without.toFixed(2)}</span>
                </div>
                <Bar value={BENCHMARK.mrr_without} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>With reranker</span><span>{BENCHMARK.mrr_with.toFixed(2)}</span>
                </div>
                <Bar value={BENCHMARK.mrr_with} highlight />
              </div>
            </div>
          </div>
        </Card>

        {/* What the metrics mean */}
        <h2 className="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">What the numbers mean</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {METRICS.map(({ icon: Icon, name, plain, detail }) => (
            <Card key={name} className="p-5">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Icon size={20} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</h3>
              <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{plain}</p>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
            </Card>
          ))}
        </div>

        {/* Full results table */}
        <h2 className="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">Full results</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every combination of chunk size and reranker, higher is better for all three.
        </p>
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
                <th className="px-4 py-3 font-medium">Configuration</th>
                <th className="px-4 py-3 font-medium">Hit-rate@3</th>
                <th className="px-4 py-3 font-medium">Recall@3</th>
                <th className="px-4 py-3 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK.runs.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {r.chunk}-word chunks, {r.reranker ? "with" : "without"} reranker
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.hit.toFixed(3)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{r.recall.toFixed(3)}</td>
                  <td className={`px-4 py-3 tabular-nums ${r.reranker ? "font-semibold text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300"}`}>
                    {r.mrr.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Methodology / honesty */}
        <Card className="mt-8 p-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">How this was measured</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {BENCHMARK.num_questions} hand-labeled questions across {BENCHMARK.num_documents} documents, each tagged
              with the source that actually answers it. We check where that source lands in the top {BENCHMARK.k} results.
            </li>
            <li>These three metrics need no LLM, so they are deterministic and fully reproducible.</li>
            <li>
              The harness also scores answer <strong>faithfulness</strong> with an LLM-as-judge (does the written
              answer stay supported by the sources), run separately.
            </li>
            <li>
              <strong>Honest caveat:</strong> this is a small, fixed test set, so read it as directional evidence that
              the pipeline works, not as a leaderboard. It is a static offline snapshot, not your live documents.
            </li>
          </ul>
          <p className="mt-3 text-slate-400">
            Reproduce with <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">python -m app.eval.run_eval</code>.
          </p>
        </Card>

        {!auth.token && (
          <div className="mt-10 text-center">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Try StudyMate <IconArrowRight size={16} />
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
