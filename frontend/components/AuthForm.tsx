"use client";
// Shared login/register form. On success the AuthProvider stores the token and
// we redirect to the dashboard. Already-authenticated users are bounced away.
import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { googleLoginUrl } from "@/lib/api";
import { Button, Input, Card, Spinner } from "./ui";
import { StudyMateMark } from "./StudyMateLogo";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.token) router.replace("/dashboard");
  }, [auth.loading, auth.token, router]);

  // Handle the redirect back from Google OAuth: ?token=... (success) or ?error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");
    if (err) {
      const reason = params.get("reason");
      setError(`Google sign-in failed${reason ? ` (${reason})` : ""}. Please try again.`);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("expired")) {
      setError("Your session expired — please sign in again.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (token) {
      window.history.replaceState({}, "", window.location.pathname);
      auth
        .loginWithToken(token)
        .then(() => router.replace("/dashboard"))
        .catch(() => setError("Sign-in failed."));
    }
  }, [auth, router]);

  const isLogin = mode === "login";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await auth.login(email, password);
      else await auth.register(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=70)" }} />
      <div aria-hidden className="absolute inset-0 bg-[var(--background)]/82 backdrop-blur-sm" />
      <Card className="animate-rise relative z-10 w-full max-w-sm p-8 shadow-(--shadow-md)">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link href="/" className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--btn)] text-[var(--on-btn)] shadow-lg shadow-black/15 ring-1 ring-white/30">
            <StudyMateMark size={24} />
          </Link>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isLogin ? "Sign in to your StudyMate workspace" : "Start building your study knowledge bases"}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <Input
              type="password"
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-300">{error}</p>
          )}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? <Spinner className="border-white/40 border-t-white" /> : isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          or
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <a
          href={googleLoginUrl()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300/70 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </a>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {isLogin ? "New to StudyMate? " : "Already have an account? "}
          <Link href={isLogin ? "/register" : "/login"} className="font-medium text-[var(--primary)] hover:underline">
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
