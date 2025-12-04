import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { api } from "../services/api.js";
import { setAuth } from "../state/auth.js";
import { IconChevronLeft, IconChevronRight, IconX, IconEye, IconEyeOff } from "../components/Icon.jsx";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const defaultLoginLogo = "";
  const [loginLogoUrl, setLoginLogoUrl] = useState(defaultLoginLogo);

  useEffect(() => {
    try {
      const pref =
        localStorage.getItem("theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.classList.toggle("dark", pref === "dark");
      const saved = localStorage.getItem("rememberedEmail");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadPublicConfig = async () => {
      try {
        const base =
          import.meta.env.VITE_API_URL ||
          (typeof window !== "undefined"
            ? `${window.location.origin}/api`
            : "http://localhost:3000/api");
        const res = await fetch(
          `${String(base).replace(/\/$/, "")}/admin/config/public?_=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Object.prototype.hasOwnProperty.call(data || {}, "loginLogoUrl")) {
          setLoginLogoUrl(data?.loginLogoUrl || "");
        }
      } catch {
        setLoginLogoUrl(defaultLoginLogo);
      }
    };
    loadPublicConfig();
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location?.search || "");
      if (params.get("registered") === "1") {
        setSuccess(
          "Conta criada com sucesso! Faça login com suas credenciais."
        );
      } else {
        setSuccess("");
      }
    } catch {
      setSuccess("");
    }
  }, [location]);

  useEffect(() => {
    if (forgotOpen) {
      setForgotEmail(email || "");
      setForgotStatus("");
      setForgotError("");
    }
  }, [forgotOpen, email]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");
    try {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!emailOk) throw new Error("Informe um e-mail válido");
      if (!password || password.length < 6)
        throw new Error("A senha deve ter pelo menos 6 caracteres");

      const res = await api.post("/auth/login", { email, password });
      setAuth(res.token, res.user);
      try {
        if (remember) localStorage.setItem("rememberedEmail", email);
        else localStorage.removeItem("rememberedEmail");
      } catch {}
      nav("/");
    } catch (e) {
      setError(e.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setForgotStatus("");
    setForgotError("");
    try {
      const trimmed = (forgotEmail || "").trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
      if (!emailOk) throw new Error("Informe um e-mail válido");
      setForgotLoading(true);
      const res = await api.post("/auth/forgot-password", { email: trimmed });
      setForgotStatus(
        res?.message ||
          "Se o e-mail estiver cadastrado, você receberá uma nova senha."
      );
    } catch (err) {
      setForgotError(
        err?.message ||
          "Não foi possível processar a solicitação. Tente novamente."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.6),rgba(15,23,42,0.9))]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl gap-12 rounded-[2.5rem] border border-white/5 bg-white/5 p-8 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.9)] backdrop-blur-lg lg:grid-cols-[1.1fr_1fr] lg:p-12">
          <div className="hidden flex-col justify-between lg:flex">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center gap-2 w-fit rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Plataforma omnichannel
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-white">
                Conecte sua equipe e Participe de Grupos
              </h1>
              <p className="text-lg text-slate-300">
                “Nosso chat interno conecta toda a equipe em tempo real,
                facilitando a troca de ideias e decisões rápidas. Comunicação
                simples, ágil e segura para aumentar a produtividade e
                fortalecer a colaboração.”
              </p>
            </div>
            <div className="mt-10 flex flex-col gap-4 text-sm text-slate-200/80">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  01
                </span>
                Respostas rapidas e consistentes em todos os atendimentos.
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">
                  02
                </span>
                Monitoramento em tempo real e historico completo das conversas.
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
                  03
                </span>
                Seguranca e privacidade alinhadas as melhores praticas do
                mercado.
              </div>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="relative flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/90 p-8 text-slate-900 shadow-2xl backdrop-blur dark:bg-slate-900/85 dark:text-slate-100"
            noValidate
          >
            <div className="flex items-center gap-3">
              {loginLogoUrl ? (
                <img
                  src={loginLogoUrl}
                  alt="Logo"
                  className="h-10 w-auto"
                  draggable={false}
                />
              ) : (
                <div className="h-10 w-10 rounded-lg border border-white/10 bg-white/10" />
              )}
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300"></span>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
                Bem-vindo de volta
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Acesse sua conta para continuar acompanhando suas conversas.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-600 dark:text-slate-200"
              >
                E-mail
              </label>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="voce@empresa.com"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-600 dark:text-slate-200"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Insira sua senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 my-1 inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 text-xs font-medium text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-300 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 dark:border-slate-600"
                />
                Lembrar de mim
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex flex-col items-end gap-0.5 text-right">
                <button
                  type="button"
                  className="text-emerald-500 underline underline-offset-2 hover:text-emerald-400"
                  onClick={() => setForgotOpen(true)}
                >
                  Esqueci minha senha
                </button>
              </span>
            </div>

            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                <span className="text-base">?</span>
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-300/60 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                <span className="text-base">??</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-2xl hover:shadow-emerald-500/40 disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div className="text-center text-sm text-slate-500 dark:text-slate-300">
              Não tem conta?{" "}
              <Link
                className="font-medium text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200"
                to="/register"
              >
                Criar cadastro
              </Link>
            </div>

            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
              Ao continuar voce concorda com os termos de uso e politica de
              privacidade da plataforma.
            </p>
            </form>
           </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-slate-100 shadow-[0_20px_70px_-40px_rgba(0,0,0,1)]">
            <button
              type="button"
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
              aria-label="Fechar"
              onClick={() => setForgotOpen(false)}
            >
              <IconX />
            </button>
            <h2 className="text-xl font-semibold mb-2">Recuperar senha</h2>
            <p className="text-sm text-slate-300 mb-4">
              Informe o e-mail cadastrado para receber uma nova senha temporária.
            </p>
            <form onSubmit={handleForgot} className="space-y-3">
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="seuemail@empresa.com"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full rounded-2xl bg-teal-500/90 px-4 py-2.5 font-semibold text-white shadow-lg shadow-teal-500/30 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotLoading ? "Enviando..." : "Enviar nova senha"}
              </button>
              {forgotStatus && (
                <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-emerald-100 text-sm">
                  {forgotStatus}
                </div>
              )}
              {forgotError && (
                <div className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-rose-100 text-sm">
                  {forgotError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


