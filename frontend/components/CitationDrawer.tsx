"use client";
// Slide-in drawer for a clicked citation. When the source PDF is available it
// renders the actual page with the cited snippet highlighted (fetched authed as an
// image); otherwise it falls back to showing the snippet text.
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { Citation } from "@/lib/api";
import { Badge, Spinner } from "./ui";

export function CitationDrawer({
  citation,
  kbId,
  token,
  onClose,
}: {
  citation: Citation | null;
  kbId: number;
  token: string;
  onClose: () => void;
}) {
  const open = !!citation;
  const [img, setImg] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);

  useEffect(() => {
    setImg(null);
    if (!citation || citation.doc_id == null || citation.page == null) return;
    let url: string | null = null;
    setLoadingImg(true);
    api
      .fetchDocumentPageImage(token, kbId, citation.doc_id, citation.page, citation.snippet)
      .then((u) => {
        url = u;
        setImg(u);
      })
      .catch(() => setImg(null)) // no source file (e.g. demo) -> snippet fallback
      .finally(() => setLoadingImg(false));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [citation, kbId, token]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-slate-900/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl transition-transform dark:border-slate-700 dark:bg-slate-800 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {citation && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">
                  {citation.tag}
                </span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Source detail</h2>
              </div>
              <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto p-5">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">File</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{citation.source_file}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Page</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{citation.page ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Type</span>
                  <Badge className={citation.doc_type === "exam" ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}>
                    {citation.doc_type ?? "notes"}
                  </Badge>
                </div>
              </div>

              {/* PDF page preview with highlight, when available */}
              {loadingImg && (
                <div className="grid h-40 place-items-center rounded-lg border border-slate-200 dark:border-slate-700">
                  <Spinner />
                </div>
              )}
              {img && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Source page</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="cited page" className="w-full rounded-lg border border-slate-200 dark:border-slate-700" />
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Cited snippet</p>
                <blockquote className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {citation.snippet}
                </blockquote>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
