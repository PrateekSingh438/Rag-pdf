"use client";
// Modal dialog to generate practice questions for a topic. Calls /practice and
// shows the grounded question/answer list returned by the model.
import { useState } from "react";
import * as api from "@/lib/api";
import { Button, Input, Spinner } from "./ui";
import { IconSparkles, IconX } from "./icons";

export function PracticeDialog({
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
  const [topic, setTopic] = useState("");
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.generatePractice(token, kbId, topic.trim(), n);
      setResult(r.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-rise flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            <IconSparkles size={18} className="text-[var(--primary)]" /> Generate practice questions
          </h2>
          <button onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
            <IconX size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex gap-3">
            <Input
              placeholder="Topic (e.g. binary search trees)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
            <Input
              type="number"
              min={1}
              max={20}
              value={n}
              onChange={(e) => setN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-20"
            />
            <Button onClick={generate} disabled={busy || !topic.trim()} className="w-32">
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Generate"}
            </Button>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-300">{error}</p>}
        </div>

        {(busy || result) && (
          <div className="scroll-thin flex-1 overflow-y-auto border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            {busy ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Generating questions from your notes…</p>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100">{result}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
