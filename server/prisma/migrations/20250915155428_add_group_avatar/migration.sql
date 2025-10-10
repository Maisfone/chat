-- Add avatar_url to Group
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

