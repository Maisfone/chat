-- CreateTable Meeting
CREATE TABLE "Meeting" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "host_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "is_instant" BOOLEAN NOT NULL DEFAULT false,
  "scheduled_start" TIMESTAMP(3),
  "scheduled_end" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable MeetingParticipant
CREATE TABLE "MeetingParticipant" (
  "id" TEXT NOT NULL,
  "meeting_id" TEXT NOT NULL REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "email" TEXT,
  "name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'guest',
  "status" TEXT NOT NULL DEFAULT 'invited',
  "invite_token" TEXT UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_meeting_participant_meeting" ON "MeetingParticipant" ("meeting_id");
CREATE INDEX "idx_meeting_participant_user" ON "MeetingParticipant" ("user_id");
