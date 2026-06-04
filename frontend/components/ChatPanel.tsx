"use client";
// Chat workspace: a sidebar of past conversations plus the active thread. Sending
// a question streams the assistant's answer token-by-token via the SSE client,
// then attaches citations and exam links from the final "done" event.
import { useEffect, useState, useCallback, useRef, KeyboardEvent, MouseEvent } from "react";
import * as api from "@/lib/api";
import { ChatMessage, Citation } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { Button, Spinner } from "./ui";
import {
  IconTarget, IconCalendar, IconSparkles, IconClipboard, IconChart,
  IconPlus, IconX, IconChevronDown, IconSend, IconCpu, IconCheck,
} from "./icons";

const MODEL_STORAGE_KEY = "sm_model";

export function ChatPanel({
  token,
  kbId,
  onCitation,
  onOpenPractice,
  onOpenQuiz,
  onOpenExamInsights,
  onOpenStudyInsights,
  onOpenStudyPlan,
}: {
  token: string;
  kbId: number;
  onCitation: (c: Citation) => void;
  onOpenPractice: () => void;
  onOpenQuiz: () => void;
  onOpenExamInsights: () => void;
  onOpenStudyInsights: () => void;
  onOpenStudyPlan: () => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const tools = [
    { label: "Key topics", icon: IconTarget, fn: onOpenStudyInsights },
    { label: "Study plan", icon: IconCalendar, fn: onOpenStudyPlan },
    { label: "Practice questions", icon: IconSparkles, fn: onOpenPractice },
    { label: "Quiz", icon: IconClipboard, fn: onOpenQuiz },
    { label: "Exam insights", icon: IconChart, fn: onOpenExamInsights },
  ];
  const [conversations, setConversations] = useState<api.ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // LLM picker: available models + current selection (persisted across sessions).
  const [models, setModels] = useState<api.ModelInfo[]>([]);
  const [model, setModel] = useState<string>("");
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    api.getModels().then(({ default: def, models }) => {
      setModels(models);
      const saved = typeof window !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
      setModel(saved && models.some((m) => m.id === saved) ? saved : def);
    }).catch(() => {});
  }, []);

  function pickModel(id: string) {
    setModel(id);
    setModelOpen(false);
    if (typeof window !== "undefined") localStorage.setItem(MODEL_STORAGE_KEY, id);
  }
  const currentModel = models.find((m) => m.id === model);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations(token, kbId));
    } catch {
      /* ignore */
    }
  }, [token, kbId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function selectConversation(id: number) {
    setActiveId(id);
    const detail = await api.getConversation(token, id);
    setMessages(detail.messages);
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function removeConversation(id: number, e: MouseEvent) {
    e.stopPropagation();
    await api.deleteConversation(token, id);
    if (activeId === id) newChat();
    loadConversations();
  }

  async function send() {
    const question = input.trim();
    if (!question || sending) return;
    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true, citations: [], exam_links: [] },
    ]);

    const appendToken = (t: string) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + t };
        return next;
      });

    try {
      await api.streamChat(kbId, question, token, activeId, appendToken, (meta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            streaming: false,
            citations: meta.citations,
            exam_links: meta.exam_links,
          };
          return next;
        });
        if (!activeId) setActiveId(meta.conversation_id);
        loadConversations();
      }, model || undefined);
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          streaming: false,
          content: last.content || "Sorry — something went wrong reaching the server.",
        };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full">
      {/* conversation sidebar */}
      <div className="hidden w-56 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 md:flex">
        <div className="p-3">
          <Button onClick={newChat} className="w-full" variant="secondary">
            <IconPlus size={16} /> New chat
          </Button>
        </div>
        <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm ${
                activeId === c.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span className="truncate">{c.title}</span>
              <button
                onClick={(e) => removeConversation(c.id, e)}
                title="Delete conversation"
                className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-slate-400">No conversations yet.</p>
          )}
        </div>
      </div>

      {/* thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Chat</h2>
          <div className="flex items-center gap-2">
            {/* Model picker */}
            {models.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setModelOpen((o) => !o)}
                  title="Choose the AI model"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <IconCpu size={15} className="text-indigo-500" />
                  <span className="hidden max-w-28 truncate sm:inline">{currentModel?.label || "Model"}</span>
                  <IconChevronDown size={14} className={`transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                </button>
                {modelOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => pickModel(m.id)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <IconCheck size={15} className={`mt-0.5 shrink-0 ${m.id === model ? "text-indigo-600" : "text-transparent"}`} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{m.label}</span>
                            <span className="block text-xs text-slate-400">{m.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="relative">
            <Button variant="secondary" onClick={() => setToolsOpen((o) => !o)}>
              <IconSparkles size={16} /> Study tools
              <IconChevronDown size={15} className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
            </Button>
            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setToolsOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {tools.map(({ label, icon: Icon, fn }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setToolsOpen(false);
                        fn();
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Icon size={16} className="text-indigo-500" /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-sm text-slate-400">
                <p className="text-base font-medium text-slate-500">Ask a question</p>
                <p className="mt-1 text-sm">
                  Answers come only from this knowledge base&apos;s documents, with citations and links to past exam questions.
                </p>
              </div>
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} message={m} onCitation={onCitation} />)
          )}
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-indigo-900">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about your notes…"
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none dark:text-slate-100"
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              {sending ? <Spinner className="border-white/40 border-t-white" /> : <><IconSend size={16} /> Send</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
