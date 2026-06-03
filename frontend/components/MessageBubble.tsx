"use client";
// Renders one chat message. Assistant messages parse inline [S1]/[S2] tags into
// clickable citation chips, and show an "Appeared in your exams" section built
// from the exam_links returned with the answer.
import { Fragment } from "react";
import { ChatMessage, Citation } from "@/lib/api";
import { MarkdownMessage } from "./MarkdownMessage";

function renderWithCitations(
  content: string,
  citations: Citation[],
  onCitation: (c: Citation) => void,
) {
  const parts = content.split(/(\[S\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[S(\d+)\]$/);
    if (m) {
      const tag = `S${m[1]}`;
      const cit = citations.find((c) => c.tag === tag);
      if (cit) {
        return (
          <button
            key={i}
            onClick={() => onCitation(cit)}
            className="mx-0.5 inline-flex items-center rounded bg-indigo-100 px-1.5 py-0.5 align-baseline text-xs font-semibold text-indigo-700 hover:bg-indigo-200"
          >
            {part}
          </button>
        );
      }
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function MessageBubble({
  message,
  onCitation,
}: {
  message: ChatMessage;
  onCitation: (c: Citation) => void;
}) {
  const isUser = message.role === "user";
  const citations = message.citations || [];
  const examLinks = message.exam_links || [];

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
          {message.streaming ? (
            // While streaming, render plain text (markdown/math may be mid-token).
            <p className="whitespace-pre-wrap">
              {renderWithCitations(message.content, citations, onCitation)}
              <span className="streaming-cursor" />
            </p>
          ) : (
            <MarkdownMessage content={message.content} citations={citations} onCitation={onCitation} />
          )}
        </div>

        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {citations.map((c) => (
              <button
                key={c.tag}
                onClick={() => onCitation(c)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300"
                title={c.snippet}
              >
                <span className="font-semibold text-indigo-600">{c.tag}</span>
                {c.source_file} · p{c.page ?? "?"}
              </button>
            ))}
          </div>
        )}

        {examLinks.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
              📝 Appeared in your exams
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
