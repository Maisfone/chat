-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "forwarded_from_id" TEXT;

-- AddForeignKey
ALTER TABLE "Message"
ADD CONSTRAINT "Message_forwarded_from_id_fkey"
FOREIGN KEY ("forwarded_from_id") REFERENCES "Message"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
