#!/usr/bin/env node
/**
 * Simple backup helper for the chat application.
 *
 * Creates a timestamped directory inside ./backups containing:
 *  - db.sql  (result of pg_dump)
 *  - uploads/ (copy of the configured UPLOAD_DIR, if it exists)
 *
 * Requirements:
 *  - Environment variable DATABASE_URL must be set (same as used by Prisma)
 *  - PostgreSQL client tools (pg_dump) available in PATH
 *
 * Usage:
 *    node scripts/chat-backup.js
 */

const { spawnSync } = require("node:child_process");
const { mkdirSync, existsSync, cpSync, writeFileSync } = require("node:fs");
const { resolve, join } = require("node:path");

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail("DATABASE_URL não definido. Exporte a variável antes de executar o backup.");
}

const uploadDir = resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");
const backupRoot = resolve(process.cwd(), "backups");
const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupDir = join(backupRoot, `chat-backup-${timestamp}`);

try {
  if (!existsSync(backupRoot)) {
    mkdirSync(backupRoot, { recursive: true });
  }
  mkdirSync(backupDir, { recursive: true });
} catch (err) {
  fail(`Não foi possível criar diretório de backup (${err.message})`);
}

console.log("📦 Iniciando backup...");
console.log(`   Diretório: ${backupDir}`);

const dumpFile = join(backupDir, "db.sql");
console.log("🗄️  Exportando banco de dados com pg_dump...");
const dumpArgs = [
  `--dbname=${databaseUrl}`,
  "--no-owner",
  "--no-privileges",
  "--clean",
  "--if-exists",
  `--file=${dumpFile}`,
];
const pgDumpCmd = process.env.PG_DUMP_PATH || "pg_dump";
const dumpResult = spawnSync(pgDumpCmd, dumpArgs, {
  stdio: "inherit",
});

if (dumpResult.error && dumpResult.error.code === "ENOENT") {
  fail(`Não foi possível encontrar o comando "${pgDumpCmd}". Ajuste a variável PG_DUMP_PATH ou instale as ferramentas do PostgreSQL (pg_dump).`);
}

if (dumpResult.status !== 0) {
  fail("pg_dump falhou. Verifique se o utilitário está instalado e se a conexão está correta.");
}

console.log("🖼️  Copiando arquivos enviados (uploads)...");
if (existsSync(uploadDir)) {
  const target = join(backupDir, "uploads");
  try {
    cpSync(uploadDir, target, { recursive: true });
  } catch (err) {
    fail(`Falha ao copiar uploads: ${err.message}`);
  }
} else {
  console.log("   Nenhum diretório de uploads encontrado, ignorando esta etapa.");
}

const metaFile = join(backupDir, "metadata.json");
writeFileSync(
  metaFile,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      databaseUrlMask: maskDatabaseUrl(databaseUrl),
      uploadDir: uploadDir,
    },
    null,
    2
  ),
  "utf8"
);

console.log("✅ Backup concluído com sucesso!");
console.log(`   Conteúdo salvo em: ${backupDir}`);

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    if (parsed.username) {
      parsed.username = parsed.username[0] + "***";
    }
    return parsed.toString();
  } catch {
    return "masked";
  }
}
