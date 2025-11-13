import { api } from './api.js';

const PUBLIC_VAPID_KEY = 'BLX4iWgrhNgMUBR7yYLSu_LLHgE0ZbrFlrY9UBd3hGAfXc6SrOTcsVf2tdI1hJEzcXG3cg8NFIkNmvDXIK8sKm0';
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
  return PUBLIC_VAPID_KEY;
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
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const publicKey = await fetchPublicKey();
    const key = urlBase64ToUint8Array(publicKey);
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
