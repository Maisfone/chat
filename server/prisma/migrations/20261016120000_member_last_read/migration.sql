-- "Lido até" por pessoa e conversa: uma linha por membro em vez de uma por mensagem lida
ALTER TABLE "GroupMember" ADD COLUMN "last_read_at" TIMESTAMP(3);

-- Preenche a partir das leituras e das mensagens próprias já existentes
UPDATE "GroupMember" gm
SET "last_read_at" = sub.last_at
FROM (
  SELECT x.group_id, x.user_id, MAX(x.created_at) AS last_at
  FROM (
    SELECT m.group_id, r.user_id, m.created_at
    FROM "MessageRead" r
    JOIN "Message" m ON m.id = r.message_id
    UNION ALL
    SELECT m.group_id, m.author_id AS user_id, m.created_at
    FROM "Message" m
  ) x
  GROUP BY x.group_id, x.user_id
) sub
WHERE gm.group_id = sub.group_id AND gm.user_id = sub.user_id;
