"use client";
// Study plan: generate a day-by-day revision schedule from the KB's notes + exams,
// front-loading the highest-yield topics. Shows the plan as a list of day cards.
import { useState } from "react";
import * as api from "@/lib/api";
import { StudyPlanDay } from "@/lib/api";
import { Button, Input, Spinner } from "./ui";
import { IconCalendar, IconX } from "./icons";

export function StudyPlanDialog({
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
  const [days, setDays] = useState(7);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState("");
  const [plan, setPlan] = useState<StudyPlanDay[] | null>(null);

  if (!open) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const r = await api.generateStudyPlan(token, kbId, days, hours);
      if (!r.has_docs) {
        setError("Upload some notes and exam papers first, then generate a plan.");
      } else {
        setOverview(r.overview);
        setPlan(r.days);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <IconCalendar size={18} className="text-indigo-500" /> Study plan
          </h2>
          <button onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
            <IconX size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Days
            <Input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Hours / day
            <Input
              type="number"
              min={1}
              max={12}
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </label>
          <Button onClick={generate} disabled={busy} className="w-36">
            {busy ? <Spinner className="border-white/40 border-t-white" /> : plan ? "Regenerate" : "Generate plan"}
          </Button>
        </div>

        {error && <p className="mx-5 mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</p>}

        {(busy || plan) && (
          <div className="scroll-thin flex-1 overflow-y-auto border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            {busy ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Building your plan from your material…</p>
            ) : (
              <>
                {overview && <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{overview}</p>}
                <ol className="space-y-3">
                  {plan!.map((d) => (
                    <li key={d.day} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
                          {d.day}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d.focus}</span>
                      </div>
                      {d.topics.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {d.topics.map((t, i) => (
                            <span key={i} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <ul className="ml-4 list-disc space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                        {d.tasks.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
