-- CreateTable
CREATE TABLE "DirectThread" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectThread_group_id_key" ON "DirectThread"("group_id");

-- CreateIndex
CREATE INDEX "DirectThread_user_a_id_idx" ON "DirectThread"("user_a_id");

-- CreateIndex
CREATE INDEX "DirectThread_user_b_id_idx" ON "DirectThread"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "DirectThread_user_a_id_user_b_id_key" ON "DirectThread"("user_a_id", "user_b_id");

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
