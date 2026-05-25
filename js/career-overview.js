export const STAT_CATEGORIES = [
    {
        id: 'wins',
        label: 'Wins',
        icon: '🏆',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.win || 0) > 0,
        detail: (g, playerId) => {
            const v = g.playerStats[playerId].win;
            return `${v} win${v > 1 ? 's' : ''}`;
        }
    },
    {
        id: 'draws',
        label: 'Draws',
        icon: '🤝',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.draw || 0) > 0,
        detail: (g, playerId) => {
            const v = g.playerStats[playerId].draw;
            return `${v} draw${v > 1 ? 's' : ''}`;
        }
    },
    {
        id: 'goals',
        label: 'Goals',
        icon: '⚽',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.goals || 0) > 0,
        getCount: (matching, playerId) =>
            matching.reduce((sum, g) => sum + (g.playerStats?.[playerId]?.goals || 0), 0),
        detail: (g, playerId) => {
            const v = g.playerStats[playerId].goals;
            return `${v} goal${v > 1 ? 's' : ''}`;
        }
    },
    {
        id: 'games',
        label: 'Games Played',
        icon: '🏟️',
        filter: (g, playerId) => g.playerStats?.[playerId] != null,
        detail: null
    },
    {
        id: 'losses',
        label: 'Losses',
        icon: '🛡️',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.loss || 0) > 0,
        detail: (g, playerId) => {
            const v = g.playerStats[playerId].loss;
            return `${v} loss${v > 1 ? 'es' : ''}`;
        }
    },
    {
        id: 'captainWins',
        label: 'Captain Wins',
        icon: '👑',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.captainWin || 0) > 0,
        detail: () => 'Captain Win'
    },
    {
        id: 'captainDraws',
        label: 'Captain Draws',
        icon: '🤝',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.captainDraw || 0) > 0,
        detail: () => 'Captain Draw'
    },
    {
        id: 'captainLosses',
        label: 'Captain Losses',
        icon: '🛡️',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.captainLoss || 0) > 0,
        detail: () => 'Captain Loss'
    }
];

function getGameDate(game) {
    return new Date(game.date + 'T12:00:00');
}

function getGameYear(game) {
    return game.year || getGameDate(game).getFullYear();
}

export function filterGamesByPeriod(games, period) {
    if (!period || period === 'all') return games;

    if (period.startsWith('year:')) {
        const year = parseInt(period.slice(5), 10);
        return games.filter(g => getGameYear(g) === year);
    }

    if (period.startsWith('month:')) {
        const [year, month] = period.slice(6).split('-').map(Number);
        return games.filter(g => {
            const d = getGameDate(g);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
        });
    }

    return games;
}

function getCategoryMatching(category, playerId, games) {
    return games
        .filter(g => category.filter(g, playerId))
        .sort((a, b) => b.date.localeCompare(a.date));
}

function getCategoryCount(category, playerId, games) {
    const matching = getCategoryMatching(category, playerId, games);
    if (category.getCount) return category.getCount(matching, playerId);
    return matching.length;
}

