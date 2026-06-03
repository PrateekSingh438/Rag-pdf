"use client";
// Evaluation dashboard. Fetches /eval (written by app/eval/run_eval.py) and shows
// metric cards plus bar charts comparing the ablation configurations, making the
// reranker's impact on recall@k visible at a glance.
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { Card, Spinner } from "@/components/ui";

function configLabel(c: { chunk_size: number; use_reranker: boolean }) {
  return `${c.chunk_size}w ${c.use_reranker ? "+rerank" : "−rerank"}`;
}

export default function EvalsPage() {
  const { token, loading } = useRequireAuth();
  const [data, setData] = useState<api.EvalResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .getEvals(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No results yet"))
      .finally(() => setFetching(false));
  }, [token]);

  if (loading || !token) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  const chartData =
    data?.runs.map((r) => ({
      name: configLabel(r.config),
      "recall@k": Number(r.recall_at_k.toFixed(3)),
      MRR: Number(r.mrr.toFixed(3)),
      "hit@k": Number(r.hit_rate_at_k.toFixed(3)),
      faithfulness: Number(r.faithfulness.toFixed(3)),
      reranker: r.config.use_reranker,
    })) || [];

  const best =
    data?.runs.reduce((a, b) => (b.recall_at_k > a.recall_at_k ? b : a), data.runs[0]) || null;

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Evaluation</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How well StudyMate finds the right material and how trustworthy its answers are.
          </p>
        </div>

        <Card className="mb-6 p-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">What does this page mean?</p>
          <p className="mb-3">
            We test the system on a fixed set of questions (with known correct sources) and measure three things.
            Higher is better for all of them.
          </p>
          <ul className="space-y-1.5">
            <li><strong className="text-slate-800 dark:text-slate-100">Recall@k / Hit-rate@k</strong> — how often the correct document shows up in the top few results. &ldquo;Did it find the right material at all?&rdquo;</li>
            <li><strong className="text-slate-800 dark:text-slate-100">MRR</strong> — how high the correct source is ranked (1.0 = always first). &ldquo;Did it put the best source on top?&rdquo;</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Faithfulness</strong> — whether the written answer is actually supported by the sources (an AI judge scores 0–1). &ldquo;Is it making things up?&rdquo;</li>
          </ul>
          <p className="mt-3">
            The bars compare configurations. The <strong className="text-slate-800 dark:text-slate-100">reranker</strong> is a
            smarter second pass that re-orders results — notice it consistently improves the ranking (MRR) and recall.
          </p>
        </Card>

        {fetching ? (
          <div className="grid place-items-center py-20">
            <Spinner />
          </div>
        ) : error || !data ? (
          <Card className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">No evaluation results yet.</p>
            <p className="mt-2 text-sm">
              Generate them from the backend:
              <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                python -m app.eval.run_eval
              </code>
              then refresh this page.
            </p>
          </Card>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Questions" value={String(data.num_questions)} />
              <Stat label="k" value={String(data.k)} />
              <Stat
                label="Best recall@k"
                value={best ? best.recall_at_k.toFixed(3) : "—"}
                hint={best ? configLabel(best.config) : undefined}
              />
              <Stat
                label="Best MRR"
                value={
                  data.runs.length
                    ? Math.max(...data.runs.map((r) => r.mrr)).toFixed(3)
                    : "—"
                }
              />
            </div>

            <Card className="mb-6 p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Retrieval metrics by configuration
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="recall@k" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hit@k" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="MRR" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Answer faithfulness (LLM-as-judge)
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip />
                  <Bar dataKey="faithfulness" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.reranker ? "#7c3aed" : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-xs text-slate-400">
                Generated {new Date(data.generated_at).toLocaleString()}
              </p>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}
