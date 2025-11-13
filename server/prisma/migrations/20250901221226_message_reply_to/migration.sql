-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "reply_to_id" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
