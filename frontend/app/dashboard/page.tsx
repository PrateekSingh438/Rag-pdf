"use client";
// Home dashboard: a greeting, a progress stat strip (streak / questions / quizzes /
// documents), "jump back in" recent activity, "focus areas" (weak topics), and the
// list of knowledge bases with create + one-click demo onboarding.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { Button, Input, Card, Spinner } from "@/components/ui";

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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Welcome back{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your study companion — pick up where you left off, or start a new course.
          </p>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard emoji="🔥" label="Day streak" value={stats?.current_streak ?? 0} />
          <StatCard emoji="❓" label="Questions asked" value={stats?.questions_asked ?? 0} />
          <StatCard emoji="📋" label="Quizzes taken" value={stats?.quizzes_taken ?? 0} />
          <StatCard emoji="📚" label="Documents" value={stats?.documents_uploaded ?? 0} />
        </div>

        {/* Recent + weak topics */}
        {stats && (stats.recent.length > 0 || stats.weak_topics.length > 0) && (
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {stats.recent.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Jump back in</h2>
                <ul className="space-y-2">
                  {stats.recent.slice(0, 5).map((r, i) => {
                    const inner = (
                      <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span>{r.kind === "quiz" ? "📋" : "💬"}</span>
                        <span className="truncate">{r.title}</span>
                      </span>
                    );
                    return (
                      <li key={i}>
                        {r.kb_id ? (
                          <Link href={`/kb/${r.kb_id}`} className="block rounded px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            {stats.weak_topics.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Focus areas</h2>
                <p className="mb-2 text-xs text-slate-400">Topics with your lowest quiz scores</p>
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
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Your knowledge bases</h2>
        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="New knowledge base name (e.g. Data Structures)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKb()}
            />
            <Button onClick={createKb} disabled={creating || !name.trim()} className="sm:w-36">
              {creating ? <Spinner className="border-white/40 border-t-white" /> : "Create"}
            </Button>
            <Button variant="secondary" onClick={addDemo} disabled={seeding} className="sm:w-44">
              {seeding ? <Spinner /> : "✨ Try a sample course"}
            </Button>
          </div>
        </Card>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</p>}

        {fetching ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : kbs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <p>No knowledge bases yet.</p>
            <p className="mt-1 text-sm">Create one above, or click <strong>Try a sample course</strong> to explore with demo content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kbs.map((kb) => (
              <Card key={kb.id} className="group flex flex-col p-5 transition-shadow hover:shadow-md">
                <Link href={`/kb/${kb.id}`} className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                      📚
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100">{kb.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400">Created {new Date(kb.created_at).toLocaleDateString()}</p>
                </Link>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                  <Link href={`/kb/${kb.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                    Open workspace →
                  </Link>
                  <button onClick={() => removeKb(kb.id)} className="text-sm text-slate-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  );
}
