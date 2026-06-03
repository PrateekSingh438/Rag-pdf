"use client";
// Top navigation: brand, links, theme toggle, a profile link (avatar + name), and
// logout.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "./ui";

export function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  const initials = (user?.name || user?.email || "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              S
            </span>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">StudyMate</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/evals" className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Evaluation
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Profile"
          >
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[140px] truncate text-sm text-slate-600 dark:text-slate-300 sm:inline">
              {user?.name || user?.email}
            </span>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
