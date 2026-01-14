import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import morgan from "morgan";

import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";
import dmRoutes from "./routes/dm.js";
import phoneRoutes from "./routes/phone.js";
import meetingRoutes from "./routes/meetings.js";
import configRoutes from "./routes/config.js";
import backupRoutes from "./routes/backup.js";
import pushRoutes from "./routes/push.js";
import adminMetricsRoutes from "./routes/adminMetrics.js";
import { setVapidFromEnv } from "./lib/push.js";
import { initBackupScheduler } from "./lib/backupScheduler.js";
import { markOnline, markOffline, updateStatus, getPresenceSnapshot } from "./lib/presence.js";

dotenv.config();
setVapidFromEnv();

const app = express();
app.set("trust proxy", true);
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

// Disponibiliza io nas rotas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS configurável por env (padrão: qualquer origem)
const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsOptions = {
  origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
// Responde corretamente preflight (OPTIONS)
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// Arquivos estáticos (uploads)
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/" + uploadDir, express.static(uploadDir));

// Evita warning do Chrome ao procurar /.well-known/appspecific/com.chrome.devtools.json
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  // Chrome/Edge tenta esse arquivo por padrão; responder 204 elimina o 404 + CSP noise.
  res.status(204).end();
});

// Página raiz simples para não retornar 404 com CSP restritiva
app.get("/", (req, res) => {
  res.type("text/plain").send("API online");
});

// Healthcheck e ping
app.get("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Rotas
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dm", dmRoutes);
app.use("/api/phone", phoneRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/admin/config", configRoutes);
app.use("/api/admin/backup", backupRoutes);
app.use("/api/admin/metrics", adminMetricsRoutes);
app.use("/api/push", pushRoutes);

initBackupScheduler();

// Socket rooms
io.on("connection", (socket) => {
  socket.on("group:join", (groupId) => socket.join(groupId));
  socket.on("group:leave", (groupId) => socket.leave(groupId));

  // WebRTC signaling via rooms
  socket.on("webrtc:join", (room) => {
    try {
      socket.join("webrtc:" + room);
    } catch {}
  });
  socket.on("webrtc:leave", (room) => {
    try {
      socket.leave("webrtc:" + room);
    } catch {}
  });
  socket.on("webrtc:signal", ({ room, data }) => {
    try {
      socket.to("webrtc:" + room).emit("webrtc:signal", data);
    } catch {}
  });
  socket.on("webrtc:room:count", (room, cb) => {
    try {
      const full = "webrtc:" + room;
      const r = io.sockets.adapter.rooms.get(full);
      cb?.({ count: r ? r.size : 0 });
    } catch {
      cb?.({ count: 0 });
    }
  });

  // SIP registration status broadcast (app-level)
  socket.on("sip:reg", (payload) => {
    try {
      socket.broadcast.emit("sip:reg", payload);
    } catch {}
  });

  // Presence: client should emit presence:online with { userId, status }
  socket.on("presence:online", (payload = {}) => {
    try {
      const userId = payload.userId;
      const status = payload.status || "online";
      socket.data.userId = userId;
      socket.data.status = status;
      const { firstSession, status: nextStatus } = markOnline(userId, status);
      if (firstSession) {
        try { io.emit("presence:update", { userId, status: nextStatus || "online" }); } catch {}
      }
      const users = getPresenceSnapshot();
      socket.emit("presence:snapshot", { users });
    } catch {}
  });
  // Update status (busy/away)
  socket.on("presence:set", (payload = {}) => {
    try {
      const status = payload.status || "online";
      const userId = socket.data.userId || payload.userId;
      const next = updateStatus(userId, status);
      socket.data.status = next?.status || status;
      try { io.emit("presence:update", { userId, status: next?.status || "online" }); } catch {}
    } catch {}
  });
  socket.on("presence:who", () => {
    try {
      const users = getPresenceSnapshot();
      socket.emit("presence:snapshot", { users });
    } catch {}
  });
  socket.on("disconnect", () => {
    try {
      const { wentOffline } = markOffline(socket.data?.userId);
      if (wentOffline) {
        try { io.emit("presence:update", { userId: socket.data?.userId, status: "offline" }); } catch {}
      }
    } catch {}
  });
});

// 404 para APIs
app.use("/api", (req, res, next) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Handler de erros JSON (dev-friendly)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const payload = {
    error: err.message || "Erro interno",
  };
  // Detalhes somente fora de produção
  if (process.env.NODE_ENV !== "production") {
    payload.details = err.stack;
  }
  console.error("API error:", err);
  res.status(status).json(payload);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));

// Captura falhas não tratadas para log útil
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
