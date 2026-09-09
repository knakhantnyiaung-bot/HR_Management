export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// NOTIF-08..13 — same seam as SmsProvider/StorageAdapter. Sprint 3 Wave 1
// ships a console-log stub; a real implementation (e.g. the `web-push` npm
// package, signing with VAPID_PRIVATE_KEY) can replace this later without
// touching notification.queue.ts's dispatch logic. The stub is also why
// VAPID_PRIVATE_KEY isn't read anywhere yet — only the public key is
// needed for the browser's PushManager.subscribe() call
// (notifications.controller.ts's push-vapid-key handler).
export interface PushProvider {
  send(subscription: PushSubscriptionRecord, title: string, body: string): Promise<void>;
}

class ConsolePushProvider implements PushProvider {
  async send(subscription: PushSubscriptionRecord, title: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[push stub] to ${subscription.endpoint}: ${title} — ${body}`);
  }
}

export const pushProvider: PushProvider = new ConsolePushProvider();
