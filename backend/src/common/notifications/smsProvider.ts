// NOTIF-08..13 — same seam as StorageAdapter
// (backend/src/common/storage/storageAdapter.ts): Sprint 3 Wave 1 ships a
// console-log stub (no vendor account needed to build/test/demo); a real
// SMS vendor (Twilio, etc.) implements the same one method later without
// any caller (notification.queue.ts) changing.
export interface SmsProvider {
  send(toPhoneE164: string, body: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(toPhoneE164: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[sms stub] to ${toPhoneE164}: ${body}`);
  }
}

export const smsProvider: SmsProvider = new ConsoleSmsProvider();
