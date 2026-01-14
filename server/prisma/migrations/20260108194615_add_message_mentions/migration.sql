-- DropForeignKey
ALTER TABLE "MessageFavorite" DROP CONSTRAINT "fk_messagefavorite_message";

-- DropForeignKey
ALTER TABLE "MessageFavorite" DROP CONSTRAINT "fk_messagefavorite_user";

-- CreateTable
CREATE TABLE "MessageMention" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageMention_user_id_idx" ON "MessageMention"("user_id");

-- CreateIndex
CREATE INDEX "MessageMention_message_id_idx" ON "MessageMention"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMention_message_id_user_id_key" ON "MessageMention"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "MessageMention" ADD CONSTRAINT "MessageMention_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageMention" ADD CONSTRAINT "MessageMention_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFavorite" ADD CONSTRAINT "MessageFavorite_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFavorite" ADD CONSTRAINT "MessageFavorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_messagefavorite_user" RENAME TO "MessageFavorite_user_id_idx";

-- RenameIndex
ALTER INDEX "uq_messagefavorite_msg_user" RENAME TO "MessageFavorite_message_id_user_id_key";
