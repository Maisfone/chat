// Consultas de conversas pensadas para muitos usuários:
// cada função faz uma única consulta, independentemente de quantas conversas existam.
import { prisma } from '../prisma.js'

// Mensagens não lidas por conversa: mensagens de outras pessoas depois do "lido até"
// do membro (ou da entrada na conversa, se ainda não leu nada)
export async function unreadCountsFor(userId, groupIds = null) {
  const rows = groupIds
    ? await prisma.$queryRaw`
        SELECT gm.group_id AS "groupId", COUNT(m.id)::int AS "count"
        FROM "GroupMember" gm
        JOIN "Message" m
          ON m.group_id = gm.group_id
         AND m.created_at > COALESCE(gm.last_read_at, gm.joined_at)
         AND m.author_id <> gm.user_id
         AND m.deleted_at IS NULL
        WHERE gm.user_id = ${userId} AND gm.group_id = ANY(${groupIds}::text[])
        GROUP BY gm.group_id`
    : await prisma.$queryRaw`
        SELECT gm.group_id AS "groupId", COUNT(m.id)::int AS "count"
        FROM "GroupMember" gm
        JOIN "Message" m
          ON m.group_id = gm.group_id
         AND m.created_at > COALESCE(gm.last_read_at, gm.joined_at)
         AND m.author_id <> gm.user_id
         AND m.deleted_at IS NULL
        WHERE gm.user_id = ${userId}
        GROUP BY gm.group_id`
  return new Map(rows.map((r) => [r.groupId, r.count]))
}

// Menções não lidas por conversa
export async function unreadMentionCountsFor(userId, groupIds) {
  if (!groupIds.length) return new Map()
  const rows = await prisma.$queryRaw`
    SELECT m.group_id AS "groupId", COUNT(mm.id)::int AS "count"
    FROM "MessageMention" mm
    JOIN "Message" m ON m.id = mm.message_id AND m.deleted_at IS NULL
    JOIN "GroupMember" gm ON gm.group_id = m.group_id AND gm.user_id = mm.user_id
    WHERE mm.user_id = ${userId}
      AND m.group_id = ANY(${groupIds}::text[])
      AND m.created_at > COALESCE(gm.last_read_at, gm.joined_at)
    GROUP BY m.group_id`
  return new Map(rows.map((r) => [r.groupId, r.count]))
}

// Última mensagem de cada conversa (usa o índice group_id + created_at).
// Antes era um include com take: 1, que o Prisma resolve carregando mensagens demais.
export async function lastMessagesFor(groupIds) {
  if (!groupIds.length) return new Map()
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (group_id)
      id, group_id AS "groupId", author_id AS "authorId", type::text AS "type", content, created_at AS "createdAt"
    FROM "Message"
    WHERE group_id = ANY(${groupIds}::text[]) AND deleted_at IS NULL
    ORDER BY group_id, created_at DESC`
  return new Map(rows.map((r) => [r.groupId, r]))
}

// Marca a conversa como lida até agora e devolve as mensagens que acabaram de ser lidas
// (de outras pessoas), para avisar só os autores delas.
export async function markConversationRead(groupId, userId) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { lastReadAt: true, joinedAt: true },
  })
  if (!member) return null
  const now = new Date()
  const since = member.lastReadAt || member.joinedAt
  const newlyRead = await prisma.message.findMany({
    where: { groupId, createdAt: { gt: since, lte: now }, authorId: { not: userId }, deletedAt: null },
    select: { id: true, authorId: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { lastReadAt: now },
  })
  return newlyRead
}

// "Vistos" das mensagens do próprio autor numa página: quantos membros já leram
// e até 10 ids (para o tooltip). Funciona com qualquer quantidade de membros.
export async function readInfoFor(groupId, viewerId, messages) {
  const mine = messages.filter((m) => m.authorId === viewerId)
  if (!mine.length) return new Map()
  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: viewerId } },
    select: { userId: true, lastReadAt: true },
  })
  const readers = members
    .filter((m) => m.lastReadAt)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
  const info = new Map()
  for (const msg of mine) {
    const created = new Date(msg.createdAt).getTime()
    const ids = []
    let count = 0
    for (const r of readers) {
      if (r.lastReadAt.getTime() < created) break
      count += 1
      if (ids.length < 10) ids.push(r.userId)
    }
    info.set(msg.id, { readCount: count, readerIds: ids })
  }
  return info
}
