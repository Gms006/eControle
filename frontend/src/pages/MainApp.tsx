import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function MainApp() {
  const { logout } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<any>("/api/v1/companies", { method: "GET" })
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items || [];
        setCompanies(items);
      })
      .catch((e) => setError(e?.message || "Falha ao carregar companies"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Painel</h1>
            <p className="mt-1 text-sm text-slate-500">
              Placeholder do S6 - no commit 2 entra o AppShell do v1.
            </p>
          </div>
          <button
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => void logout()}
          >
            Logout
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-900">Empresas (prova de integração)</h2>
          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
{JSON.stringify(companies, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
