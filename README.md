Chat Farmacon - Fullstack (Node/Express + React + PostgreSQL)

Passos rápidos

1) Banco de Dados
- Opção Docker: `docker compose up -d` (Postgres em localhost:5432 user: postgres / pass: postgres)
- Ou Postgres local: crie DB `chat_farmacon` e ajuste `server/.env`.

2) Backend
- Copie `server/.env.example` para `server/.env` e ajuste `DATABASE_URL` e `JWT_SECRET`.
- Dentro de `server/`: `npm i`, `npx prisma generate`, `npx prisma migrate dev`.
- Rodar: `npm run dev` (porta 3001).

3) Frontend
- Dentro de `client/`: `npm i` e `npm run dev` (porta 5173).
- Opcional: criar `.env` com `VITE_API_URL=http://localhost:3001/api` e `VITE_SOCKET_URL=http://localhost:3001`.

Endpoints chave
- POST `/api/auth/register` (name, email, password)
- POST `/api/auth/login` (email, password)
- GET `/api/groups` (autenticado) – lista grupos do usuário
- POST `/api/groups` (admin) – cria grupo
- POST `/api/groups/:groupId/members` (admin) – adiciona membro
- GET `/api/messages/:groupId` – lista mensagens
- POST `/api/messages/:groupId` – envia texto/gif/sticker/image via URL
- POST `/api/messages/:groupId/upload?type=audio|image` – upload de arquivo

Reuniões (vídeo)
- GET `/api/meetings` (auth) – lista reuniões onde você é anfitrião ou convidado
- POST `/api/meetings` (auth) – cria reunião instantânea ou agendada
  - body: `{ title, description?, isInstant?, scheduledStart?, scheduledEnd?, participants?: [{ email, name? }] }`
- GET `/api/meetings/:id` (auth) – detalhes + participantes
- POST `/api/meetings/:id/participants` (auth, host) – adiciona convidados por e‑mail
- GET `/api/meetings/invite/:token` (público) – consulta convite (para colaboradores externos)

Observações
- Uploads são servidos via `/uploads/...` do backend.
- UI inicial é simples; podemos evoluir com gravação de áudio no browser, busca, presença online e notificações.
