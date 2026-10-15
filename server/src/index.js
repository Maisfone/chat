import "dotenv/config";
import "./lib/asyncErrors.js";
import express from "express";
import cors from "cors";
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
import { verifyToken } from "./middleware/auth.js";
import { prisma } from "./prisma.js";

// JWT_SECRET é obrigatório e precisa ser forte: quem conhece o segredo consegue gerar token de admin
const WEAK_SECRETS = new Set(["dev-super-secret-change-me", "dev-local-secret-change-me", "270424@Mel"]);
const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret || WEAK_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
  const msg = "JWT_SECRET ausente ou fraco. Gere um com: openssl rand -hex 32";
  if (process.env.NODE_ENV === "production" || !jwtSecret) {
    console.error(msg);
    process.exit(1);
  }
  console.warn("AVISO:", msg);
}

setVapidFromEnv();

// CORS configurável por env (padrão: qualquer origem)
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowedOrigins = corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim());

const app = express();
// Confia apenas no primeiro proxy (Traefik/Nginx) para obter o IP real do cliente
app.set("trust proxy", 1);
app.disable("x-powered-by");
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

// Disponibiliza io nas rotas
app.use((req, res, next) => {
  req.io = io;
  next();
});

const corsOptions = {
  origin: allowedOrigins,
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
// Extensões que podem abrir direto no navegador; o resto é baixado como anexo
const INLINE_UPLOAD = /\.(png|jpe?g|gif|webp|bmp|avif|ico|mp3|ogg|oga|opus|wav|m4a|aac|weba|webm|mp4|m4v|mov|pdf)$/i;
app.use(
  "/" + uploadDir,
  express.static(uploadDir, {
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Impede que um arquivo enviado rode scripts no domínio da API
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
      if (!INLINE_UPLOAD.test(filePath)) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  })
);

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

// Socket.IO: exige token JWT válido no handshake (auth: { token })
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || null;
    socket.data.user = await verifyToken(token);
    socket.data.userId = socket.data.user.id;
    next();
  } catch (e) {
    next(new Error(e?.status === 401 ? "unauthorized" : "internal"));
  }
});

async function isGroupMember(userId, groupId) {
  if (!userId || typeof groupId !== "string" || !groupId) return false;
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId }, select: { id: true } });
  return Boolean(member);
}

function safeStatus(value) {
  const status = typeof value === "string" ? value.trim().slice(0, 32) : "";
  return status || "online";
}

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  // Sala pessoal para eventos direcionados (ex.: dm:created)
  socket.join(`user:${userId}`);

  socket.on("group:join", async (groupId) => {
    try {
      if (await isGroupMember(userId, groupId)) socket.join(groupId);
    } catch {}
  });
  socket.on("group:leave", (groupId) => {
    if (typeof groupId === "string") socket.leave(groupId);
  });

  // WebRTC signaling via rooms
  socket.on("webrtc:join", (room) => {
    if (typeof room === "string" && room) socket.join("webrtc:" + room);
  });
  socket.on("webrtc:leave", (room) => {
    if (typeof room === "string" && room) socket.leave("webrtc:" + room);
  });
  socket.on("webrtc:signal", ({ room, data } = {}) => {
    if (typeof room !== "string" || !socket.rooms.has("webrtc:" + room)) return;
    socket.to("webrtc:" + room).emit("webrtc:signal", data);
  });
  socket.on("webrtc:room:count", (room, cb) => {
    if (typeof cb !== "function") return;
    const r = typeof room === "string" ? io.sockets.adapter.rooms.get("webrtc:" + room) : null;
    cb({ count: r ? r.size : 0 });
  });

  // SIP registration status broadcast (app-level)
  socket.on("sip:reg", (payload = {}) => {
    try {
      socket.broadcast.emit("sip:reg", { ...(typeof payload === "object" && payload ? payload : {}), userId });
    } catch {}
  });

  // Presence: o userId vem sempre do token, nunca do payload
  socket.on("presence:online", (payload = {}) => {
    try {
      const status = safeStatus(payload?.status);
      if (!socket.data.presenceMarked) {
        // Conta cada conexão uma única vez (o cliente pode reenviar este evento)
        socket.data.presenceMarked = true;
        const { firstSession, status: nextStatus } = markOnline(userId, status);
        if (firstSession) io.emit("presence:update", { userId, status: nextStatus || "online" });
      } else {
        const next = updateStatus(userId, status);
        io.emit("presence:update", { userId, status: next?.status || "online" });
      }
      socket.emit("presence:snapshot", { users: getPresenceSnapshot() });
    } catch {}
  });
  socket.on("presence:set", (payload = {}) => {
    try {
      const next = updateStatus(userId, safeStatus(payload?.status));
      io.emit("presence:update", { userId, status: next?.status || "online" });
    } catch {}
  });
  socket.on("presence:who", () => {
    try {
      socket.emit("presence:snapshot", { users: getPresenceSnapshot() });
    } catch {}
  });
  socket.on("disconnect", () => {
    try {
      if (!socket.data.presenceMarked) return;
      const { wentOffline } = markOffline(userId);
      if (wentOffline) io.emit("presence:update", { userId, status: "offline" });
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
    error: status >= 500 && process.env.NODE_ENV === "production" ? "Erro interno" : err.message || "Erro interno",
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
