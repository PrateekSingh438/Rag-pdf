// API client for the StudyMate backend. Centralizes the base URL, auth header,
// and JSON handling. The one non-trivial piece is streamChat(), which consumes
// the backend's Server-Sent Events stream (token events, then a final done event).

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---- Types (mirror the backend schemas) ----
export interface KB {
  id: number;
  name: string;
  created_at: string;
}
export interface Doc {
  id: number;
  filename: string;
  doc_type: "notes" | "exam";
  status: "processing" | "ready" | "failed";
  num_chunks: number;
  created_at: string;
}
export interface Citation {
  tag: string;
  source_file: string;
  page: number | null;
  doc_type: string | null;
  doc_id: number | null;
  snippet: string;
}

// Fetch a rendered+highlighted PDF page as an object URL (authed; for <img src>).
export async function fetchDocumentPageImage(
  token: string,
  kbId: number,
  docId: number,
  page: number,
  q?: string,
): Promise<string> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API}/kb/${kbId}/documents/${docId}/page/${page}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`page ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
export interface ExamLink {
  source_file: string;
  page: number | null;
  snippet: string;
}
export interface ConversationMeta {
  id: number;
  title: string;
  created_at: string;
}
export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  exam_links?: ExamLink[];
  created_at?: string;
  streaming?: boolean;
}
export interface ConversationDetail {
  id: number;
  title: string;
  created_at: string;
  messages: ChatMessage[];
}

// ---- Core fetch helper ----
async function req<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function jsonBody(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

// ---- Auth ----
export async function register(email: string, password: string) {
  return req<{ access_token: string }>("/auth/register", null, jsonBody({ email, password }));
}

export async function login(email: string, password: string) {
  // Backend uses an OAuth2 password form: username + password, urlencoded.
  const body = new URLSearchParams({ username: email, password });
  return req<{ access_token: string }>("/auth/login", null, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export interface Profile {
  id: number;
  email: string;
  name: string | null;
  institution: string | null;
  picture: string | null;
  created_at: string;
}

export async function getMe(token: string) {
  return req<Profile>("/auth/me", token);
}

export const updateProfile = (
  token: string,
  data: { name?: string; institution?: string; picture?: string },
) => req<Profile>("/auth/me", token, { ...jsonBody(data), method: "PATCH" });

export const changePassword = (token: string, current_password: string, new_password: string) =>
  req<{ ok: boolean }>("/auth/change-password", token, jsonBody({ current_password, new_password }));

export const deleteAllData = (token: string) =>
  req<{ deleted: boolean }>("/auth/me/data", token, { method: "DELETE" });

// Full URL to kick off the backend Google OAuth flow (a normal browser redirect).
export const googleLoginUrl = () => `${API}/auth/google/login`;

// ---- Knowledge bases ----
export const listKBs = (token: string) => req<KB[]>("/kb", token);
export const createKB = (token: string, name: string) => req<KB>("/kb", token, jsonBody({ name }));
export const createDemoKB = (token: string) => req<KB>("/kb/demo", token, { method: "POST" });
export const getKB = (token: string, id: number) => req<KB>(`/kb/${id}`, token);
export const deleteKB = (token: string, id: number) =>
  req<{ deleted: number }>(`/kb/${id}`, token, { method: "DELETE" });

// ---- Documents ----
export const listDocuments = (token: string, kbId: number) =>
  req<Doc[]>(`/kb/${kbId}/documents`, token);

export async function uploadDocument(token: string, kbId: number, file: File, docType: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  return req<Doc>(`/kb/${kbId}/documents`, token, { method: "POST", body: form });
}

export const deleteDocument = (token: string, kbId: number, docId: number) =>
  req<{ deleted: number }>(`/kb/${kbId}/documents/${docId}`, token, { method: "DELETE" });

export const retryDocument = (token: string, kbId: number, docId: number) =>
  req<Doc>(`/kb/${kbId}/documents/${docId}/retry`, token, { method: "POST" });

// ---- Conversations ----
export const listConversations = (token: string, kbId: number) =>
  req<ConversationMeta[]>(`/chat/conversations?kb_id=${kbId}`, token);
export const getConversation = (token: string, convId: number) =>
  req<ConversationDetail>(`/chat/conversations/${convId}`, token);
export const deleteConversation = (token: string, convId: number) =>
  req<{ deleted: number }>(`/chat/conversations/${convId}`, token, { method: "DELETE" });

// ---- Practice ----
export const generatePractice = (token: string, kbId: number, topic: string, n: number) =>
  req<{ questions: string }>(`/kb/${kbId}/practice`, token, jsonBody({ topic, n }));

// ---- Quiz ----
export interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}
export const generateQuiz = (token: string, kbId: number, topic: string, n: number) =>
  req<{ questions: QuizQuestion[] }>(`/kb/${kbId}/quiz`, token, jsonBody({ topic, n }));

// ---- Exam insights ----
export interface ExamTopic {
  topic: string;
  count: number;
  example: string;
}
export const getExamAnalysis = (token: string, kbId: number) =>
  req<{ has_exams: boolean; topics: ExamTopic[] }>(`/kb/${kbId}/exam-analysis`, token);

export interface StudyTopic {
  topic: string;
  exam_frequency: number;
  in_notes: boolean;
  importance: "high" | "medium" | "low";
  example: string;
}
export const getStudyInsights = (token: string, kbId: number) =>
  req<{ has_docs: boolean; topics: StudyTopic[] }>(`/kb/${kbId}/study-insights`, token);

export interface StudyPlanDay {
  day: number;
  focus: string;
  topics: string[];
  tasks: string[];
}
export const generateStudyPlan = (token: string, kbId: number, days: number, hoursPerDay: number) =>
  req<{ has_docs: boolean; overview: string; days: StudyPlanDay[] }>(
    `/kb/${kbId}/study-plan`,
    token,
    jsonBody({ days, hours_per_day: hoursPerDay }),
  );

// ---- Eval ----
export const getEvals = (token: string) => req<EvalResults>("/eval", token);

export interface EvalRunResult {
  config: { chunk_size: number; use_reranker: boolean };
  recall_at_k: number;
  hit_rate_at_k: number;
  mrr: number;
  faithfulness: number;
}
export interface EvalResults {
  k: number;
  num_questions: number;
  generated_at: string;
  runs: EvalRunResult[];
}

// ---- Stats / progress ----
export interface Badge {
  name: string;
  emoji: string;
  description: string;
}
export interface WeakTopic {
  topic: string;
  avg_pct: number;
  attempts: number;
}
export interface RecentItem {
  kind: "chat" | "quiz";
  title: string;
  kb_id: number | null;
  created_at: string;
}
export interface Stats {
  questions_asked: number;
  documents_uploaded: number;
  quizzes_taken: number;
  highest_score_pct: number;
  current_streak: number;
  longest_streak: number;
  member_since: string;
  badges: Badge[];
  weak_topics: WeakTopic[];
  recent: RecentItem[];
}
export const getStats = (token: string) => req<Stats>("/stats", token);

// ---- Site-wide counters (public; powers social proof + profile community card) ----
export interface SiteStats {
  total_users: number;
  total_questions: number;
  total_documents: number;
  total_visits: number;
}
export const getSiteStats = () => req<SiteStats>("/stats/site", null);
// Counts a visit (deduped client-side to once per browser-day) and returns counts.
export async function recordVisit(): Promise<SiteStats> {
  const key = "sm_visit_day";
  const today = new Date().toISOString().slice(0, 10);
  const fresh = typeof window !== "undefined" && localStorage.getItem(key) !== today;
  if (typeof window !== "undefined") localStorage.setItem(key, today);
  if (fresh) return req<SiteStats>("/stats/visit", null, { method: "POST" });
  return getSiteStats();
}

export const recordQuizAttempt = (
  token: string,
  kbId: number,
  topic: string,
  score: number,
  total: number,
) => req<{ ok: boolean }>("/stats/quiz-attempts", token, jsonBody({ kb_id: kbId, topic, score, total }));

// ---- Models (LLM picker) ----
export interface ModelInfo {
  id: string;
  label: string;
  description: string;
}
export const getModels = () =>
  req<{ default: string; models: ModelInfo[] }>("/models", null);

// ---- Streaming chat (SSE) ----
export async function streamChat(
  kbId: number,
  question: string,
  token: string,
  conversationId: number | null,
  onToken: (t: string) => void,
  onDone: (m: { conversation_id: number; citations: Citation[]; exam_links: ExamLink[] }) => void,
  model?: string,
) {
  const res = await fetch(`${API}/chat/${kbId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, conversation_id: conversationId, model }),
  });
  if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const data = JSON.parse(part.slice(6));
      if (data.type === "token") onToken(data.content);
      else if (data.type === "done") onDone(data);
    }
  }
}
