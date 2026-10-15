-- AlterTable
ALTER TABLE "User" ADD COLUMN "password_changed_at" TIMESTAMP(3),
ADD COLUMN "password_reset_token" TEXT,
ADD COLUMN "password_reset_expires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_password_reset_token_key" ON "User"("password_reset_token");
