import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api.js";
import { setAuth } from "../state/auth.js";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // validaÃ§Ãµes bÃ¡sicas
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!emailOk) throw new Error("Informe um e-mail vÃ¡lido");
      if (!password || password.length < 8)
        throw new Error("A senha deve ter pelo menos 8 caracteres");

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

  return (
    <div className="grid place-items-center h-screen bg-slate-50 dark:bg-slate-900">
      <form
        onSubmit={onSubmit}
        className="w-80 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm flex flex-col gap-2"
        noValidate
      >
        <h2 className="text-xl font-semibold">Entrar</h2>
        <label className="text-sm text-slate-700 dark:text-slate-200">E-mail</label>
        <input
          className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          placeholder="voce@empresa.com"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="text-sm text-slate-700 dark:text-slate-200 mt-2">Senha</label>
        <input
          className="border rounded px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Lembrar de mim
        </label>
        {error && (
          <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>
        )}
        <button
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
          NÃ£o tem conta?{" "}
          <Link
            className="text-blue-500 dark:text-blue-400 hover:underline"
            to="/register"
          >
            Cadastrar
          </Link>
        </div>
      </form>
    </div>
  );
}


