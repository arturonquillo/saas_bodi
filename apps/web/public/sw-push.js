/* Minimal service worker for Phase D browser-push subscribe (no payload handling). */
self.addEventListener("push", (event) => {
  let title = "Casa dos Frios";
  let body = "Nova atividade no CRM";
  try {
    const data = event.data ? event.data.json() : null;
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
  } catch {
    /* ignore */
  }
  event.waitUntil(self.registration.showNotification(title, { body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/saas/crm/notificacoes"));
});
