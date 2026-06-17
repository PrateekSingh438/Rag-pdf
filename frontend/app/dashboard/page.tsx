"use client";
// Home dashboard: a greeting, a progress stat strip (streak / questions / quizzes /
// documents), "jump back in" recent activity, "focus areas" (weak topics), and the
// list of knowledge bases with create + one-click demo onboarding. Icons are
// line-style SVGs (see icons.tsx) — no emoji.
import { useEffect, useState, useCallback, ComponentType } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { Button, Input, Card, Spinner } from "@/components/ui";
import { Reveal, CountUp } from "@/components/motion";
import {
  IconFlame, IconMessage, IconClipboard, IconBook, IconSparkles,
  IconArrowRight, IconTarget, IconTrash, IconPlus,
} from "@/components/icons";

export default function DashboardPage() {
  const { token, user, loading } = useRequireAuth();
  const [kbs, setKbs] = useState<api.KB[]>([]);
  const [stats, setStats] = useState<api.Stats | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [list] = await Promise.all([api.listKBs(token)]);
      setKbs(list);
      api.getStats(token).then(setStats).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  async function createKb() {
    if (!token || !name.trim()) return;
    setCreating(true);
    try {
      await api.createKB(token, name.trim());
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function addDemo() {
    if (!token) return;
    setSeeding(true);
    try {
      await api.createDemoKB(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create demo");
    } finally {
      setSeeding(false);
    }
  }

  async function removeKb(id: number) {
    if (!token) return;
    if (!confirm("Delete this knowledge base and all its documents and chats?")) return;
    await api.deleteKB(token, id);
    refresh();
  }

  if (loading || !token) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  const firstName = (user?.name || user?.email || "").split(/[@ ]/)[0];

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back{firstName ? <>, <span className="text-gradient">{firstName}</span></> : ""}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Your study companion — pick up where you left off, or start a new course.
          </p>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={IconFlame} tint="orange" label="Day streak" value={stats?.current_streak ?? 0} />
          <StatCard icon={IconMessage} tint="blue" label="Questions asked" value={stats?.questions_asked ?? 0} />
          <StatCard icon={IconClipboard} tint="sky" label="Quizzes taken" value={stats?.quizzes_taken ?? 0} />
          <StatCard icon={IconBook} tint="emerald" label="Documents" value={stats?.documents_uploaded ?? 0} />
        </div>

        {/* Recent + weak topics */}
        {stats && (stats.recent.length > 0 || stats.weak_topics.length > 0) && (
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {stats.recent.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Jump back in</h2>
                <ul className="space-y-1">
                  {stats.recent.slice(0, 5).map((r, i) => {
                    const Icon = r.kind === "quiz" ? IconClipboard : IconMessage;
                    const inner = (
                      <span className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <Icon size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate">{r.title}</span>
                      </span>
                    );
                    return (
                      <li key={i}>
                        {r.kb_id ? (
                          <Link href={`/kb/${r.kb_id}`} className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            {inner}
                          </Link>
                        ) : (
                          <div className="px-2 py-1.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            {stats.weak_topics.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <IconTarget size={16} className="text-[var(--primary)]" /> Focus areas
                </h2>
                <p className="mb-3 text-xs text-slate-400">Topics with your lowest quiz scores</p>
                <ul className="space-y-2">
                  {stats.weak_topics.map((w, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-slate-700 dark:text-slate-200">{w.topic}</span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${w.avg_pct < 50 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                        {w.avg_pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* Knowledge bases */}
        <h2 className="mb-3 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">Your knowledge bases</h2>
        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="New knowledge base name (e.g. Data Structures)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKb()}
            />
            <Button onClick={createKb} disabled={creating || !name.trim()} className="sm:w-36">
              {creating ? <Spinner className="border-white/40 border-t-white" /> : <><IconPlus size={16} /> Create</>}
            </Button>
            <Button variant="secondary" onClick={addDemo} disabled={seeding} className="sm:w-48">
              {seeding ? <Spinner /> : <><IconSparkles size={16} /> Try a sample course</>}
            </Button>
          </div>
        </Card>

        {error && <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-300">{error}</p>}

        {fetching ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : kbs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--btn)] text-[var(--on-btn)] shadow-lg shadow-black/15 ring-1 ring-white/20">
              <IconBook size={26} />
            </div>
            <p className="text-slate-600 dark:text-slate-300">No knowledge bases yet.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create one above, or click <strong>Try a sample course</strong> to explore with demo content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kbs.map((kb, i) => (
              <Reveal key={kb.id} delay={i * 60}>
              <Card className="group lift flex h-full flex-col p-5">
                <Link href={`/kb/${kb.id}`} className="flex-1">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--btn)] text-[var(--on-btn)] shadow-md shadow-black/15 ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-110">
                      <IconBook size={19} />
                    </span>
                    <h3 className="font-display text-lg font-semibold text-slate-900 transition-colors group-hover:text-[var(--primary)] dark:text-slate-100 dark:group-hover:text-[var(--primary)]">{kb.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400">Created {new Date(kb.created_at).toLocaleDateString()}</p>
                </Link>
                <div className="mt-4 flex items-center justify-between border-t border-(--hairline) pt-3">
                  <Link href={`/kb/${kb.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] transition-all hover:gap-1.5 dark:text-[var(--primary)]">
                    Open workspace <IconArrowRight size={15} />
                  </Link>
                  <button onClick={() => removeKb(kb.id)} title="Delete" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600">
                    <IconTrash size={16} />
                  </button>
                </div>
              </Card>
              </Reveal>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

const TINTS: Record<string, string> = {
  orange: "bg-[var(--btn)] shadow-black/15",
  blue: "bg-[var(--btn)] shadow-black/15",
  sky: "bg-[var(--btn)] shadow-black/15",
  emerald: "bg-[var(--btn)] shadow-black/15",
};

function StatCard({ icon: Icon, tint, label, value }: { icon: ComponentType<{ size?: number }>; tint: string; label: string; value: number }) {
  return (
    <Card className="group lift flex items-center gap-3 p-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--on-btn)] shadow-lg ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-110 ${TINTS[tint]}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          <CountUp value={value} />
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  );
}
