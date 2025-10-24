import { readConfig, updateConfig } from "./config.js";
import { createBackup, pruneOldBackups } from "./backup.js";

let timer = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function parseTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function computeNextRun(time = "02:00") {
  const parsed = parseTime(time) || { hour: 2, minute: 0 };
  const now = new Date();
  const next = new Date();
  next.setHours(parsed.hour, parsed.minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function runAutoBackup(settings = {}) {
  try {
    const backup = await createBackup({ reason: "auto" });
    if (settings.retentionDays && settings.retentionDays > 0) {
      await pruneOldBackups(settings.retentionDays);
    }
    const cfg = readConfig();
    updateConfig({
      backup: {
        ...cfg.backup,
        lastAutoRunAt: new Date().toISOString(),
        lastAutoResult: {
          ok: true,
          name: backup?.name || null,
        },
      },
    });
  } catch (err) {
    console.error("Auto-backup falhou:", err.message);
    const cfg = readConfig();
    updateConfig({
      backup: {
        ...cfg.backup,
        lastAutoRunAt: new Date().toISOString(),
        lastAutoResult: {
          ok: false,
          error: err.message || "Falha ao executar auto-backup",
        },
      },
    });
  }
}

function scheduleNext() {
  clearTimer();
  const cfg = readConfig();
  const backup = cfg.backup || {};
  if (!backup.autoEnabled) return;
  const next = computeNextRun(backup.time || "02:00");
  const delay = Math.max(5_000, next.getTime() - Date.now());
  timer = setTimeout(async () => {
    await runAutoBackup(backup);
    scheduleNext();
  }, delay);
}

export function initBackupScheduler() {
  try {
    scheduleNext();
  } catch (err) {
    console.error("Falha ao iniciar scheduler de backup:", err.message);
  }
}

export function refreshBackupSchedule() {
  try {
    scheduleNext();
  } catch (err) {
    console.error("Falha ao reagendar backups:", err.message);
  }
}
