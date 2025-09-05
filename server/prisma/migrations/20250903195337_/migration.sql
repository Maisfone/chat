-- DropForeignKey
ALTER TABLE "MeetingParticipant" DROP CONSTRAINT "MeetingParticipant_meeting_id_fkey";

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_meeting_participant_meeting" RENAME TO "MeetingParticipant_meeting_id_idx";

-- RenameIndex
ALTER INDEX "idx_meeting_participant_user" RENAME TO "MeetingParticipant_user_id_idx";
