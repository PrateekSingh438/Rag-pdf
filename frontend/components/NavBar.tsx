"use client";
// Top navigation: a floating glass bar with brand, links, theme toggle, a profile
// link (avatar + name), and logout. Icons are line-style SVGs (see icons.tsx) — no
// emoji.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { IconHome, IconChart, IconSun, IconMoon, IconLogOut } from "./icons";
import { StudyMateMark } from "./StudyMateLogo";

export function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  const initials = (user?.name || user?.email || "?").trim()[0]?.toUpperCase() ?? "?";

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: IconHome },
    { href: "/benchmark", label: "Benchmark", icon: IconChart },
  ];

  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="glass-strong mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl px-2.5 sm:px-4">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--btn)] text-[var(--on-btn)] shadow-md shadow-black/15 ring-1 ring-white/30 transition-transform group-hover:scale-110">
              <StudyMateMark size={19} />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
              StudyMate
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--soft)] text-[var(--primary)] ring-1 ring-inset ring-[var(--hairline)] dark:text-[var(--primary)]"
                      : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/10"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/10"
            title="Profile & settings"
          >
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--btn)] text-xs font-semibold text-[var(--on-btn)] ring-1 ring-white/30">
                {initials}
              </span>
            )}
            <span className="hidden max-w-30 truncate text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
              {user?.name || user?.email}
            </span>
          </Link>
          <button
            onClick={() => {
              logout();
              // Hard redirect (not router.replace): a full reload wipes all
              // in-memory state and re-hydrates with no token, so there's no way
              // a cached/back-button view can keep you "logged in".
              window.location.href = "/login";
            }}
            title="Log out"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
          >
            <IconLogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
