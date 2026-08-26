const CACHE = 'sweat-squad-v2';

const SHELL = [
    './',
    './index.html',
    './lineup.html',
    './team-selection.html',
    './standings.html',
    './game-history.html',
    './player-profiles.html',
    './input-stats.html',
    './settings.html',
    './recycle-bin.html',
    './styles.css',
    './manifest.json',
    './js/pwa.js',
    './js/firebase-config.js',
    './js/auth.js',
    './js/lineup.js',
    './js/team-selection.js',
    './js/standings.js',
    './js/game-history.js',
    './js/player-profiles.js',
    './js/input-stats.js',
    './js/settings.js',
    './js/recycle-bin.js',
    './js/career-overview.js',
    './js/highlight-video-player.js',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/apple-touch-icon.png',
];

function isLiveData(url) {
    const host = url.hostname;
    return (
        host.includes('googleapis.com') ||
        host.includes('firebaseio.com') ||
        host.includes('firebasestorage.app') ||
        host.includes('cloudfunctions.net') ||
        host.includes('googleusercontent.com')
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(
            SHELL.map((url) => cache.add(url).catch(() => undefined))
        );
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (isLiveData(url)) return;

    event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type !== 'opaque') {
            const copy = fresh.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return fresh;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
            const url = new URL(request.url);
            const pageName = url.pathname.split('/').pop();
            return (
                (pageName && (await caches.match('./' + pageName))) ||
                (await caches.match('./lineup.html')) ||
                (await caches.match('./index.html')) ||
                Response.error()
            );
        }

        throw err;
    }
}
