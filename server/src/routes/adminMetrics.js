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
      totalMessages,
      totalGroupMembers,
      messagesLast10Minutes,
      messagesLastHour,
      messagesLast24Hours,
      groupsActiveLastHour,
      groupsActiveLast24Hours,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.group.count(),
      prisma.message.count(),
      prisma.groupMember.count(),
      prisma.message.count({ where: { createdAt: { gte: last10Minutes } } }),
      prisma.message.count({ where: { createdAt: { gte: lastHour } } }),
      prisma.message.count({ where: { createdAt: { gte: last24Hours } } }),
      prisma.group.count({ where: { lastMessageAt: { gte: lastHour } } }),
      prisma.group.count({ where: { lastMessageAt: { gte: last24Hours } } }),
    ])
    const [
      activeUsersLast24Hours,
      lastMessage,
      recentMessages,
      busiestGroupsRaw,
    ] = await Promise.all([
      prisma.user.count({
        where: { messages: { some: { createdAt: { gte: last24Hours } } } },
      }),
      prisma.message.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: last10Minutes } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: last24Hours } },
        _count: { groupId: true },
        orderBy: { _count: { groupId: 'desc' } },
        take: 3,
      }),
    ])
    const busiestGroupIds = busiestGroupsRaw.map((item) => item.groupId)
    const busiestGroupNames = busiestGroupIds.length
      ? await prisma.group.findMany({
        where: { id: { in: busiestGroupIds } },
        select: { id: true, name: true },
      })
      : []
    const groupNameMap = new Map(busiestGroupNames.map((group) => [group.id, group.name]))
    const busiestGroups = busiestGroupsRaw.map((item) => ({
      groupId: item.groupId,
      name: groupNameMap.get(item.groupId) || 'â€”',
      messages: item._count.groupId,
    }))
    const timeline = buildMinuteTimeline(recentMessages, now, 10)
    const onlineUsers = getOnlineUserCount()
    const onlineSessions = getOnlineSessionCount()
    res.json({
      totalUsers,
      totalGroups,
      totalMessages,
      totalGroupMembers,
      messagesLast10Minutes,
      messagesLastHour,
      messagesLast24Hours,
      avgMessagesPerMinuteLastHour: messagesLastHour / 60,
      groupsActiveLastHour,
      groupsActiveLast24Hours,
      activeUsersLast24Hours,
      onlineUsers,
      onlineSessions,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            createdAt: lastMessage.createdAt,
            groupId: lastMessage.groupId,
            groupName: lastMessage.group?.name || '',
            authorId: lastMessage.authorId,
            authorName: lastMessage.author?.name || '',
          }
        : null,
      busiestGroups,
      recentTimeline: timeline,
    })
  } catch (error) {
    console.error("Admin metrics error:", error)
    res.status(500).json({ error: "Falha ao coletar metricas" })
  }
})

export default router

