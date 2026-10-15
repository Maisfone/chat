#!/usr/bin/env node
/**
 * Restore helper for chat backups created with chat-backup.js
 *
 * Requirements:
 *  - DATABASE_URL set
 *  - PostgreSQL client tools (psql) available in PATH
 *
 * Usage:
 *    node scripts/chat-restore.js ./backups/chat-backup-2024-10-21T12-00-00
 *
 * WARNING: This will overwrite the current database contents and uploads.
 */

const { spawnSync } = require("node:child_process");
const { existsSync, statSync, cpSync, rmSync, readdirSync } = require("node:fs");
const { resolve, join } = require("node:path");
const readline = require("node:readline");

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

// pg_dump/psql não aceitam parâmetros específicos do Prisma (ex.: ?schema=public)
function pgToolsUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size", "socket_timeout"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail("DATABASE_URL não definido. Exporte a variável antes de restaurar.");
}

const backupArg = process.argv[2];
if (!backupArg) {
  fail("Informe o caminho do diretório de backup. Exemplo: node scripts/chat-restore.js ./backups/chat-backup-XXXX");
}

const backupDir = resolve(process.cwd(), backupArg);
if (!existsSync(backupDir) || !statSync(backupDir).isDirectory()) {
  fail(`Diretório de backup inválido: ${backupDir}`);
}

const dumpFile = join(backupDir, "db.sql");
if (!existsSync(dumpFile)) {
  fail(`Arquivo db.sql não encontrado no backup (${dumpFile}).`);
}

const uploadsBackup = join(backupDir, "uploads");
const uploadsTarget = resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("⚠️  ESTA OPERAÇÃO IRÁ SUBSTITUIR O BANCO E OS UPLOADS ATUAIS.");
console.log(`    Backup: ${backupDir}`);
console.log(`    Banco:  ${maskDatabaseUrl(databaseUrl)}`);
console.log(`    Uploads destino: ${uploadsTarget}`);

const confirmFlag = process.argv.includes("--force");
if (!confirmFlag) {
  rl.question("Digite RESTAURAR (em maiúsculas) para confirmar: ", (answer) => {
    rl.close();
    if (answer.trim() === "RESTAURAR") {
      runRestore();
    } else {
      console.log("Operação cancelada.");
      process.exit(0);
    }
  });
} else {
  rl.close();
  runRestore();
}

function runRestore() {
  console.log("🗄️  Restaurando banco de dados com psql...");
  const restoreArgs = [
    `--dbname=${pgToolsUrl(databaseUrl)}`,
    "--single-transaction",
    "--set=ON_ERROR_STOP=on",
    "--file",
    dumpFile,
  ];
  const psqlCmd = process.env.PSQL_PATH || "psql";
  const restoreResult = spawnSync(psqlCmd, restoreArgs, {
    stdio: "inherit",
  });

  if (restoreResult.error && restoreResult.error.code === "ENOENT") {
    fail(`Não foi possível encontrar o comando "${psqlCmd}". Ajuste a variável PSQL_PATH ou instale as ferramentas do PostgreSQL (psql).`);
  }

  if (restoreResult.status !== 0) {
    fail("Falha ao restaurar o banco de dados com psql.");
  }

  if (existsSync(uploadsBackup)) {
    console.log("🖼️  Restaurando uploads...");
    try {
      if (existsSync(uploadsTarget)) {
        // Remover conteúdo existente
        for (const entry of readdirSync(uploadsTarget)) {
          rmSync(join(uploadsTarget, entry), { recursive: true, force: true });
        }
      }
      cpSync(uploadsBackup, uploadsTarget, { recursive: true });
    } catch (err) {
      fail(`Falha ao restaurar uploads: ${err.message}`);
    }
  } else {
    console.log("   Nenhum diretório uploads no backup. Etapa ignorada.");
  }

  console.log("✅ Restauração concluída.");
}

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    if (parsed.username) parsed.username = parsed.username[0] + "***";
    return parsed.toString();
  } catch {
    return "masked";
  }
}
