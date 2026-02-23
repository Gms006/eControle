import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const { login, loading, message, accessToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate("/painel", { replace: true });
  };

  useEffect(() => {
    if (accessToken) navigate("/painel", { replace: true });
  }, [accessToken, navigate]);

  // limpeza de "device keys" era do CertHub; aqui mantém só o essencial (se quiser remover, ok)
  useEffect(() => {
    if (typeof document === "undefined") return;
    ["device_id", "device_token", "deviceId", "deviceToken"].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
      document.cookie = `${k}=; Max-Age=0; path=/`;
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-100">
      <div className="pointer-events-none absolute left-[-120px] top-24 h-64 w-64 rounded-full border border-[#22489c]/25" />
      <div className="pointer-events-none absolute left-[-60px] top-36 h-44 w-44 rounded-full border border-[#22489c]/20" />
      <div className="pointer-events-none absolute left-[-20px] top-48 h-28 w-28 rounded-full border border-[#22489c]/15" />
      <div className="pointer-events-none absolute right-[-80px] top-[-40px] h-56 w-56 rounded-full bg-[#22489c]/10 blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:max-w-[1100px]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col gap-6 px-8 py-10 lg:px-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0e2659] text-white">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Neto Contabilidade</p>
                  <p className="text-xs text-slate-500">Portal eControle</p>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Entrar</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Acesse com seu e-mail corporativo e senha.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block text-xs font-semibold text-slate-500">
                  E-mail
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 text-sm text-slate-700 placeholder:text-slate-400"
                      type="email"
                      placeholder="maria.clara@netocontabilidade.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Senha
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-11 text-sm text-slate-700 placeholder:text-slate-400"
                      type={showPassword ? "text" : "password"}
                      placeholder="Senha segura"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <span className="mt-2 block text-[11px] text-slate-400">
                    Somente contas do domínio @netocontabilidade.com.br.
                  </span>
                </label>
                <div className="mt-3 flex items-center justify-end">
                  <Link
                    className="text-xs font-semibold text-[#22489c] transition hover:text-[#0e2659]"
                    to="/reset-password"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <button
                  className="h-11 w-full rounded-2xl bg-[#0e2659] text-sm font-semibold text-white transition hover:bg-[#0e2659]/90"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Acessar"}
                </button>
              </form>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span>RBAC: DEV/ADMIN/VIEW</span>
                  <span>Auditoria: habilitada</span>
                  <span>API: :8020</span>
                </div>
                <p className="mt-3 text-[11px]">
                  eControle v2 centraliza empresas, processos, taxas e licenças.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>(c) 2026 Neto Contabilidade</span>
                <span>v2</span>
              </div>
            </div>

            <div className="relative overflow-hidden bg-slate-950 px-8 py-10 text-white">
              <div className="absolute right-10 top-6 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                Acesso controlado
              </div>
              <div className="absolute bottom-[-90px] right-[-80px] h-56 w-56 rounded-full bg-gradient-to-br from-[#22489c] to-[#0e2659] opacity-95" />
              <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" />

              <div className="relative space-y-8">
                <div>
                  <p className="text-xs text-white/55">Portal corporativo</p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight">
                    Controle <span className="text-[#6ea3ff]">operacional</span> do escritório
                  </h2>
                  <p className="mt-4 text-sm text-white/70">
                    Visão unificada de vencimentos, licenças e tarefas por empresa.
                  </p>
                </div>
                <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-soft">
                  <p className="text-sm font-semibold">Resumo</p>
                  <p className="mt-3 text-sm text-slate-600">
                    Após login, você verá o painel com alertas e atalhos para Empresas,
                    Licenças, Taxas e Processos.
                  </p>
                  <div className="mt-4 flex gap-2">
                    {["Empresas", "Taxas", "Licenças"].map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/55">Se não conseguir acessar, solicite suporte ao TI.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {message && (
        <div className="fixed bottom-5 right-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-soft">
          {message}
        </div>
      )}
    </div>
  );
}
