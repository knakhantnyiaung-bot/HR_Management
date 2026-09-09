import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@database/prisma";
import { createApp } from "../../app";
import { smsProvider } from "@common/notifications/smsProvider";
import { pushProvider } from "@common/notifications/pushProvider";
import { renderNotification } from "@modules/notifications/notification.templates";
import { processOneEvent } from "@modules/notifications/notification.queue";

const app = createApp();

describe("notifications module (NOTIF-08..13)", () => {
  let organizationId: string;
  let userId: string;
  let token: string;

  function authed(method: "get" | "post" | "patch" | "delete", path: string) {
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const email = `notif.${randomUUID()}@test.local`;
    const user = await prisma.user.create({
      data: { organizationId, email, passwordHash, role: "HR_ADMIN" },
    });
    userId = user.id;

    const login = await request(app).post("/api/v1/auth/login").send({ email, password: "Password123!" });
    token = login.body.data.token;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { organizationId } });
    await prisma.notificationEvent.deleteMany({ where: { organizationId } });
    await prisma.pushSubscription.deleteMany({ where: { userId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("returns the configured VAPID public key", async () => {
    const res = await authed("get", "/api/v1/notifications/push-public-key");
    expect(res.status).toBe(200);
    expect(typeof res.body.data.publicKey).toBe("string");
    expect(res.body.data.publicKey.length).toBeGreaterThan(0);
  });

  it("registers and removes a push subscription", async () => {
    const endpoint = `https://push.example.test/${randomUUID()}`;
    const register = await authed("post", "/api/v1/notifications/push-subscription").send({
      endpoint,
      keys: { p256dh: "test-p256dh", auth: "test-auth" },
    });
    expect(register.status).toBe(201);

    const stored = await prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    expect(stored).not.toBeNull();

    const remove = await authed("delete", "/api/v1/notifications/push-subscription").send({ endpoint });
    expect(remove.status).toBe(200);

    const gone = await prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    expect(gone).toBeNull();
  });

  it("PATCHing one channel does not reset the others (NOTIF-08..13)", async () => {
    // A distinct event type from the dispatch tests below — this test
    // deliberately mutates the (userId, eventType) preference row, which
    // would otherwise leak into and change the outcome of those tests.
    const eventType = "overtime.request.decided";

    const smsOff = await authed("patch", "/api/v1/notification-preferences").send({
      eventType,
      smsEnabled: false,
    });
    expect(smsOff.status).toBe(200);
    expect(smsOff.body.data).toMatchObject({ emailEnabled: true, smsEnabled: false, pushEnabled: true });

    const emailOff = await authed("patch", "/api/v1/notification-preferences").send({
      eventType,
      emailEnabled: false,
    });
    expect(emailOff.status).toBe(200);
    // smsEnabled from the previous PATCH must still be false, not reset to
    // the create-time default — this is the whole point of the partial-
    // update semantics in notifications.service.ts's upsert.
    expect(emailOff.body.data).toMatchObject({
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: true,
    });
  });

  it("dispatches SMS only to a recipient with a phone number and smsEnabled, push only to their subscriptions", async () => {
    const smsSpy = vi.spyOn(smsProvider, "send").mockResolvedValue();
    const pushSpy = vi.spyOn(pushProvider, "send").mockResolvedValue();

    await prisma.user.update({ where: { id: userId }, data: { phoneNumber: "+959123456789" } });
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await prisma.pushSubscription.create({
      data: { userId, endpoint, p256dh: "p256dh", auth: "auth" },
    });

    const event = await prisma.notificationEvent.create({
      data: {
        organizationId,
        eventType: "leave.request.decided",
        payload: {
          recipientUserIds: [userId],
          data: { leaveTypeName: "Annual", startDate: "2026-10-01", endDate: "2026-10-02", status: "APPROVED" },
        },
      },
    });

    await processOneEvent(event);

    const rendered = renderNotification("leave.request.decided", {});
    expect(smsSpy).toHaveBeenCalledWith("+959123456789", rendered.smsBody);
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint }),
      rendered.title,
      rendered.emailBody,
    );

    const processed = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(processed.status).toBe("PROCESSED");
  });

  it("skips SMS with no phone number, skips push with no subscription, and never blocks the event on a provider failure", async () => {
    const smsSpy = vi.spyOn(smsProvider, "send").mockResolvedValue();
    const pushSpy = vi
      .spyOn(pushProvider, "send")
      .mockRejectedValue(new Error("simulated push provider failure"));

    await prisma.user.update({ where: { id: userId }, data: { phoneNumber: null } });
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await prisma.pushSubscription.create({
      data: { userId, endpoint, p256dh: "p256dh", auth: "auth" },
    });

    const event = await prisma.notificationEvent.create({
      data: {
        organizationId,
        eventType: "leave.request.decided",
        payload: {
          recipientUserIds: [userId],
          data: { leaveTypeName: "Annual", startDate: "2026-10-01", endDate: "2026-10-02", status: "APPROVED" },
        },
      },
    });

    await processOneEvent(event);

    expect(smsSpy).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalled();

    // The event still reaches PROCESSED even though push threw — a
    // channel-specific failure must never block in-app delivery or the
    // other channels (see sendChannelSafely in notification.queue.ts).
    const processed = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(processed.status).toBe("PROCESSED");

    const inApp = await prisma.notification.findFirst({
      where: { organizationId, userId, eventType: "leave.request.decided" },
    });
    expect(inApp).not.toBeNull();
  });
});

describe("notification templates (NOTIF-08..13)", () => {
  const EVENT_TYPES = [
    "leave.request.submitted",
    "leave.request.decided",
    "overtime.request.decided",
    "payroll.run.released",
    "expense.claim.decided",
    "expense.claim.reimbursed",
    "recruitment.interview.scheduled",
    "recruitment.offer.responded",
  ];

  it("keeps every smsBody within a single SMS segment (160 chars)", () => {
    for (const eventType of EVENT_TYPES) {
      const rendered = renderNotification(eventType, {});
      expect(rendered.smsBody.length).toBeLessThanOrEqual(160);
    }
  });
});
