// =============================================================================
// Service Worker
// (c) Mathigon
// =============================================================================


self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
