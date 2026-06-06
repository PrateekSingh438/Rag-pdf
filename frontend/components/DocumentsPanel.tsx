"use client";
// Documents panel: drag-and-drop PDF upload with a notes/exam toggle, plus a list
// of documents with live status badges. Polls while anything is still processing
// so the user watches status flip processing -> ready.
import { useEffect, useState, useCallback, useRef, DragEvent } from "react";
import * as api from "@/lib/api";
import { StatusBadge, Spinner } from "./ui";
import { IconUpload, IconRefresh, IconX } from "./icons";
import { useToast } from "./Toast";

export function DocumentsPanel({
  token,
  kbId,
  onChange,
}: {
  token: string;
  kbId: number;
  onChange?: () => void;
}) {
  const [docs, setDocs] = useState<api.Doc[]>([]);
  const [docType, setDocType] = useState<"notes" | "exam">("notes");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.listDocuments(token, kbId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, [token, kbId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any document is still being ingested.
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          await api.uploadDocument(token, kbId, file, docType);
        }
        await refresh();
        onChange?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
        toast(msg, "error");
      } finally {
        setUploading(false);
      }
    },
    [token, kbId, docType, refresh, onChange, toast],
  );

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files);
  }

  async function remove(docId: number) {
    await api.deleteDocument(token, kbId, docId);
    refresh();
    onChange?.();
  }

  async function retry(docId: number) {
    try {
      await api.retryDocument(token, kbId, docId);
      await refresh(); // status flips back to processing; poll takes over
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Documents</h2>
        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-600">
          {(["notes", "exam"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDocType(t)}
              className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                docType === t
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mb-3 cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
            : "border-slate-300 hover:border-indigo-300 dark:border-slate-600"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        {uploading ? (
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Spinner /> Uploading…
          </span>
        ) : (
          <span className="inline-flex flex-col items-center gap-1.5 text-slate-500">
            <IconUpload size={22} className="text-slate-400" />
            <span>Drop a <span className="font-medium capitalize text-indigo-600">{docType}</span> PDF or image here, or click to browse</span>
            <span className="text-xs text-slate-400">PDF, JPG, PNG · max 25&nbsp;MB — scanned pages &amp; photos are OCR&apos;d automatically</span>
          </span>
        )}
      </div>

      {error && <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">{error}</p>}

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto">
        {docs.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No documents yet.</p>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={d.filename}>
                  {d.filename}
                </p>
                <p className="text-xs text-slate-400">
                  <span className="capitalize">{d.doc_type}</span>
                  {d.status === "ready" && ` · ${d.num_chunks} chunks`}
                </p>
              </div>
              <div className="ml-2 flex items-center gap-2">
                {d.status === "processing" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <Spinner className="h-3 w-3" /> processing
                  </span>
                ) : (
                  <StatusBadge status={d.status} />
                )}
                {d.status === "failed" && (
                  <button
                    onClick={() => retry(d.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    title="Retry ingestion (re-extract & re-embed this PDF)"
                  >
                    <IconRefresh size={13} /> Retry
                  </button>
                )}
                <button
                  onClick={() => remove(d.id)}
                  className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                  title="Delete document"
                >
                  <IconX size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
