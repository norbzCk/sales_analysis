import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../../lib/http";
import type { AuthResponse, SessionUser, UserType } from "../../types/auth";
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  getStoredUserType,
  normalizeUser,
  persistSession,
} from "./authStorage";

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<SessionUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshUser();
  }, []);

  async function refreshUser() {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return null;
    }

    try {
      const userType = getStoredUserType();
      const endpoint =
        userType === "business"
          ? "/business/me"
          : userType === "logistics"
            ? "/logistics/me"
            : "/auth/me";
      const fallbackType = userType || "user";
      const fetched = await apiRequest<SessionUser>(endpoint);
      const next = normalizeUser(fetched, fallbackType);
      if (next) {
        persistSession(currentToken, next, userType);
      }
      setUser(next);
      setToken(currentToken);
      return next;
    } catch {
      clearStoredSession();
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function login(identifier: string, password: string) {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes("@");

    const attempts = [
      { url: "/business/login", userType: "business" as UserType, role: "seller" },
      { url: "/logistics/login", userType: "logistics" as UserType, role: "logistics" },
      { url: "/auth/login", userType: "user" as UserType, role: "user" },
    ];

    let lastError = "Invalid credentials";

    for (const attempt of attempts) {
      try {
        const payload = isEmail
          ? { email: trimmed.toLowerCase(), password }
          : { phone: trimmed, password };

        const data = await apiRequest<AuthResponse & { token?: string }>(attempt.url, {
          method: "POST",
          auth: false,
          body: payload,
        });

        const token = data.access_token || data.token;
        const merged = normalizeUser(
          { ...(data.user || {}), role: data.user?.role || attempt.role },
          attempt.userType,
        );

        if (!token || !merged) {
          lastError = "Invalid login response";
          continue;
        }

        const sessionType = merged.role === "super_admin" ? "superadmin" : attempt.userType;
        persistSession(token, merged, sessionType);
        setToken(token);
        setUser(merged);
        return merged;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Login failed";
      }
    }

    throw new Error(lastError);
  }

  async function register(payload: RegisterPayload) {
    await apiRequest("/auth/register", {
      method: "POST",
      auth: false,
      body: payload,
    });
  }

  function logout() {
    clearStoredSession();
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
