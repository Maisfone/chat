Chat Farmacon - Fullstack (Node/Express + React + PostgreSQL)

## Rodando com Docker (local)

1. Copie `.env.example` para `.env` e preencha `POSTGRES_PASSWORD` e `JWT_SECRET`
   (gere o segredo com `openssl rand -hex 32`).
2. `docker compose up -d --build`
3. Acesse http://localhost (frontend) — a API fica em http://localhost:3000.
4. Crie o admin (o mesmo comando redefine a senha dele se já existir):
   `docker compose exec -e ADMIN_EMAIL=voce@empresa.com -e ADMIN_PASSWORD=senha-forte server npm run seed:admin`

## Rodando sem Docker (desenvolvimento)

Backend (`server/`):
- Copie `server/.env.example` para `server/.env` e ajuste `DATABASE_URL` e `JWT_SECRET`.
- `npm ci`, `npx prisma migrate deploy`, `npm run seed:admin`
- `npm run dev` (porta 3000)

Frontend (`client/`):
- `npm ci` e `npm run dev` (porta 5173). Em localhost a API é detectada em `http://localhost:3000/api`.

## Produção

O arquivo `docker-compose.dev.yml` é o deploy de produção (Traefik). Os segredos ficam em
`.env.producao` (não versionado — veja `.env.producao.example`):

```
docker compose --env-file .env.producao -f docker-compose.dev.yml up -d
```

- `JWT_SECRET` é obrigatório e precisa ter pelo menos 32 caracteres; o servidor não sobe sem ele.
- `APP_URL` (endereço do frontend) é usado no link do e-mail de redefinição de senha.
- Uploads, configurações (`data/`) e backups ficam em volumes Docker e sobrevivem a novos deploys.

## Segurança

- Nunca versione arquivos `.env`; use os `*.example` como modelo.
- Mensagens e eventos em tempo real só chegam a membros do grupo; o Socket.IO exige o JWT.
- Bloquear um usuário, remover admin ou trocar a senha derruba as sessões abertas.
- "Esqueci minha senha" envia um link de uso único válido por 30 minutos.

Endpoints chave
- POST `/api/auth/register` (name, email, password)
- POST `/api/auth/login` (email, password)
- POST `/api/auth/forgot-password` (email) – envia link de redefinição
- POST `/api/auth/reset-password` (token, password) – define nova senha pelo link
- GET `/api/groups` (autenticado) – lista grupos do usuário
- POST `/api/groups` (admin) – cria grupo
- POST `/api/groups/:groupId/members` (admin) – adiciona membro
- GET `/api/messages/:groupId` – lista mensagens (somente membros)
- POST `/api/messages/:groupId` – envia texto/gif/sticker/image via URL
- POST `/api/messages/:groupId/upload?type=audio|image|file` – upload (máx. `UPLOAD_MAX_MB`; html/svg/js bloqueados)

Reuniões (vídeo)
- GET `/api/meetings` (auth) – lista reuniões onde você é anfitrião ou convidado
- POST `/api/meetings` (auth) – cria reunião instantânea ou agendada
  - body: `{ title, description?, isInstant?, scheduledStart?, scheduledEnd?, participants?: [{ email, name? }] }`
- GET `/api/meetings/:id` (auth) – detalhes + participantes
- POST `/api/meetings/:id/participants` (auth, host) – adiciona convidados por e‑mail
- GET `/api/meetings/invite/:token` (público) – consulta convite (para colaboradores externos)

Observações
- Uploads são servidos via `/uploads/...` do backend.

Backup e restauração
- Pré-requisito: instalar utilitários do PostgreSQL (`pg_dump` e `psql`) e garantir que `DATABASE_URL` e (opcionalmente) `UPLOAD_DIR` estejam configurados.
- Caso as ferramentas não estejam no PATH, defina `PG_DUMP_PATH` e `PSQL_PATH` (ex.: `C:\Program Files\PostgreSQL\15\bin\pg_dump.exe`).
- Criar backup (gera pasta em `./backups` com `db.sql` + uploads): `node scripts/chat-backup.js`
- Restaurar backup (substitui banco e uploads atuais; exige confirmação `RESTAURAR` ou `--force`): `node scripts/chat-restore.js ./backups/chat-backup-AAAA-MM-DDTHH-mm-ss`
