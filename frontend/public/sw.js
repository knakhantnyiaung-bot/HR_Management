// NOTIF-08..13 — minimal service worker: shows a browser notification for
// any push event, and focuses/opens the app on click. The backend's
// PushProvider is a console-log stub in Sprint 3 Wave 1 (see
// backend/src/common/notifications/pushProvider.ts), so no real push
// message ever reaches this listener yet — this is the receiving half of
// the plumbing, ready for when a real provider is wired in.
self.addEventListener("push", (event) => {
  let title = "Notification";
  let body = "You have a new notification.";

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title ?? title;
      body = payload.body ?? body;
    } catch {
      body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, { body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
