"use client";
// Exam insights: shows the highest-yield topics mined from the KB's uploaded exam
// papers, as a ranked list with relative-frequency bars and an example question.
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { ExamTopic } from "@/lib/api";
import { Spinner } from "./ui";

export function ExamInsightsDialog({
  token,
  kbId,
  open,
  onClose,
}: {
  token: string;
  kbId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [hasExams, setHasExams] = useState(true);
  const [topics, setTopics] = useState<ExamTopic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .getExamAnalysis(token, kbId)
      .then((r) => {
        setHasExams(r.has_exams);
        setTopics(r.topics);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to analyze"))
      .finally(() => setLoading(false));
  }, [open, token, kbId]);

  if (!open) return null;

  const maxCount = topics.reduce((m, t) => Math.max(m, t.count), 1);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">📊 Exam insights</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Most frequently tested topics in your uploaded papers</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
            ✕
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : !hasExams ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No exam papers yet. Upload PDFs with the <span className="font-medium">exam</span> type to see which
              topics come up most.
            </p>
          ) : topics.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Couldn&apos;t extract topics from your exams.</p>
          ) : (
            <ol className="space-y-3">
              {topics.map((t, i) => (
                <li key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.topic}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      {t.count}×
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-purple-500"
                      style={{ width: `${Math.max(8, (t.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  {t.example && <p className="mt-1 text-xs italic text-slate-500">e.g. {t.example}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
