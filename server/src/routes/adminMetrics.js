import express from 'express'
import { adminRequired, authRequired } from '../middleware/auth.js'
import { prisma } from '../prisma.js'
import { getOnlineUserCount, getOnlineSessionCount } from '../lib/presence.js'

const router = express.Router()
router.use(authRequired)
router.use(adminRequired)

function buildMinuteTimeline(messages, now = new Date(), bucketCount = 10) {
  const buckets = []
  const bucketLength = 60 * 1000
  const anchor = new Date(now.getTime())
  anchor.setSeconds(0, 0)
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const value = new Date(anchor.getTime() - i * bucketLength)
    buckets.push({
      timestamp: value.getTime(),
      label: value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      count: 0,
    })
  }
  const lookup = new Map(buckets.map((b) => [b.timestamp, b]))
  messages.forEach((message) => {
    const createdAt = message?.createdAt ? new Date(message.createdAt) : null
    if (!createdAt) return
    createdAt.setSeconds(0, 0)
    const key = createdAt.getTime()
    const target = lookup.get(key)
    if (target) target.count += 1
  })
  return buckets
}

router.get('/', async (req, res) => {
  try {
    const now = new Date()
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
    const last10Minutes = new Date(now.getTime() - 10 * 60 * 1000)
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const [
      totalUsers,
      totalGroups,
      totalDirectChats,
      totalMessages,
      totalGroupMembers,
      messagesLast10Minutes,
      messagesLastHour,
      messagesLast24Hours,
    ] = await prisma.$transaction([
      prisma.user.count(),
      // DMs também são "Group" no banco; aqui contam só os grupos de verdade
      prisma.group.count({ where: { directThread: { is: null } } }),
      prisma.directThread.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.groupMember.count({ where: { group: { directThread: { is: null } } } }),
      prisma.message.count({ where: { createdAt: { gte: last10Minutes } } }),
      prisma.message.count({ where: { createdAt: { gte: lastHour } } }),
      prisma.message.count({ where: { createdAt: { gte: last24Hours } } }),
    ])
    const [
      activeUsersLast24Hours,
      lastMessage,
      recentMessages,
      activeLastHourRaw,
      activeLast24HoursRaw,
    ] = await Promise.all([
      prisma.user.count({
        where: { messages: { some: { createdAt: { gte: last24Hours } } } },
      }),
      prisma.message.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: last10Minutes } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Conversas ativas = com mensagens no período (lastMessageAt também muda ao criar o grupo)
      prisma.message.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: lastHour } },
        _count: { groupId: true },
      }),
      prisma.message.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: last24Hours } },
        _count: { groupId: true },
        orderBy: { _count: { groupId: 'desc' } },
      }),
    ])
    const busiestRaw = activeLast24HoursRaw.slice(0, 5)
    const nameIds = Array.from(new Set([...busiestRaw.map((item) => item.groupId), lastMessage?.groupId].filter(Boolean)))
    const nameRows = nameIds.length
      ? await prisma.group.findMany({
        where: { id: { in: nameIds } },
        select: {
          id: true,
          name: true,
          directThread: { select: { userA: { select: { name: true } }, userB: { select: { name: true } } } },
        },
      })
      : []
    // DMs aparecem como "Ana ↔ Bruno" em vez do nome interno "DM"
    const conversationInfo = new Map(nameRows.map((g) => [g.id, {
      name: g.directThread ? `${g.directThread.userA?.name || '?'} ↔ ${g.directThread.userB?.name || '?'}` : g.name,
      isDirect: Boolean(g.directThread),
    }]))
    const busiestGroups = busiestRaw.map((item) => ({
      groupId: item.groupId,
      name: conversationInfo.get(item.groupId)?.name || '—',
      isDirect: conversationInfo.get(item.groupId)?.isDirect || false,
      messages: item._count.groupId,
    }))
    const timeline = buildMinuteTimeline(recentMessages, now, 10)
    const onlineUsers = getOnlineUserCount()
    const onlineSessions = getOnlineSessionCount()
    res.json({
      totalUsers,
      totalGroups,
      totalDirectChats,
      totalMessages,
      totalGroupMembers,
      messagesLast10Minutes,
      messagesLastHour,
      messagesLast24Hours,
      avgMessagesPerMinuteLastHour: messagesLastHour / 60,
      groupsActiveLastHour: activeLastHourRaw.length,
      groupsActiveLast24Hours: activeLast24HoursRaw.length,
      activeUsersLast24Hours,
      onlineUsers,
      onlineSessions,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            createdAt: lastMessage.createdAt,
            groupId: lastMessage.groupId,
            groupName: conversationInfo.get(lastMessage.groupId)?.name || '',
            authorId: lastMessage.authorId,
            authorName: lastMessage.author?.name || '',
          }
        : null,
      busiestGroups,
      recentTimeline: timeline,
    })
  } catch (error) {
    console.error("Admin metrics error:", error)
    res.status(500).json({ error: "Falha ao coletar métricas" })
  }
})

export default router

