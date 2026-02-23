import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";

type AuthContextType = {
  loading: boolean;
  message: string | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setPassword: (token: string, newPassword: string) => Promise<void>;
  resetPasswordInit: (email: string) => Promise<void>;
  resetPasswordConfirm: (token: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );

  // bootstrap simples: se houver token, valida /me (se endpoint existir)
  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      setLoading(true);
      try {
        await apiRequest("/api/v1/auth/me", { method: "GET" });
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ access_token: string; refresh_token?: string }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      localStorage.setItem("access_token", res.access_token);
      if (res.refresh_token) localStorage.setItem("refresh_token", res.refresh_token);
      setAccessToken(res.access_token);
      return true;
    } catch (err: any) {
      setMessage(err?.message || "Falha no login");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // ok: limpa mesmo se backend falhar
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setAccessToken(null);
      setLoading(false);
    }
  };

  const setPassword = async (token: string, newPassword: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await apiRequest("/api/v1/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setMessage("Senha definida com sucesso.");
    } catch (err: any) {
      setMessage(err?.message || "Falha ao definir senha.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordInit = async (email: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await apiRequest("/api/v1/auth/reset-password/init", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage("Se o e-mail existir, enviamos as instruções de reset.");
    } catch (err: any) {
      setMessage(err?.message || "Falha ao iniciar reset.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordConfirm = async (token: string, newPassword: string) => {
    setLoading(true);
    setMessage(null);
    try {
      await apiRequest("/api/v1/auth/reset-password/confirm", {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setMessage("Senha atualizada com sucesso.");
    } catch (err: any) {
      setMessage(err?.message || "Falha ao confirmar reset.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      loading,
      message,
      accessToken,
      login,
      logout,
      setPassword,
      resetPasswordInit,
      resetPasswordConfirm,
    }),
    [loading, message, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
