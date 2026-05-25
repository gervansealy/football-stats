let playlist = [];
let currentIndex = -1;
let endMessageListener = null;
let driveEndedListener = null;

const IFRAME_TEMPLATE = `
    <span class="close video-close" onclick="closeVideoModal()">&times;</span>
    <div class="video-modal-toolbar">
        <div class="video-modal-meta">
            <span class="video-modal-title"></span>
            <span class="video-modal-counter"></span>
        </div>
        <div class="video-modal-nav">
            <button type="button" class="video-nav-btn" id="videoPrevBtn">Previous</button>
            <button type="button" class="video-nav-btn" id="videoNextBtn">Next</button>
        </div>
        <div class="video-modal-toolbar-spacer" aria-hidden="true"></div>
    </div>
    <iframe id="videoModalIframe" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
`;

function normalizeEmbedUrl(url) {
    try {
        const parsed = new URL(url);
        parsed.searchParams.set('autoplay', '1');

        if (parsed.hostname.includes('youtube.com')) {
            parsed.searchParams.set('enablejsapi', '1');
            parsed.searchParams.set('rel', '0');
        }

        return parsed.toString();
    } catch {
        return url;
    }
}

function clearEndDetection() {
    if (endMessageListener) {
        window.removeEventListener('message', endMessageListener);
        endMessageListener = null;
    }
    if (driveEndedListener) {
        driveEndedListener.remove();
        driveEndedListener = null;
    }
}

function highlightActiveVideo(index) {
    document.querySelectorAll('#statDetailContent .video-file-box').forEach((box, i) => {
        box.classList.toggle('video-file-box-active', i === index);
        if (i === index) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

function updateToolbar() {
    const item = playlist[currentIndex];
    const titleEl = document.querySelector('.video-modal-title');
    const counterEl = document.querySelector('.video-modal-counter');
    const prevBtn = document.getElementById('videoPrevBtn');
    const nextBtn = document.getElementById('videoNextBtn');

    if (titleEl) titleEl.textContent = item?.name || '';
    if (counterEl) counterEl.textContent = playlist.length > 1 ? `${currentIndex + 1} of ${playlist.length}` : '';
    if (prevBtn) prevBtn.disabled = playlist.length <= 1;
    if (nextBtn) nextBtn.disabled = playlist.length <= 1;
}

function playNextHighlight() {
    if (playlist.length <= 1) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    playCurrentHighlight();
}

function playPreviousHighlight() {
    if (playlist.length <= 1) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playCurrentHighlight();
}

function onHighlightEnded() {
    if (playlist.length > 1) playNextHighlight();
}

function setupEmbedEndDetection(iframe) {
    clearEndDetection();

    endMessageListener = (event) => {
        if (event.source !== iframe.contentWindow) return;

        let data;
        try {
            data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }

        if (event.origin === 'https://www.youtube.com') {
            if (data.event === 'onStateChange' && data.info === 0) onHighlightEnded();
            if (data.event === 'infoDelivery' && data.info?.playerState === 0) onHighlightEnded();
        }

        if (event.origin === 'https://player.vimeo.com' && data.event === 'finish') {
            onHighlightEnded();
        }
    };

    window.addEventListener('message', endMessageListener);

    iframe.onload = () => {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
    };
}

function playEmbedHighlight(item) {
    const modal = document.getElementById('videoModal');
    const modalContent = modal?.querySelector('.video-modal-content');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = IFRAME_TEMPLATE;
    bindToolbarButtons();

    const iframe = document.getElementById('videoModalIframe');
    iframe.src = normalizeEmbedUrl(item.embedLink);
    setupEmbedEndDetection(iframe);

    modal.style.display = 'block';
    highlightActiveVideo(currentIndex);
    updateToolbar();
}

function playDriveHighlight(item) {
    const modal = document.getElementById('videoModal');
    const modalContent = modal?.querySelector('.video-modal-content');
    if (!modal || !modalContent) return;

    clearEndDetection();
    modalContent.innerHTML = `
        <span class="close video-close" onclick="closeVideoModal()">&times;</span>
        <div class="video-modal-toolbar">
            <div class="video-modal-meta">
                <span class="video-modal-title"></span>
                <span class="video-modal-counter"></span>
            </div>
            <div class="video-modal-nav">
                <button type="button" class="video-nav-btn" id="videoPrevBtn">Previous</button>
                <button type="button" class="video-nav-btn" id="videoNextBtn">Next</button>
            </div>
            <div class="video-modal-toolbar-spacer" aria-hidden="true"></div>
        </div>
        <video id="driveVideoPlayer" controls autoplay style="width: 100%; height: 675px; background: #000;">
            <source src="${item.driveLink}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;

    bindToolbarButtons();

    const video = document.getElementById('driveVideoPlayer');
    if (video) {
        driveEndedListener = { remove: () => video.removeEventListener('ended', onHighlightEnded) };
        video.addEventListener('ended', onHighlightEnded);
        video.play().catch(() => {});
    }

    modal.style.display = 'block';
    highlightActiveVideo(currentIndex);
    updateToolbar();
}

function bindToolbarButtons() {
    const prevBtn = document.getElementById('videoPrevBtn');
    const nextBtn = document.getElementById('videoNextBtn');
    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            playPreviousHighlight();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            playNextHighlight();
        };
    }
}

function playCurrentHighlight() {
    const item = playlist[currentIndex];
    if (!item) return;

    if (item.driveLink) playDriveHighlight(item);
    else if (item.embedLink) playEmbedHighlight(item);
}

export function openHighlightPlaylist(items, startIndex = 0) {
    playlist = (items || []).filter(item => item?.embedLink || item?.driveLink);
    if (!playlist.length) return;

    currentIndex = Math.max(0, Math.min(startIndex, playlist.length - 1));
    playCurrentHighlight();
}

export function closeVideoModal() {
    clearEndDetection();
    playlist = [];
    currentIndex = -1;

    const modal = document.getElementById('videoModal');
    const modalContent = modal?.querySelector('.video-modal-content');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = IFRAME_TEMPLATE;

    const iframe = document.getElementById('videoModalIframe');
    if (iframe) iframe.src = '';

    modal.style.display = 'none';
}

window.closeVideoModal = closeVideoModal;
