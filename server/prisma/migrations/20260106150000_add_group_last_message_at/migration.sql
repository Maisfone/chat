-- Campo para ordenar conversas por última mensagem
ALTER TABLE "Group"
  ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Backfill para dados existentes: usa a última mensagem ou a data de criação do grupo
UPDATE "Group" g
SET "last_message_at" = COALESCE(
  (SELECT MAX(m."created_at") FROM "Message" m WHERE m."group_id" = g."id"),
  g."created_at"
);

-- Índice para ORDER BY
CREATE INDEX IF NOT EXISTS "Group_last_message_at_idx" ON "Group"("last_message_at");
