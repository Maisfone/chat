// Agrupa os avisos de "visto" por autor e envia um único pacote a cada 1,5 s.
// Num grupo grande, cada leitura avisava cada autor separadamente (leitores x autores eventos).
const FLUSH_MS = 1500
const pending = new Map() // authorId -> Map(groupId -> Map(readerId -> Set(messageIds)))
let ioRef = null
let timer = null

function flush() {
  timer = null
  if (!ioRef) return
  for (const [authorId, groups] of pending) {
    const reads = []
    for (const [groupId, readers] of groups) {
      for (const [userId, ids] of readers) reads.push({ groupId, userId, ids: Array.from(ids) })
    }
    if (reads.length) ioRef.to(`user:${authorId}`).emit('messages:read:batch', { reads })
  }
  pending.clear()
}

export function queueReadNotifications(io, groupId, readerId, newlyRead) {
  ioRef = io
  for (const m of newlyRead) {
    if (!pending.has(m.authorId)) pending.set(m.authorId, new Map())
    const groups = pending.get(m.authorId)
    if (!groups.has(groupId)) groups.set(groupId, new Map())
    const readers = groups.get(groupId)
    if (!readers.has(readerId)) readers.set(readerId, new Set())
    readers.get(readerId).add(m.id)
  }
  if (!timer && pending.size) timer = setTimeout(flush, FLUSH_MS)
}
