"use client";
// Profile & settings — a single scrollable page with four sections:
// 1) Profile info (name, email, avatar, institution) with a sticky Save bar,
// 2) Study stats summary + achievement badges, 3) Security (change password),
// 4) Danger zone (wipe all data, type-to-confirm).
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { Button, Input, Card, Spinner } from "@/components/ui";

function avatarFor(name: string | null, email: string, picture: string | null) {
  if (picture) return picture;
  const label = encodeURIComponent(name || email);
  return `https://ui-avatars.com/api/?name=${label}&background=4f46e5&color=fff&size=128`;
}

export default function ProfilePage() {
  const { token, user, setUser, loading } = useRequireAuth();

  // editable profile fields
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [picture, setPicture] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [stats, setStats] = useState<api.Stats | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setInstitution(user.institution || "");
      setPicture(user.picture || "");
    }
  }, [user]);

  useEffect(() => {
    if (token) api.getStats(token).then(setStats).catch(() => {});
  }, [token]);

  if (loading || !token || !user) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  const dirty =
    name !== (user.name || "") ||
    institution !== (user.institution || "") ||
    picture !== (user.picture || "");

  async function saveProfile() {
    if (!token) return;
    setSaving(true);
    setSavedMsg(false);
    setSaveErr(null);
    try {
      const updated = await api.updateProfile(token, { name, institution, picture });
      setUser({ ...updated });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-24">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Profile &amp; settings
        </h1>

        {/* 1. Profile info */}
        <Section title="Profile">
          <div className="flex flex-col gap-5 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarFor(name, user.email, picture)}
              alt="avatar"
              className="h-20 w-20 shrink-0 rounded-full border border-slate-200 dark:border-slate-700"
            />
            <div className="flex-1 space-y-4">
              <Field label="Display name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Email (read-only)">
                <Input value={user.email} disabled className="opacity-60" />
              </Field>
              <Field label="Avatar image URL (optional — initials are used otherwise)">
                <Input
                  value={picture}
                  onChange={(e) => setPicture(e.target.value)}
                  placeholder="https://…/avatar.png"
                />
              </Field>
              <Field label="Institution / course">
                <Input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. IIT Delhi — B.Tech CSE"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* 2. Study stats */}
        <Section title="Study stats">
          {!stats ? (
            <Spinner />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Questions asked" value={stats.questions_asked} />
                <Stat label="Documents" value={stats.documents_uploaded} />
                <Stat label="Quizzes taken" value={stats.quizzes_taken} />
                <Stat label="Best quiz score" value={`${stats.highest_score_pct}%`} />
                <Stat label="Longest streak" value={`${stats.longest_streak}🔥`} />
                <Stat label="Current streak" value={`${stats.current_streak}🔥`} />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Member since {new Date(stats.member_since).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Achievements</p>
                {stats.badges.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No badges yet — upload docs, ask questions, and take quizzes to earn them.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.badges.map((b) => (
                      <span
                        key={b.name}
                        title={b.description}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                      >
                        <span>{b.emoji}</span> {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* 3. Security */}
        <Section title="Security">
          <ChangePasswordForm token={token} />
        </Section>

        {/* 4. Danger zone */}
        <Section title="Danger zone" danger>
          <DangerZone token={token} onDeleted={() => api.getStats(token).then(setStats).catch(() => {})} />
        </Section>
      </main>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3">
          {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
          {savedMsg && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
          <Button onClick={saveProfile} disabled={saving || !dirty}>
            {saving ? <Spinner className="border-white/40 border-t-white" /> : "Save changes"}
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${danger ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
        {title}
      </h2>
      <Card className={`p-5 ${danger ? "border-red-200 dark:border-red-900" : ""}`}>{children}</Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ChangePasswordForm({ token }: { token: string }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (next.length < 6) return setMsg({ ok: false, text: "New password must be at least 6 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "New passwords don't match." });
    setBusy(true);
    try {
      await api.changePassword(token, cur, next);
      setMsg({ ok: true, text: "Password changed ✓" });
      setCur(""); setNext(""); setConfirm("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm space-y-3">
      <Input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <Input type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>{msg.text}</p>}
      <Button onClick={submit} disabled={busy || !cur || !next}>
        {busy ? <Spinner className="border-white/40 border-t-white" /> : "Change password"}
      </Button>
      <p className="text-xs text-slate-400">If you signed up with Google, you don&apos;t have a password to change.</p>
    </div>
  );
}

function DangerZone({ token, onDeleted }: { token: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function wipe() {
    setBusy(true);
    try {
      await api.deleteAllData(token);
      setDone(true);
      setOpen(false);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Permanently delete <strong>all</strong> your knowledge bases, documents, conversations, quiz history, and
        vectors. Your account stays, but this cannot be undone.
      </p>
      {done && <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">All your data has been deleted.</p>}
      <Button variant="danger" className="border border-red-300 dark:border-red-800" onClick={() => setOpen(true)}>
        Delete all my data
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Are you absolutely sure?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This deletes everything you&apos;ve uploaded and created. Type <strong>DELETE</strong> to confirm.
            </p>
            <Input className="mt-4" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                className="border border-red-300 dark:border-red-800"
                disabled={confirm !== "DELETE" || busy}
                onClick={wipe}
              >
                {busy ? <Spinner /> : "Delete everything"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
