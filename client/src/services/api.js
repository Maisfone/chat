import { getToken, clearAuth } from "../state/auth.js";

function inferDefaultApiBase() {
  // Try to infer a sensible default for dev/prod without .env
  try {
    if (typeof window !== "undefined") {
      const { origin, location } = window;
      const host = location?.hostname || "";
      // Local development: frontend at localhost (Vite or Nginx) + backend at :3000
      if (host === "localhost" || host === "127.0.0.1") {
        return "http://localhost:3000/api";
      }
      // Same-origin deployments with reverse proxy exposing /api
      return `${String(origin).replace(/\/$/, "")}/api`;
    }
  } catch {}
  // Fallback for non-browser contexts
  return "http://localhost:3000/api";
}

export const API_BASE = import.meta.env.VITE_API_URL || inferDefaultApiBase();
export const apiOrigin = API_BASE.replace(/\/?api$/, "");

async function handle(res) {
  if (!res.ok) {
    const t = await res.text();
    let msg;
    try {
      msg = JSON.parse(t).error || t;
    } catch {
      msg = t;
    }
    throw new Error(msg || "Erro de requisiÃ§Ã£o");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  get: (path) =>
    fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(handleAuth),
  post: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    }).then(handleAuth),
  patch: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    }).then(handleAuth),
  del: (path) =>
    fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(handleAuth),
  upload: (path, form) =>
    fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(handleAuth),
  uploadPatch: (path, form) =>
    fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(handleAuth),
  delete: (path) =>
    fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(handleAuth),
};

export const apiPublic = {
  post: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleAuth),
  upload: (path, form) =>
    fetch(`${API_BASE}${path}`, { method: "POST", body: form }).then(
      handleAuth
    ),
};

export function absUrl(u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  // Trata caminhos relativos como /uploads/...
  return `${apiOrigin.replace(/\/$/, "")}${u}`;
}

// Auth-aware response handler: auto-logout on 401
async function handleAuth(res) {
  if (!res.ok) {
    const t = await res.text();
    let msg;
    try {
      msg = JSON.parse(t).error || t;
    } catch {
      msg = t;
    }
    if (res.status === 401) {
      try {
        clearAuth();
      } catch {}
      try {
        if (typeof window !== "undefined") window.location.assign("/login");
      } catch {}
      throw new Error(msg || "Sessão expirada. Faça login novamente.");
    }
    throw new Error(msg || "Erro de requisição");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
