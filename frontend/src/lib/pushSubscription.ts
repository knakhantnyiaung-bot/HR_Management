import { getPushPublicKey, registerPushSubscription, removePushSubscription } from "@/features/notifications/api";

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

// applicationServerKey must be a Uint8Array, not the base64url string the
// backend hands back.
function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

// NOTIF-08..13 — registers the service worker (idempotent — a second
// register() with the same script URL is a no-op), requests permission,
// subscribes via the Push API, and hands the subscription to the backend.
export async function enablePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const publicKey = await getPushPublicKey();
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await registerPushSubscription(subscription.toJSON() as PushSubscriptionJSON);
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  await removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
