import { io } from "socket.io-client";
import { apiOrigin } from "./api.js";
import { getToken } from "../state/auth.js";

let socket;
export function ioClient() {
  if (!socket) {
    const base =
      import.meta.env.VITE_SOCKET_URL ||
      apiOrigin ||
      (typeof window !== "undefined" ? window.location.origin : "");
    // Conexão Socket.IO (deixa transports padrão para permitir fallback/polling)
    socket = io(base, {
      path: "/socket.io",
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      // O servidor exige o token; a função é avaliada a cada (re)conexão
      auth: (cb) => cb({ token: getToken() }),
      autoConnect: !!getToken(),
    });

    // Login/logout/troca de usuário: reconecta com o token atual
    if (typeof window !== "undefined") {
      window.addEventListener("chat:auth-changed", () => {
        try {
          socket.disconnect();
          if (getToken()) socket.connect();
        } catch {}
      });
    }
  }
  return socket;
}
