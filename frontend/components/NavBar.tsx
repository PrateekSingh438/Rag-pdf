"use client";
// Top navigation: brand, links, theme toggle, a profile link (avatar + name), and
// logout. Icons are line-style SVGs (see icons.tsx) — no emoji.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { IconGradCap, IconHome, IconChart, IconSun, IconMoon, IconLogOut } from "./icons";

export function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const initials = (user?.name || user?.email || "?").trim()[0]?.toUpperCase() ?? "?";

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: IconHome },
    { href: "/evals", label: "Evaluation", icon: IconChart },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <IconGradCap size={18} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Profile & settings"
          >
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
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
              router.replace("/login");
            }}
            title="Log out"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          >
            <IconLogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
