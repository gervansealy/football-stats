(function () {
    'use strict';

    window.__LINEUP_READY__ = window.__LINEUP_READY__ || false;

    function isEmbeddedBrowser() {
        const ua = navigator.userAgent || '';
        if (/WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|Messenger/i.test(ua)) {
            return true;
        }
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        if (!isIOS) return false;
        if (navigator.standalone) return false;
        const hasSafari = /Safari/.test(ua);
        const hasOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
        return /AppleWebKit/.test(ua) && !hasSafari && !hasOtherBrowser;
    }

    function showEmbeddedBanner() {
        if (document.getElementById('iosBrowserBanner')) return;
        if (sessionStorage.getItem('sss-banner-dismissed') === '1') return;

        const bar = document.createElement('div');
        bar.id = 'iosBrowserBanner';
        bar.className = 'ios-browser-banner';
        bar.innerHTML =
            '<p>Opened from WhatsApp or another app? Lineups work best in Safari.</p>' +
            '<div class="ios-browser-banner-actions">' +
            '<button type="button" id="openSafariBtn" class="ios-browser-open">Open in Safari</button>' +
            '<button type="button" id="dismissBannerBtn" class="ios-browser-dismiss" aria-label="Dismiss">&times;</button>' +
            '</div>';
        document.body.appendChild(bar);

        document.getElementById('openSafariBtn').addEventListener('click', function () {
            const url = window.location.href;
            window.location.href = 'x-safari-' + url;
            setTimeout(function () {
                window.location.href = url;
            }, 400);
        });
        document.getElementById('dismissBannerBtn').addEventListener('click', function () {
            sessionStorage.setItem('sss-banner-dismissed', '1');
            bar.remove();
        });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const swUrl = new URL('sw.js', document.baseURI || window.location.href);
        navigator.serviceWorker.register(swUrl.href, { updateViaCache: 'none' }).catch(function () {
            /* Offline or first load — ignore */
        });
    }

    function boot() {
        registerServiceWorker();
        if (isEmbeddedBrowser()) showEmbeddedBanner();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
