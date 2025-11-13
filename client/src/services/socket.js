import { io } from "socket.io-client";
import { apiOrigin } from "./api.js";

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
    });
  }
  return socket;
}
