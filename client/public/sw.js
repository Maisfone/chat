/* eslint-disable no-restricted-globals */
const VAPID_PUBLIC_KEY = 'BLX4iWgrhNgMUBR7yYLSu_LLHgE0ZbrFlrY9UBd3hGAfXc6SrOTcsVf2tdI1hJEzcXG3cg8NFIkNmvDXIK8sKm0';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Chat', body: event.data.text() };
  }

  const title = payload.title || 'Chat';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/images/logo.png',
    badge: payload.badge || '/images/logo.png',
    tag: payload.tag,
    renotify: payload.renotify,
    data: {
      url: payload.url || payload.path || '/',
      ...payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname === targetUrl || clientUrl.href === targetUrl) {
              return client.focus();
            }
          } catch {
            if (client.url.includes(targetUrl)) return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
      .catch(() => clients.openWindow(targetUrl))
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of allClients) {
          client.postMessage({ type: 'push:subscription', subscription });
        }
      } catch (err) {
        console.error('Push subscription refresh failed', err);
      }
    })()
  );
});

self.addEventListener('install', () => {
  self.skipWaiting?.();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
