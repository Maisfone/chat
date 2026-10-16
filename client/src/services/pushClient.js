import { api } from './api.js';

const messageListenerFlag = { attached: false };

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchPublicKey() {
  try {
    const { key } = await api.get('/push/vapid-public-key');
    if (key) return key;
  } catch {}
  return null;
}

function sameKey(subscription, keyBytes) {
  try {
    const current = subscription?.options?.applicationServerKey;
    if (!current) return true; // navegador não informa: mantém a assinatura
    const a = new Uint8Array(current);
    if (a.length !== keyBytes.length) return false;
    return a.every((v, i) => v === keyBytes[i]);
  } catch {
    return true;
  }
}

async function postSubscription(subscription) {
  if (!subscription) return null;
  try {
    await api.post('/push/subscribe', { subscription });
  } catch (err) {
    console.error('Falha ao registrar subscription no servidor', err);
  }
  return subscription;
}

function attachMessageListener() {
  if (messageListenerFlag.attached || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event?.data?.type !== 'push:subscription') return;
      try {
        await postSubscription(event.data.subscription);
      } catch {}
    });
    messageListenerFlag.attached = true;
  } catch {}
}

export async function ensurePushSubscription() {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  attachMessageListener();
  const registration = await navigator.serviceWorker.ready;
  const publicKey = await fetchPublicKey();
  if (!publicKey) return null;
  const key = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  // Se o servidor trocou a chave VAPID, a assinatura antiga não recebe mais nada: refaz
  if (subscription && !sameKey(subscription, key)) {
    try { await subscription.unsubscribe(); } catch {}
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
  }
  await postSubscription(subscription);
  return subscription;
}

export async function unsubscribePush() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  try {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
  } catch (err) {
    console.warn('Falha ao notificar servidor sobre unsubscribe', err);
  }
  try {
    const done = await subscription.unsubscribe();
    return done;
  } catch (err) {
    console.warn('Não foi possível cancelar assinatura push', err);
  }
  return false;
}

export async function sendTestPush() {
  try {
    await api.post('/push/test', {});
    return true;
  } catch (err) {
    console.error('Falha ao enviar notificação de teste', err);
    throw err;
  }
}
