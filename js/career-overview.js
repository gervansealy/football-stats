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
        id: 'ownGoals',
        label: 'Own Goals',
        icon: '🙈',
        filter: (g, playerId) => (g.playerStats?.[playerId]?.ownGoals || 0) > 0,
        getCount: (matching, playerId) =>
            matching.reduce((sum, g) => sum + (g.playerStats?.[playerId]?.ownGoals || 0), 0),
        detail: (g, playerId) => {
            const v = g.playerStats[playerId].ownGoals;
            return `${v} own goal${v > 1 ? 's' : ''}`;
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

function getMonthsForYear(games, year) {
    const months = new Set();
    games.forEach(game => {
        if (getGameYear(game) === year) {
            months.add(getGameDate(game).getMonth() + 1);
        }
    });
    return [...months].sort((a, b) => b - a);
}

function formatMonthName(month) {
    return new Date(2000, Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

function buildYearOptions(games) {
    const years = new Set();
    games.forEach(game => years.add(getGameYear(game)));

    let options = '<option value="all">All Years</option>';
    [...years].sort((a, b) => b - a).forEach(year => {
        options += `<option value="${year}">${year}</option>`;
    });
    return options;
}

function buildMonthOptions(games, year) {
    if (!year || year === 'all') return '';

    let options = '<option value="all">All Months</option>';
    getMonthsForYear(games, Number(year)).forEach(month => {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        options += `<option value="${key}">${formatMonthName(month)}</option>`;
    });
    return options;
}

function getCurrentPeriod(section) {
    const year = section.querySelector('.career-year-select')?.value || 'all';
    const month = section.querySelector('.career-month-select')?.value || 'all';

    if (year === 'all') return 'all';
    if (month === 'all') return `year:${year}`;
    return `month:${month}`;
}

function syncMonthSelect(section, playerGames, selectedMonth = 'all') {
    const yearSelect = section.querySelector('.career-year-select');
    const monthSelect = section.querySelector('.career-month-select');
    if (!yearSelect || !monthSelect) return;

    const year = yearSelect.value;
    if (year === 'all') {
        monthSelect.innerHTML = '';
        monthSelect.disabled = true;
        monthSelect.hidden = true;
        return;
    }

    monthSelect.hidden = false;
    monthSelect.disabled = false;
    monthSelect.innerHTML = buildMonthOptions(playerGames, year);
    monthSelect.value = [...monthSelect.options].some(opt => opt.value === selectedMonth)
        ? selectedMonth
        : 'all';
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
    const yearOptions = buildYearOptions(playerGames);

    return `
        <div class="career-overview-section" data-player-id="${playerId}">
            <div class="career-overview-header">
                <h3 class="career-overview-title">Career Overview</h3>
                <div class="career-period-filters">
                    <select class="career-year-select" aria-label="Filter career stats by year">
                        ${yearOptions}
                    </select>
                    <select class="career-month-select" aria-label="Filter career stats by month" disabled hidden>
                    </select>
                </div>
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
    const period = getCurrentPeriod(section);
    const filteredGames = filterGamesByPeriod(getPlayerGames(allGames, playerId), period);
    const cardsContainer = section.querySelector('.career-stat-cards');
    if (cardsContainer) {
        cardsContainer.innerHTML = buildStatCardsHTML(playerId, filteredGames, videoCount);
        attachStatCardListeners(section, playerId, allGames, videoCount);
    }
}

function attachStatCardListeners(section, playerId, allGames, videoCount) {
    const period = getCurrentPeriod(section);
    const filteredGames = filterGamesByPeriod(getPlayerGames(allGames, playerId), period);
    const videoItems = section._videoItems || [];
    const onVideoClick = section._onVideoClick;

    section.querySelectorAll('.career-stat-card').forEach(card => {
        card.addEventListener('click', () => {
            const statId = card.dataset.statId;

            if (statId === 'videos') {
                if (!videoItems.length) return;
                const listHTML = videoItems.map((item, index) => `
                    <div class="video-file-box" data-video-index="${index}" data-embed-link="${item.embedLink || ''}" data-drive-video="${item.driveLink || ''}">
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
                        const index = parseInt(box.dataset.videoIndex, 10);
                        if (onVideoClick) onVideoClick(videoItems, index);
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
    section._playerGames = getPlayerGames(allGames, playerId);

    const yearSelect = section.querySelector('.career-year-select');
    const monthSelect = section.querySelector('.career-month-select');

    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            syncMonthSelect(section, section._playerGames);
            updateStatCards(section, playerId, allGames, videoCount);
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
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
