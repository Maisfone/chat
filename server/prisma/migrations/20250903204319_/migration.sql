-- DropForeignKey
ALTER TABLE "SipAccount" DROP CONSTRAINT "SipAccount_user_id_fkey";

-- AddForeignKey
ALTER TABLE "SipAccount" ADD CONSTRAINT "SipAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
