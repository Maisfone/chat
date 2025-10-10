-- Create table for message favorites
-- Ajuste de tipos: use TEXT para manter compatibilidade com colunas existentes (TEXT)
-- e deixe a geração de UUID a cargo do Prisma (default(uuid()) no schema),
-- evitando dependência de extensões como pgcrypto.
CREATE TABLE IF NOT EXISTS "MessageFavorite" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageFavorite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_messagefavorite_message" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_messagefavorite_user" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "uq_messagefavorite_msg_user" UNIQUE ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_messagefavorite_user" ON "MessageFavorite" ("user_id");
