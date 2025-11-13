-- CreateTable SipAccount
CREATE TABLE "SipAccount" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "domain" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SipAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SipAccount_user_id_key" UNIQUE ("user_id")
);

CREATE INDEX "SipAccount_domain_idx" ON "SipAccount" ("domain");
CREATE INDEX "SipAccount_extension_idx" ON "SipAccount" ("extension");
