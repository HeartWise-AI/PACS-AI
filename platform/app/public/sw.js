const retiredCacheNames = /^(workbox-|static-resources$|google-fonts-)/;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => retiredCacheNames.test(cacheName))
          .map(cacheName => caches.delete(cacheName))
      );
      await self.registration.unregister();
    })()
  );
});
