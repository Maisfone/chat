import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import archiver from "archiver";

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_ROOT = path.resolve(process.cwd(), process.env.BACKUP_DIR || "backups");
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
const PG_DUMP_CMD = process.env.PG_DUMP_PATH || "pg_dump";
const PSQL_CMD = process.env.PSQL_PATH || "psql";

function ensureBackupRoot() {
  try {
    if (!fs.existsSync(BACKUP_ROOT)) fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  } catch (err) {
    throw new Error(`Não foi possível criar diretório de backups: ${err.message}`);
  }
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function uniqueBackupName() {
  const base = `chat-backup-${formatTimestamp()}`;
  if (!fs.existsSync(path.join(BACKUP_ROOT, base))) return base;
  let idx = 1;
  while (fs.existsSync(path.join(BACKUP_ROOT, `${base}-${idx}`))) {
    idx += 1;
  }
  return `${base}-${idx}`;
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...options });
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error(`Comando "${cmd}" não encontrado. Instale as ferramentas do PostgreSQL ou configure PG_DUMP_PATH/PSQL_PATH.`));
      } else {
        reject(err);
      }
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} terminou com código ${code}`));
    });
  });
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) return;
  try {
    fs.cpSync(source, target, { recursive: true });
  } catch (err) {
    throw new Error(`Falha ao copiar ${source} -> ${target}: ${err.message}`);
  }
}

function calcDirSize(dir) {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += calcDirSize(full);
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {}
    }
  }
  return total;
}

export function getBackupPath(name) {
  const dir = path.join(BACKUP_ROOT, name);
  if (!dir.startsWith(BACKUP_ROOT)) {
    throw new Error("Nome de backup inválido.");
  }
  return dir;
}

export function backupExists(name) {
  try {
    const dir = getBackupPath(name);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export async function createBackup({ reason = "manual", actorId = null } = {}) {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL não configurado no servidor.");
  }
  ensureBackupRoot();
  const name = uniqueBackupName();
  const dir = getBackupPath(name);
  fs.mkdirSync(dir, { recursive: true });

  const dumpFile = path.join(dir, "db.sql");
  const dumpArgs = [
    `--dbname=${DATABASE_URL}`,
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    `--file=${dumpFile}`,
  ];
  await runCommand(PG_DUMP_CMD, dumpArgs);

  const uploadsTarget = path.join(dir, "uploads");
  if (fs.existsSync(UPLOAD_DIR)) {
    copyDirectory(UPLOAD_DIR, uploadsTarget);
  }

  const meta = {
    createdAt: new Date().toISOString(),
    reason,
    actorId,
    uploadsIncluded: fs.existsSync(uploadsTarget),
    databaseUrlMasked: maskDatabaseUrl(DATABASE_URL),
  };
  fs.writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(meta, null, 2), "utf-8");

  return getBackupInfo(name);
}

export function getBackupInfo(name) {
  if (!backupExists(name)) throw new Error("Backup não encontrado.");
  const dir = getBackupPath(name);
  const stats = fs.statSync(dir);
  let metadata = {};
  const metaFile = path.join(dir, "metadata.json");
  if (fs.existsSync(metaFile)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
    } catch {}
  }
  const size = calcDirSize(dir);
  return {
    name,
    createdAt: metadata.createdAt || stats.birthtime.toISOString(),
    size,
    uploadsIncluded: metadata.uploadsIncluded ?? fs.existsSync(path.join(dir, "uploads")),
    meta: metadata,
  };
}

export function listBackups() {
  ensureBackupRoot();
  const entries = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const list = dirs.map((name) => {
    try {
      return getBackupInfo(name);
    } catch (err) {
      return null;
    }
  });
  return list
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteBackup(name) {
  if (!backupExists(name)) return;
  const dir = getBackupPath(name);
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function pruneOldBackups(retentionDays = 0) {
  if (!retentionDays || retentionDays <= 0) return;
  const now = Date.now();
  const keepMs = retentionDays * 24 * 60 * 60 * 1000;
  const backups = listBackups();
  backups.forEach((backup) => {
    const created = new Date(backup.createdAt).getTime();
    if (Number.isFinite(created) && now - created > keepMs) {
      try {
        deleteBackup(backup.name);
      } catch (err) {
        console.error(`Falha ao excluir backup antigo ${backup.name}:`, err.message);
      }
    }
  });
}

export async function restoreBackup(name) {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL não configurado no servidor.");
  }
  if (!backupExists(name)) {
    throw new Error("Backup não encontrado.");
  }
  const dir = getBackupPath(name);
  const dumpFile = path.join(dir, "db.sql");
  if (!fs.existsSync(dumpFile)) {
    throw new Error("Arquivo db.sql não encontrado no backup.");
  }
  const restoreArgs = [
    `--dbname=${DATABASE_URL}`,
    "--single-transaction",
    "--set=ON_ERROR_STOP=on",
    "--file",
    dumpFile,
  ];
  await runCommand(PSQL_CMD, restoreArgs);

  const uploadsBackup = path.join(dir, "uploads");
  if (fs.existsSync(uploadsBackup)) {
    if (fs.existsSync(UPLOAD_DIR)) {
      const entries = fs.readdirSync(UPLOAD_DIR);
      for (const entry of entries) {
        fs.rmSync(path.join(UPLOAD_DIR, entry), { recursive: true, force: true });
      }
    } else {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    copyDirectory(uploadsBackup, UPLOAD_DIR);
  }
}

export function streamBackupAsZip(name, res) {
  if (!backupExists(name)) {
    throw new Error("Backup não encontrado.");
  }
  const dir = getBackupPath(name);
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => reject(err));
    archive.on("end", () => resolve());
    archive.directory(dir, name);
    archive.pipe(res);
    archive.finalize();
  });
}

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    if (parsed.username) parsed.username = `${parsed.username[0] || ""}***`;
    return parsed.toString();
  } catch {
    return "masked";
  }
}

export { BACKUP_ROOT, UPLOAD_DIR };
