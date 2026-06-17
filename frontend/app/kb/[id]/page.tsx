"use client";
// KB workspace: split layout with the documents panel on the left and the chat
// panel on the right. Owns the citation drawer and practice dialog so they can
// overlay the whole workspace.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { Citation } from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { CitationDrawer } from "@/components/CitationDrawer";
import { PracticeDialog } from "@/components/PracticeDialog";
import { QuizDialog } from "@/components/QuizDialog";
import { ExamInsightsDialog } from "@/components/ExamInsightsDialog";
import { StudyInsightsDialog } from "@/components/StudyInsightsDialog";
import { StudyPlanDialog } from "@/components/StudyPlanDialog";
import { Card, Spinner } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";

export default function KBWorkspacePage() {
  const { token, loading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const kbId = Number(params.id);

  const [kb, setKb] = useState<api.KB | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [citation, setCitation] = useState<Citation | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [examInsightsOpen, setExamInsightsOpen] = useState(false);
  const [studyInsightsOpen, setStudyInsightsOpen] = useState(false);
  const [studyPlanOpen, setStudyPlanOpen] = useState(false);
  // On small screens the two panels don't fit side by side, so toggle between them.
  const [mobileTab, setMobileTab] = useState<"docs" | "chat">("chat");

  useEffect(() => {
    if (!token) return;
    api
      .getKB(token, kbId)
      .then(setKb)
      .catch(() => setNotFound(true));
  }, [token, kbId]);

  if (loading || !token) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200">
            <IconArrowLeft size={15} /> Dashboard
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100">
            {notFound ? "Not found" : kb?.name || "…"}
          </h1>
        </div>

        {notFound ? (
          <Card className="grid place-items-center py-20 text-slate-500">
            This knowledge base does not exist or is not yours.
          </Card>
        ) : (
          <>
            {/* mobile-only switch between the two panels */}
            <div className="glass mb-3 inline-flex self-start rounded-xl p-0.5 text-sm lg:hidden">
              {(["chat", "docs"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMobileTab(t)}
                  className={`cursor-pointer rounded-lg px-4 py-1.5 font-medium transition-all ${
                    mobileTab === t
                      ? "bg-[var(--btn)] text-[var(--on-btn)] shadow-sm shadow-black/15"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {t === "docs" ? "Documents" : "Chat"}
                </button>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
              <Card
                className={`h-[calc(100vh-12rem)] flex-col p-4 lg:flex lg:h-[calc(100vh-9rem)] ${
                  mobileTab === "docs" ? "flex" : "hidden"
                }`}
              >
                <DocumentsPanel token={token} kbId={kbId} />
              </Card>
              <Card
                className={`h-[calc(100vh-12rem)] overflow-hidden p-0 lg:block lg:h-[calc(100vh-9rem)] ${
                  mobileTab === "chat" ? "block" : "hidden"
                }`}
              >
                <ChatPanel
                  token={token}
                  kbId={kbId}
                  onCitation={setCitation}
                  onOpenPractice={() => setPracticeOpen(true)}
                  onOpenQuiz={() => setQuizOpen(true)}
                  onOpenExamInsights={() => setExamInsightsOpen(true)}
                  onOpenStudyInsights={() => setStudyInsightsOpen(true)}
                  onOpenStudyPlan={() => setStudyPlanOpen(true)}
                />
              </Card>
            </div>
          </>
        )}
      </main>

      <CitationDrawer citation={citation} kbId={kbId} token={token} onClose={() => setCitation(null)} />
      <PracticeDialog token={token} kbId={kbId} open={practiceOpen} onClose={() => setPracticeOpen(false)} />
      <QuizDialog token={token} kbId={kbId} open={quizOpen} onClose={() => setQuizOpen(false)} />
      <ExamInsightsDialog
        token={token}
        kbId={kbId}
        open={examInsightsOpen}
        onClose={() => setExamInsightsOpen(false)}
      />
      <StudyInsightsDialog
        token={token}
        kbId={kbId}
        open={studyInsightsOpen}
        onClose={() => setStudyInsightsOpen(false)}
      />
      <StudyPlanDialog
        token={token}
        kbId={kbId}
        open={studyPlanOpen}
        onClose={() => setStudyPlanOpen(false)}
      />
    </>
  );
}
