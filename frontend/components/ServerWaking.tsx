"use client";
// The backend runs on a free tier that sleeps when idle; the first request after
// a nap can take ~30–60s to wake (plus model load). This pings /health on load
// and, only if the server is slow to answer, shows a non-blocking banner so the
// app doesn't look broken while it boots. It keeps retrying until the server is up.
import { useEffect, useState } from "react";
import { health } from "@/lib/api";
import { Spinner } from "./ui";

export function ServerWaking() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Only reveal the banner if the first ping doesn't return promptly.
    const slowTimer = setTimeout(() => {
      if (!cancelled) setWaking(true);
    }, 2500);

    (async () => {
      while (!cancelled) {
        try {
          if (await health()) break;
        } catch {
          /* network/abort — server still waking */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      clearTimeout(slowTimer);
      if (!cancelled) setWaking(false);
    })();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  if (!waking) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-[var(--glass-border)] bg-[var(--glass-strong)] px-4 py-2 text-center text-sm font-medium text-[var(--foreground)] backdrop-blur-xl">
      <Spinner className="h-3.5 w-3.5" />
      Waking up the server — this can take up to a minute on the free tier…
    </div>
  );
}
