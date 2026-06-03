"use client";
// Light/dark theme. Persists the choice in localStorage and toggles a `.dark`
// class on <html>. A tiny inline script in the root layout applies the saved
// theme before paint to avoid a flash.
import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
const KEY = "studymate_theme";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme) || "light";
    setTheme(saved);
  }, []);

  const apply = useCallback((t: Theme) => {
    setTheme(t);
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = useCallback(() => apply(theme === "dark" ? "light" : "dark"), [theme, apply]);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Runs before React hydrates to set the theme class without a flash.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;
