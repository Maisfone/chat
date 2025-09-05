-- Create table for message favorites
CREATE TABLE IF NOT EXISTS "MessageFavorite" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "fk_messagefavorite_message" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_messagefavorite_user" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "uq_messagefavorite_msg_user" UNIQUE ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_messagefavorite_user" ON "MessageFavorite" ("user_id");