function buildPeriodOptions(games) {
    const years = new Set();
    const monthKeys = new Set();

    games.forEach(game => {
        const d = getGameDate(game);
        years.add(getGameYear(game));
        monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });

    const sortedYears = [...years].sort((a, b) => b - a);
    const sortedMonths = [...monthKeys].sort((a, b) => b.localeCompare(a));

    let options = '<option value="all">All Years</option>';
    options += '<optgroup label="Years">';
    sortedYears.forEach(year => {
        options += `<option value="year:${year}">${year}</option>`;
    });
    options += '</optgroup>';
    options += '<optgroup label="Months">';
    sortedMonths.forEach(key => {
        const [year, month] = key.split('-');
        const label = getGameDate(`${year}-${month}-01`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        options += `<option value="month:${key}">${label}</option>`;
    });
    options += '</optgroup>';

    return options;
}

function buildStatCardsHTML(playerId, games, videoCount) {
    const cards = STAT_CATEGORIES.map(cat => {
        const count = getCategoryCount(cat, playerId, games);
        const zeroClass = count === 0 ? ' zero' : '';
        return `
            <button type="button" class="career-stat-card${zeroClass}" data-stat-id="${cat.id}">
                <span class="career-stat-icon">${cat.icon}</span>
                <span class="career-stat-label">${cat.label}</span>
                <span class="career-stat-value">${count}</span>
            </button>`;
    }).join('');

    const videoCard = videoCount > 0 ? `
        <button type="button" class="career-stat-card career-stat-card-videos" data-stat-id="videos">
            <span class="career-stat-icon">▶️</span>
            <span class="career-stat-label">Highlight Videos</span>
            <span class="career-stat-value">${videoCount}</span>
        </button>` : '';

    return `<div class="career-stat-grid">${cards}${videoCard}</div>`;
}

export function buildCareerOverviewSection(playerId, allGames, videoCount = 0) {
    const playerGames = getPlayerGames(allGames, playerId);
    const periodOptions = buildPeriodOptions(playerGames);

    return `
        <div class="career-overview-section" data-player-id="${playerId}">
            <div class="career-overview-header">
                <h3 class="career-overview-title">Career Overview</h3>
                <select class="career-period-select" aria-label="Filter career stats by period">
                    ${periodOptions}
                </select>
            </div>
            <div class="career-stat-cards">
                ${buildStatCardsHTML(playerId, playerGames, videoCount)}
            </div>
        </div>`;
}

function buildGameListHTML(category, playerId, games) {
    const matching = getCategoryMatching(category, playerId, games);

    if (matching.length === 0) {
        return '<p class="breakdown-empty">No games</p>';
    }

    return matching.map(game => {
        const d = getGameDate(game);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const detail = category.detail ? ` — ${category.detail(game, playerId)}` : '';
        return `<a href="game-history.html?game=${game.id}" class="breakdown-game-link">${label}${detail}</a>`;
    }).join('');
}

function openStatDetailModal(title, contentHTML) {
    const modal = document.getElementById('statDetailModal');
    const titleEl = document.getElementById('statDetailTitle');
    const contentEl = document.getElementById('statDetailContent');

    if (!modal || !titleEl || !contentEl) return;

    titleEl.textContent = title;
    contentEl.innerHTML = contentHTML;
    modal.style.display = 'block';
}

function closeStatDetailModal() {
    const modal = document.getElementById('statDetailModal');
    if (modal) modal.style.display = 'none';
}

function getPlayerGames(allGames, playerId) {
    return allGames.filter(g => g.playerStats?.[playerId] != null);
}

function updateStatCards(section, playerId, allGames, videoCount) {
    const period = section.querySelector('.career-period-select')?.value || 'all';
    const filteredGames = filterGamesByPeriod(getPlayerGames(allGames, playerId), period);
    const cardsContainer = section.querySelector('.career-stat-cards');
    if (cardsContainer) {
        cardsContainer.innerHTML = buildStatCardsHTML(playerId, filteredGames, videoCount);
        attachStatCardListeners(section, playerId, allGames, videoCount);
    }
}

function attachStatCardListeners(section, playerId, allGames, videoCount) {
    const period = section.querySelector('.career-period-select')?.value || 'all';
    const filteredGames = filterGamesByPeriod(getPlayerGames(allGames, playerId), period);
    const videoItems = section._videoItems || [];
    const onVideoClick = section._onVideoClick;

    section.querySelectorAll('.career-stat-card').forEach(card => {
        card.addEventListener('click', () => {
            const statId = card.dataset.statId;

            if (statId === 'videos') {
                if (!videoItems.length) return;
                const listHTML = videoItems.map(item => `
                    <div class="video-file-box" data-embed-link="${item.embedLink || ''}" data-drive-video="${item.driveLink || ''}">
                        <div class="video-icon">🎬</div>
                        <div class="video-file-name">${item.name}</div>
                        <div class="video-play-icon">▶</div>
                    </div>
                `).join('');
                openStatDetailModal('Highlight Videos', `<div class="video-file-list">${listHTML}</div>`);

                document.querySelectorAll('#statDetailContent .video-file-box').forEach(box => {
                    box.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const driveVideo = box.getAttribute('data-drive-video');
                        const embedLink = box.getAttribute('data-embed-link');
                        if (onVideoClick) onVideoClick({ driveVideo, embedLink });
                    });
                });
                return;
            }

            const category = STAT_CATEGORIES.find(c => c.id === statId);
            if (!category) return;

            openStatDetailModal(category.label, buildGameListHTML(category, playerId, filteredGames));
        });
    });
}

export function initCareerOverview(section, playerId, allGames, videoCount = 0, videoItems = [], onVideoClick) {
    if (!section) return;

    section._videoItems = videoItems;
    section._onVideoClick = onVideoClick;

    const periodSelect = section.querySelector('.career-period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            updateStatCards(section, playerId, allGames, videoCount);
        });
    }

    attachStatCardListeners(section, playerId, allGames, videoCount);

    const statModal = document.getElementById('statDetailModal');
    if (statModal && !statModal.dataset.bound) {
        statModal.dataset.bound = 'true';
        statModal.querySelector('.stat-detail-close')?.addEventListener('click', closeStatDetailModal);
        statModal.addEventListener('click', (e) => {
            if (e.target === statModal) closeStatDetailModal();
        });
    }
}

export function buildPlayerInfoCards({ age, height, weight, points, hobbies }) {
    return `
        <div class="info-card">
            <span class="info-card-icon">📅</span>
            <div class="info-card-content">
                <span class="info-card-label">Age</span>
                <span class="info-card-value">${age}</span>
            </div>
        </div>
        <div class="info-card">
            <span class="info-card-icon">📏</span>
            <div class="info-card-content">
                <span class="info-card-label">Height</span>
                <span class="info-card-value">${height || 'N/A'}</span>
            </div>
        </div>
        <div class="info-card">
            <span class="info-card-icon">⚖️</span>
            <div class="info-card-content">
                <span class="info-card-label">Weight</span>
                <span class="info-card-value">${weight ? weight + ' lbs' : 'N/A'}</span>
            </div>
        </div>
        <div class="info-card">
            <span class="info-card-icon">⭐</span>
            <div class="info-card-content">
                <span class="info-card-label">Total Points</span>
                <span class="info-card-value">${points}</span>
            </div>
        </div>
        ${hobbies ? `
        <div class="info-card info-card-full">
            <span class="info-card-icon">❤️</span>
            <div class="info-card-content">
                <span class="info-card-label">Hobbies</span>
                <span class="info-card-value">${hobbies}</span>
            </div>
        </div>` : ''}`;
}
