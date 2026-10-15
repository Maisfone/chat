import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiPublic } from "../services/api.js";
import { IconEye, IconEyeOff } from "../components/Icon.jsx";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

// Tela aberta pelo link enviado no e-mail de "Esqueci minha senha"
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha deve ter pelo menos 6 caracteres");
    if (password !== confirm) return setError("As senhas não conferem");
    setLoading(true);
    try {
      const res = await apiPublic.post("/auth/reset-password", { token, password });
      setDone(res?.message || "Senha alterada. Faça login com a nova senha.");
      setTimeout(() => nav("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err?.message || "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-white/10 bg-white/90 p-8 text-slate-900 shadow-2xl dark:bg-slate-900/85 dark:text-slate-100"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Criar nova senha</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Escolha uma nova senha para sua conta.
          </p>
        </div>

        {!token ? (
          <div className="rounded-xl border border-red-300/60 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            Link inválido. Solicite uma nova redefinição na tela de login.
          </div>
        ) : done ? (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
            {done}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-password" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  className={inputClass}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 my-1 inline-flex items-center justify-center rounded-lg px-3 text-emerald-600 dark:text-emerald-300"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirm-password" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                Confirmar nova senha
              </label>
              <input
                id="confirm-password"
                className={inputClass}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-300/60 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 px-6 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </>
        )}

        <Link to="/login" className="text-center text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-300">
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}
