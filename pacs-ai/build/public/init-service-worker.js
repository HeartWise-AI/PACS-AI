const retiredCacheNames = /^(workbox-|static-resources$|google-fonts-)/;

async function retireServiceWorkers() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => retiredCacheNames.test(cacheName))
        .map(cacheName => caches.delete(cacheName))
    );
  }
}

retireServiceWorkers().catch(error => {
  console.warn('Unable to fully retire the previous service worker installation.', error);
});
