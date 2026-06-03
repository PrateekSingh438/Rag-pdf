"use client";
// Interactive quiz: enter a topic, generate grounded multiple-choice questions,
// answer them, then submit to see the score, correct answers, and explanations.
import { useState } from "react";
import * as api from "@/lib/api";
import { QuizQuestion } from "@/lib/api";
import { Button, Input, Spinner } from "./ui";

export function QuizDialog({
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
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  function reset() {
    setQuestions(null);
    setAnswers({});
    setSubmitted(false);
    setError(null);
  }

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true);
    reset();
    try {
      const r = await api.generateQuiz(token, kbId, topic.trim(), n);
      if (!r.questions.length) setError("I couldn't build a quiz from your notes on that topic.");
      else setQuestions(r.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate quiz");
    } finally {
      setBusy(false);
    }
  }

  const allAnswered = questions ? questions.every((_, i) => answers[i] !== undefined) : false;
  const score = questions ? questions.filter((q, i) => answers[i] === q.answer_index).length : 0;

  function submitQuiz() {
    setSubmitted(true);
    if (questions) {
      // record the attempt for progress stats (best-effort)
      api.recordQuizAttempt(token, kbId, topic.trim() || "General", score, questions.length).catch(() => {});
    }
  }

  function optionClass(qi: number, oi: number, q: QuizQuestion) {
    if (!submitted) {
      return answers[qi] === oi
        ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
        : "border-slate-200 hover:border-indigo-300 dark:border-slate-600 dark:text-slate-200";
    }
    if (oi === q.answer_index) return "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    if (answers[qi] === oi) return "border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    return "border-slate-200 opacity-70 dark:border-slate-700 dark:text-slate-300";
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">📋 Quiz</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
            ✕
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
              max={15}
              value={n}
              onChange={(e) => setN(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
              className="w-20"
            />
            <Button onClick={generate} disabled={busy || !topic.trim()} className="w-32">
              {busy ? <Spinner className="border-white/40 border-t-white" /> : questions ? "Regenerate" : "Start"}
            </Button>
          </div>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        {questions && (
          <div className="scroll-thin flex-1 space-y-5 overflow-y-auto border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            {questions.map((q, qi) => (
              <div key={qi}>
                <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${optionClass(qi, oi, q)}`}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
                {submitted && q.explanation && (
                  <p className="mt-1.5 text-xs text-slate-500">💡 {q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {questions && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            {submitted ? (
              <>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Score: {score} / {questions.length}
                </p>
                <Button variant="secondary" onClick={() => { setSubmitted(false); setAnswers({}); }}>
                  Retry
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  {Object.keys(answers).length} / {questions.length} answered
                </p>
                <Button onClick={submitQuiz} disabled={!allAnswered}>
                  Submit
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
