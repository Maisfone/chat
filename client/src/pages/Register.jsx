import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPublic } from "../services/api.js";

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rememberTerms, setRememberTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!rememberTerms) {
      setError("Confirme que leu e aceita os termos de uso.");
      return;
    }
    setError("");
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("email", email.trim());
      form.append("password", password);
      if (avatar) form.append("avatar", avatar);
      await apiPublic.upload("/auth/register", form);
      nav("/login?registered=1");
    } catch (e) {
      setError(e.message || "Falha no cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0] || null;
    setAvatar(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-36 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="absolute bottom-[-7rem] right-[-6rem] h-96 w-96 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.65),rgba(15,23,42,0.92))]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl gap-10 rounded-[2.5rem] border border-white/5 bg-white/5 p-8 shadow-[0_22px_80px_-28px_rgba(14,116,144,0.8)] backdrop-blur-lg lg:grid-cols-[1.05fr_1fr] lg:p-12">
          <div className="hidden flex-col justify-between lg:flex">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-slate-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Crie sua conta em minutos
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-white">
                Personalize seu atendimento com o poder do Farmachat
              </h1>
              <p className="text-lg text-slate-300">
                Gestão de equipes, dashboards inteligentes e integrações prontas para canais que o seu cliente ama usar.
              </p>
            </div>
            <ul className="mt-10 space-y-4 text-sm text-slate-200/80">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
                  ✓
                </span>
                Fluxos automáticos e organização de filas de atendimento.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">
                  ✓
                </span>
                Biblioteca de templates, etiquetas e respostas salvas.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
                  ✓
                </span>
                Times ilimitados, usuários convidados e permissões customizadas.
              </li>
            </ul>
          </div>

          <form
            onSubmit={onSubmit}
            className="relative flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/90 p-8 text-slate-900 shadow-2xl backdrop-blur dark:bg-slate-900/85 dark:text-slate-100"
            noValidate
          >
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Farmachat" className="h-10 w-auto" draggable={false} />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                Novo portal de atendimento
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Criar conta</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Preencha os dados abaixo para ativar seu espaço de trabalho.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                Nome completo
              </label>
              <input
                id="name"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Como devemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                E-mail corporativo
              </label>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="voce@empresa.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-28 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Crie uma senha"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-3 my-1 inline-flex items-center justify-center rounded-lg border border-transparent px-3 text-xs font-medium text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:text-cyan-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-500/10"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="confirm" className="text-sm font-medium text-slate-600 dark:text-slate-200">
                  Confirmar senha
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-28 text-sm text-slate-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Repita a senha"
                    type={showConfirm ? "text" : "password"}
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute inset-y-0 right-3 my-1 inline-flex items-center justify-center rounded-lg border border-transparent px-3 text-xs font-medium text-cyan-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:text-cyan-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-500/10"
                  >
                    {showConfirm ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-200">
                Foto de perfil (opcional)
              </label>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  {preview ? (
                    <img src={preview} alt="Pré-visualização do avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-slate-400 dark:text-slate-500">
                      sem foto
                    </div>
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-cyan-200 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/60 dark:hover:text-cyan-300">
                  <span>Carregar imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
            </div>

            <label className="mt-1 inline-flex items-start gap-3 text-xs text-slate-500 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberTerms}
                onChange={(event) => setRememberTerms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 dark:border-slate-600"
              />
              <span>
                Li e concordo com os termos de uso, política de privacidade e boas práticas da Farmachat.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-300/60 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 via-emerald-500 to-blue-500 px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-2xl hover:shadow-cyan-500/35 disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? "Cadastrando..." : "Criar minha conta"}
            </button>

            <div className="text-center text-sm text-slate-500 dark:text-slate-300">
              Já possui conta?{" "}
              <Link
                className="font-medium text-cyan-600 transition hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200"
                to="/login"
              >
                Entrar
              </Link>
            </div>

            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
              Suporte 24/7 e implementação assistida inclusos para novos clientes.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
