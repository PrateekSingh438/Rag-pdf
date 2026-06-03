"use client";
// Auth context. Holds the JWT and current user in React state, hydrated from
// localStorage on load so a refresh keeps you signed in. Exposes login/register/
// logout and a useRequireAuth() hook that redirects to /login when unauthenticated.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as api from "./api";

const TOKEN_KEY = "studymate_token";

interface User {
  id: number;
  email: string;
  name: string | null;
  institution: string | null;
  picture: string | null;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  setUser: (u: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage and verify the token on first load.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!saved) {
      setLoading(false);
      return;
    }
    api
      .getMe(saved)
      .then((u) => {
        setToken(saved);
        setUser(u);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const applyToken = useCallback(async (tok: string) => {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    const u = await api.getMe(tok);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.login(email, password);
      await applyToken(access_token);
    },
    [applyToken],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.register(email, password);
      await applyToken(access_token);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, loginWithToken: applyToken, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Redirect to /login if there is no token once loading has settled.
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.token) router.replace("/login");
  }, [auth.loading, auth.token, router]);
  return auth;
}
