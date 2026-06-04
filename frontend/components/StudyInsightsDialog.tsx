"use client";
// "Key topics" — cross-document study insights. Ranks the highest-yield topics
// across all of a KB's notes + exam papers: how important each is, how often it's
// tested in the exams, and whether it's covered in the notes.
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { StudyTopic } from "@/lib/api";
import { Spinner } from "./ui";
import { IconTarget, IconX } from "./icons";

const IMP_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function StudyInsightsDialog({
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
  const [hasDocs, setHasDocs] = useState(true);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .getStudyInsights(token, kbId)
      .then((r) => {
        setHasDocs(r.has_docs);
        setTopics(r.topics);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to analyze"))
      .finally(() => setLoading(false));
  }, [open, token, kbId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <IconTarget size={18} className="text-indigo-500" /> Key topics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Highest-yield topics across your notes &amp; exams — what to study first
            </p>
          </div>
          <button onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <IconX size={16} />
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</p>
          ) : !hasDocs ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Upload some notes and exam papers first, then come back to see your key topics.
            </p>
          ) : topics.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Couldn&apos;t extract topics from your material.
            </p>
          ) : (
            <ol className="space-y-3">
              {topics.map((t, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.topic}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${IMP_STYLE[t.importance]}`}>
                      {t.importance} yield
                    </span>
                    {t.exam_frequency > 0 && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        tested {t.exam_frequency}×
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {t.in_notes ? "• in notes" : "• not in notes"}
                    </span>
                  </div>
                  {t.example && <p className="text-xs italic text-slate-500 dark:text-slate-400">{t.example}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
