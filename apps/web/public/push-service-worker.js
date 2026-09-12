self.addEventListener('push', (event) => {
  let notification = {};

  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { body: event.data ? event.data.text() : '' };
  }

  const title = notification.title || 'HomeApp';
  const options = {
    badge: '/homeapp-icon.png',
    body: notification.body || '',
    data: notification.data || {},
    icon: notification.icon || '/homeapp-icon.png',
    tag: notification.data?.kind || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.startsWith(self.location.origin));

      if (matchingClient) {
        matchingClient.navigate(targetUrl);
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
