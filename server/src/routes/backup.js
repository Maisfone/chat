import express from "express";
import { authRequired, adminRequired } from "../middleware/auth.js";
import {
  backupExists,
  createBackup,
  deleteBackup,
  listBackups,
  restoreBackup,
  streamBackupAsZip,
} from "../lib/backup.js";
import { readConfig, updateConfig } from "../lib/config.js";
import { refreshBackupSchedule } from "../lib/backupScheduler.js";

const router = express.Router();

router.use(authRequired);
router.use(adminRequired);

function maskActor(user) {
  if (!user) return null;
  return {
    id: user.id || null,
    name: user.name || null,
    email: user.email || null,
  };
}

router.get("/", (req, res) => {
  try {
    const backups = listBackups();
    const cfg = readConfig();
    res.json({
      backups,
      settings: cfg.backup || {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Falha ao listar backups" });
  }
});

router.post("/run", async (req, res) => {
  try {
    const backup = await createBackup({
      reason: "manual",
      actorId: req.user?.id || null,
    });
    const cfg = readConfig();
    updateConfig({
      backup: {
        ...cfg.backup,
        lastManualRunAt: new Date().toISOString(),
        lastManualResult: {
          ok: true,
          name: backup?.name || null,
          actor: maskActor(req.user),
        },
      },
    });
    res.json({ ok: true, backup });
  } catch (err) {
    const cfg = readConfig();
    updateConfig({
      backup: {
        ...cfg.backup,
        lastManualRunAt: new Date().toISOString(),
        lastManualResult: {
          ok: false,
          error: err.message || "Falha ao executar backup",
          actor: maskActor(req.user),
        },
      },
    });
    res.status(500).json({ error: err.message || "Falha ao executar backup" });
  }
});

router.get("/download/:name", async (req, res) => {
  const { name } = req.params;
  if (!name || !backupExists(name)) {
    return res.status(404).json({ error: "Backup não encontrado" });
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.zip"`);
  try {
    await streamBackupAsZip(name, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Falha ao compactar backup" });
    } else {
      res.destroy(err);
    }
  }
});

router.post("/restore", async (req, res) => {
  const { name, confirm } = req.body || {};
  if (!name || !backupExists(name)) {
    return res.status(404).json({ error: "Backup não encontrado" });
  }
  if (confirm !== true) {
    return res.status(400).json({ error: "Confirmação obrigatória" });
  }
  try {
    await restoreBackup(name);
    const cfg = readConfig();
    updateConfig({
      backup: {
        ...cfg.backup,
        lastRestoreAt: new Date().toISOString(),
        lastRestoreName: name,
        lastRestoreActor: maskActor(req.user),
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Falha ao restaurar backup" });
  }
});

router.post("/settings", (req, res) => {
  try {
    const { autoEnabled, time, retentionDays } = req.body || {};
    const cfg = readConfig();
    const next = {
      ...cfg.backup,
      autoEnabled: Boolean(autoEnabled),
      time: validateTime(time) || cfg.backup?.time || "02:00",
      retentionDays: sanitizeRetention(retentionDays, cfg.backup?.retentionDays),
    };
    const updated = updateConfig({ backup: next });
    refreshBackupSchedule();
    res.json({ ok: true, settings: updated.backup });
  } catch (err) {
    res.status(400).json({ error: err.message || "Falha ao salvar configurações" });
  }
});

router.delete("/:name", (req, res) => {
  const { name } = req.params;
  if (!name || !backupExists(name)) {
    return res.status(404).json({ error: "Backup não encontrado" });
  }
  try {
    deleteBackup(name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Falha ao excluir backup" });
  }
});

function validateTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function sanitizeRetention(value, fallback = 7) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0 && num <= 365) {
    return Math.round(num);
  }
  return fallback ?? 7;
}

export default router;
