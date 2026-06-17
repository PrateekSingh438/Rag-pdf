"use client";
// Profile & settings — a single scrollable page:
// 1) Profile info (name, email, avatar upload, institution) with a sticky Save bar,
// 2) Study stats summary + achievement badges, 3) Community counters (site-wide),
// 4) Security (change password), 5) Danger zone (wipe all data, type-to-confirm).
import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { Button, Input, Card, Spinner } from "@/components/ui";
import {
  IconCamera, IconTrash, IconUsers, IconMessage, IconEye, IconAward,
  IconFlame, IconLock, IconCheck,
} from "@/components/icons";

// Read an image File, draw it center-cropped into a square canvas, and return a
// compressed JPEG data URL. Keeps avatars small enough to store in the DB column
// (no file server needed — works on ephemeral hosting like HF Spaces).
function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function avatarFor(name: string | null, email: string, picture: string | null) {
  if (picture) return picture;
  const label = encodeURIComponent(name || email);
  return `https://ui-avatars.com/api/?name=${label}&background=0d9488&color=fff&size=256`;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<api.Stats | null>(null);
  const [site, setSite] = useState<api.SiteStats | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setInstitution(user.institution || "");
      setPicture(user.picture || "");
    }
  }, [user]);

  useEffect(() => {
    if (token) api.getStats(token).then(setStats).catch(() => {});
    api.getSiteStats().then(setSite).catch(() => {});
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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setSaveErr(null);
    if (!file.type.startsWith("image/")) return setSaveErr("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setSaveErr("Image is too large (max 8 MB).");
    try {
      setPicture(await fileToAvatarDataUrl(file));
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Could not process image");
    }
  }

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
        <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Profile &amp; settings
        </h1>

        {/* 1. Profile info */}
        <Section title="Profile">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700"
                title="Upload a new photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarFor(name, user.email, picture)} alt="avatar" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-slate-900/0 text-white opacity-0 transition-all group-hover:bg-slate-900/50 group-hover:opacity-100">
                  <IconCamera size={22} />
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="text-xs font-medium text-[var(--primary)] hover:underline dark:text-[var(--primary)]">
                  Upload
                </button>
                {picture && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <button onClick={() => setPicture("")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600">
                      <IconTrash size={12} /> Remove
                    </button>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>
            <div className="flex-1 space-y-4">
              <Field label="Display name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Email (read-only)">
                <Input value={user.email} disabled className="opacity-60" />
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
                <Stat label="Longest streak" value={stats.longest_streak} icon={IconFlame} />
                <Stat label="Current streak" value={stats.current_streak} icon={IconFlame} />
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--soft)] px-3 py-1 text-sm font-medium text-[var(--primary)] dark:border-[var(--hairline)] dark:bg-[var(--soft)] dark:text-[var(--primary)]"
                      >
                        <IconAward size={14} /> {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Section>

        {/* 3. Community */}
        <Section title="Community">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">You&apos;re part of a growing community of learners.</p>
          <div className="grid grid-cols-3 gap-3">
            <Community icon={IconUsers} label="Learners" value={site?.total_users} />
            <Community icon={IconMessage} label="Questions answered" value={site?.total_questions} />
            <Community icon={IconEye} label="Site visits" value={site?.total_visits} />
          </div>
        </Section>

        {/* 4. Security */}
        <Section title="Security">
          <ChangePasswordForm token={token} />
        </Section>

        {/* 5. Danger zone */}
        <Section title="Danger zone" danger>
          <DangerZone token={token} onDeleted={() => api.getStats(token).then(setStats).catch(() => {})} />
        </Section>
      </main>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3">
          {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
          {savedMsg && <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"><IconCheck size={15} /> Saved</span>}
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
      <Card className={`p-5 ${danger ? "ring-1 ring-inset ring-red-400/40 dark:ring-red-500/30" : ""}`}>{children}</Card>
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

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 backdrop-blur-sm dark:border-slate-700/60 dark:bg-white/5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
        {value}{Icon && <Icon size={18} className="text-[var(--primary)]" />}
      </p>
    </div>
  );
}

function Community({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/40 p-3 text-center backdrop-blur-sm dark:border-slate-700/60 dark:bg-white/5">
      <Icon size={20} className="mx-auto mb-1.5 text-[var(--primary)]" />
      <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{value === undefined ? "—" : value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
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
      setMsg({ ok: true, text: "Password changed" });
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
      {msg && <p className={`flex items-center gap-1 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>{msg.ok && <IconCheck size={15} />}{msg.text}</p>}
      <Button onClick={submit} disabled={busy || !cur || !next}>
        {busy ? <Spinner className="border-white/40 border-t-white" /> : <><IconLock size={16} /> Change password</>}
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
        <IconTrash size={16} /> Delete all my data
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="animate-rise w-full max-w-md rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/85">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Are you absolutely sure?</h3>
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
