const presence = new Map()

function normalizeStatus(value) {
  const next = typeof value === 'string' ? value : ''
  if (next.trim().length) return next.trim()
  return 'online'
}

function markOnline(userId, status = 'online') {
  if (!userId) return { firstSession: false, status: normalizeStatus(status) }
  const current = presence.get(userId) || { count: 0, status: 'offline' }
  const nextStatus = normalizeStatus(status || current.status)
  const nextCount = (current.count || 0) + 1
  presence.set(userId, { count: nextCount, status: nextStatus })
  return { firstSession: (current.count || 0) === 0, status: nextStatus, count: nextCount }
}

function markOffline(userId) {
  if (!userId) return { wentOffline: false, status: 'offline' }
  const current = presence.get(userId) || { count: 0, status: 'offline' }
  const nextCount = Math.max(0, (current.count || 1) - 1)
  if (nextCount === 0) {
    presence.set(userId, { count: 0, status: 'offline' })
    return { wentOffline: (current.count || 0) > 0, status: 'offline', count: 0 }
  }
  presence.set(userId, { count: nextCount, status: current.status || 'online' })
  return { wentOffline: false, status: current.status || 'online', count: nextCount }
}

function updateStatus(userId, status = 'online') {
  if (!userId) return { status: normalizeStatus(status), count: 0 }
  const current = presence.get(userId) || { count: 0, status: 'offline' }
  const nextStatus = normalizeStatus(status || current.status)
  presence.set(userId, { count: current.count || 0, status: nextStatus })
  return { status: nextStatus, count: current.count || 0 }
}

function getPresenceSnapshot() {
  const list = []
  presence.forEach((value, key) => {
    if ((value?.count || 0) > 0) {
      list.push({ userId: key, status: value?.status || 'online' })
    }
  })
  return list
}

function getOnlineUserCount() {
  let total = 0
  presence.forEach((value) => {
    if ((value?.count || 0) > 0) total += 1
  })
  return total
}

function getOnlineSessionCount() {
  let total = 0
  presence.forEach((value) => {
    total += value?.count || 0
  })
  return total
}

export {
  markOnline,
  markOffline,
  updateStatus,
  getPresenceSnapshot,
  getOnlineUserCount,
  getOnlineSessionCount,
}
