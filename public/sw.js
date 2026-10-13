/* SaveLink service worker — minimal & aman:
 * - Navigasi halaman: network-first; saat offline tampilkan halaman offline (inline, tanpa aset luar).
 * - API dan aset lain TIDAK di-cache (download harus selalu dari server).
 */
const VERSION = "savelink-sw-v1";

const OFFLINE_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · SaveLink</title><meta name="theme-color" content="#141110"><style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#141110;color:#FAFAF9;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px}
.logo{width:56px;height:56px;border-radius:16px;background:#F97316;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
h1{font-size:24px;margin:0 0 8px}p{color:#A8A29E;margin:0 0 6px;max-width:420px}
a{display:inline-flex;margin-top:24px;height:48px;align-items:center;padding:0 24px;border-radius:12px;background:#F97316;color:#1C1917;font-weight:600;text-decoration:none}
</style></head><body><main><div class="logo"><svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7.5v11.25m0 0-4.6-4.6M16 18.75l4.6-4.6" fill="none" stroke="#1C1917" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.75 23.75h12.5" fill="none" stroke="#1C1917" stroke-width="2.6" stroke-linecap="round"/></svg></div>
<h1>Kamu sedang offline</h1><p>SaveLink butuh internet untuk mengambil video. Periksa koneksi lalu coba lagi.</p><p lang="en">You're offline. SaveLink needs the internet to fetch videos.</p><a href="/">Coba lagi</a></main></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  // Unduhan file (/api/jobs/:id/file) juga berupa navigasi → biarkan langsung ke jaringan,
  // jangan dilewatkan service worker (file bisa sampai 2 GB).
  if (new URL(request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        }),
    ),
  );
});
