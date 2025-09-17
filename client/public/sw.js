/* Basic Service Worker for Web Push */
self.addEventListener('install', (e) => {
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {}
    const title = data.title || 'Chat'
    const options = {
      body: data.body || '',
      tag: data.tag || undefined,
      data: data.data || {},
      icon: data.icon || undefined,
      badge: data.badge || undefined,
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch (e) {
    event.waitUntil(self.registration.showNotification('Chat', { body: 'Nova mensagem' }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    if (allClients && allClients.length) {
      const c = allClients[0]
      c.focus()
      if (data.groupId) c.postMessage({ type: 'open-group', groupId: data.groupId })
      return
    }
    await self.clients.openWindow('/')
  })())
})

