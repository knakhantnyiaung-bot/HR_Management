import { createApp } from "./app";
import { env } from "@config/env";
import { startNotificationDispatcher } from "@modules/notifications/notification.queue";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`HR & Payroll API listening on port ${env.port} [${env.nodeEnv}]`);
});

// Sprint 2 — in-process outbox dispatcher (see notification.queue.ts for
// why this isn't a separate Redis/BullMQ worker process). Not started by
// app.test.ts, which only imports createApp(), not this entry point.
startNotificationDispatcher();
