"use client";
// Renders one chat message. Assistant messages parse inline [S1]/[S2] tags into
// clickable citation chips, and show an "Appeared in your exams" section built
// from the exam_links returned with the answer. Sources the answer actually cited
// render prominently; ones that were merely retrieved are dimmed.
import { ChatMessage, Citation } from "@/lib/api";
import { MarkdownMessage } from "./MarkdownMessage";
import { IconFile, IconCopy, IconRefresh } from "./icons";
import { useToast } from "./Toast";

export function MessageBubble({
  message,
  onCitation,
  onRegenerate,
}: {
  message: ChatMessage;
  onCitation: (c: Citation) => void;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const citations = message.citations || [];
  const examLinks = message.exam_links || [];
  const { toast } = useToast();

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content);
      toast("Answer copied", "success");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3">
        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {message.streaming && !message.content ? (
            // Waiting on retrieval + the model's first token.
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              Thinking
              <span className="inline-flex gap-0.5">
                <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
              </span>
            </span>
          ) : (
            // Markdown renders progressively during the stream (incomplete syntax
            // just falls back to plain text), so there's no jarring re-layout when
            // the answer finishes.
            <>
              <MarkdownMessage content={message.content} citations={citations} onCitation={onCitation} />
              {message.streaming && <span className="streaming-cursor" />}
            </>
          )}
        </div>

        {!message.streaming && message.content && (
          <div className="flex gap-1">
            <button
              onClick={copyAnswer}
              title="Copy answer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <IconCopy size={13} /> Copy
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate this answer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <IconRefresh size={13} /> Regenerate
              </button>
            )}
          </div>
        )}

        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {citations.map((c) => {
              const used = c.used !== false; // older messages have no flag -> treat as used
              return (
                <button
                  key={c.tag}
                  onClick={() => onCitation(c)}
                  className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:text-indigo-300 ${
                    used ? "" : "opacity-50"
                  }`}
                  title={used ? c.snippet : "Retrieved but not cited in the answer"}
                >
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{c.tag}</span>
                  {c.source_file} · p{c.page ?? "?"}
                </button>
              );
            })}
          </div>
        )}

        {examLinks.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/40">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
              <IconFile size={14} /> Appeared in your exams
            </p>
            <ul className="space-y-2">
              {examLinks.map((e, i) => (
                <li key={i} className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {e.source_file} · p{e.page ?? "?"}
                  </span>
                  <p className="line-clamp-2 text-slate-600 dark:text-slate-400">{e.snippet}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
