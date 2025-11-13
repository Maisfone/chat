ALTER TABLE "SipAccount"
  ADD COLUMN "reg_registered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reg_status" TEXT,
  ADD COLUMN "reg_updated_at" TIMESTAMP(3);
