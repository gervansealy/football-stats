import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentYear = new Date().getFullYear();
let unsubscribe = null;
let cachedGames = null; // Cache all games data
let cachedPlayers = null; // Cache all players data

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    
    const yearSelect = document.getElementById('yearSelect');
    yearSelect.value = currentYear;
    
    yearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        cachedGames = null;
        if (unsubscribe) unsubscribe();
        loadStandings();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('standingsSection').style.display = tab === 'standings' ? '' : 'none';
            document.getElementById('highlightsSection').style.display = tab === 'highlights' ? '' : 'none';
        });
    });

    loadStandings();
});

function showLoadingIndicator() {
    const tbody = document.getElementById('standingsBody');
    tbody.innerHTML = '<tr><td colspan="14" class="loading-message">⏳ Loading standings...</td></tr>';
}

function loadStandings() {
    showLoadingIndicator();
    const playersQuery = query(collection(db, 'players'));
    
    unsubscribe = onSnapshot(playersQuery, async (playersSnapshot) => {
        try {
            if (playersSnapshot.empty) {
                displayStandings([]);
                displayHighlights([]);
                return;
            }

            // Fetch all games ONCE for the current year
            if (!cachedGames) {
                const gamesQuery = query(
                    collection(db, 'games'),
                    where('year', '==', currentYear)
                );
                const gamesSnapshot = await getDocs(gamesQuery);
                cachedGames = gamesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }

            const players = [];
            
            for (const playerDoc of playersSnapshot.docs) {
                const playerData = playerDoc.data();
                const stats = calculatePlayerStatsOptimized(playerDoc.id, cachedGames);
                
                players.push({
                    id: playerDoc.id,
                    name: `${playerData.firstName} ${playerData.lastName}`,
                    firstName: playerData.firstName,
                    lastName: playerData.lastName,
                    headshotLink: playerData.headshotLink || '',
                    ...stats
                });
            }

            players.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.winPercentage - a.winPercentage;
            });

            displayStandings(players);
            displayHighlights(players);
        } catch (error) {
            console.error('Error loading standings:', error);
            alert('Error loading standings. Please refresh the page.');
            displayStandings([]);
        }
    }, (error) => {
        console.error('Error loading players:', error);
        displayStandings([]);
    });
}

let cachedPointValues = null;

// Synchronous version - loads once at app start
function getPointValuesSync() {
    if (!cachedPointValues) {
        cachedPointValues = {
            win: 3,
            draw: 1,
            loss: -1,
            cleanSheet: 3,
            goal: 1,
            captainWin: 5,
            captainDraw: 2.5,
            captainLoss: -2
        };
        
        // Load from database asynchronously, but don't block
        getDoc(doc(db, 'config', 'points'))
            .then(pointsDoc => {
                if (pointsDoc.exists()) {
                    cachedPointValues = pointsDoc.data();
                }
            })
            .catch(err => console.error('Error loading point values:', err));
    }
    return cachedPointValues;
}

async function getPointValues() {
    if (cachedPointValues) return cachedPointValues;
    
    try {
        const pointsDoc = await getDoc(doc(db, 'config', 'points'));
        if (pointsDoc.exists()) {
            cachedPointValues = pointsDoc.data();
        } else {
            cachedPointValues = {
                win: 3,
                draw: 1,
                loss: -1,
                cleanSheet: 3,
                goal: 1,
                captainWin: 5,
                captainDraw: 2.5,
                captainLoss: -2
            };
        }
    } catch (error) {
        console.error('Error loading point values:', error);
        cachedPointValues = {
            win: 3,
            draw: 1,
            loss: -1,
            cleanSheet: 3,
            goal: 1,
            captainWin: 5,
            captainDraw: 2.5,
            captainLoss: -2
        };
    }
    return cachedPointValues;
}

// OPTIMIZED: Calculate player stats from cached games array (no database calls)
function calculatePlayerStatsOptimized(playerId, gamesArray) {
    const stats = {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        cleanSheets: 0,
        goals: 0,
        captainWins: 0,
        captainDraws: 0,
        captainLosses: 0,
        points: 0
    };

    const pointValues = getPointValuesSync();

    gamesArray.forEach((game) => {
        const playerStats = game.playerStats?.[playerId];
        
        if (playerStats) {
            stats.games++;
            stats.wins += playerStats.win || 0;
            stats.draws += playerStats.draw || 0;
            stats.losses += playerStats.loss || 0;
            stats.cleanSheets += playerStats.cleanSheet ? 1 : 0;
            stats.goals += playerStats.goals || 0;
            stats.captainWins += playerStats.captainWin || 0;
            stats.captainDraws += playerStats.captainDraw || 0;
            stats.captainLosses += playerStats.captainLoss || 0;

            stats.points += (playerStats.win || 0) * pointValues.win;
            stats.points += (playerStats.draw || 0) * pointValues.draw;
            stats.points += (playerStats.loss || 0) * pointValues.loss;
            stats.points += playerStats.cleanSheet ? pointValues.cleanSheet : 0;
            stats.points += (playerStats.goals || 0) * pointValues.goal;
            stats.points += (playerStats.captainWin || 0) * pointValues.captainWin;
            stats.points += (playerStats.captainDraw || 0) * pointValues.captainDraw;
            stats.points += (playerStats.captainLoss || 0) * pointValues.captainLoss;
        }
    });

    stats.wlRatio = stats.losses > 0 ? (stats.wins / stats.losses).toFixed(2) : stats.wins.toFixed(2);
    stats.winPercentage = stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : 0;
    stats.points = parseFloat(stats.points.toFixed(1));

    return stats;
}

function displayStandings(players) {
    const tbody = document.getElementById('standingsBody');
    
    if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="no-data">No players added yet</td></tr>';
        return;
    }

    tbody.innerHTML = players.map((player, index) => {
        const headshotUrl = convertToDirectLink(player.headshotLink);
        const avatarHtml = headshotUrl 
            ? `<img src="${headshotUrl}" alt="${player.firstName}" class="player-standings-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="player-standings-avatar-fallback" style="display:none;">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`
            : `<div class="player-standings-avatar-fallback">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`;
        
        return `
        <tr>
            <td>${index + 1}</td>
            <td class="player-name-cell">
                <div class="player-name-container">
                    ${avatarHtml}
                    <strong class="player-name-link" onclick="openPlayerProfileModal('${player.id}')" style="cursor: pointer;">${player.name}</strong>
                </div>
            </td>
            <td>${player.games}</td>
            <td>${player.wins}</td>
            <td>${player.draws}</td>
            <td>${player.losses}</td>
            <td>${player.cleanSheets}</td>
            <td>${player.goals}</td>
            <td>${player.captainWins}</td>
            <td>${player.captainDraws}</td>
            <td>${player.captainLosses}</td>
            <td>${player.wlRatio}</td>
            <td>${player.winPercentage}%</td>
            <td><strong>${player.points}</strong></td>
        </tr>
        `;
    }).join('');
}

function displayHighlights(players) {
    const grid = document.getElementById('highlightsGrid');
    if (!grid) return;

    if (players.length === 0) {
        grid.innerHTML = '<div class="no-data">No data available yet</div>';
        return;
    }

    const topPlayer      = players[0];
    const lastPlayer     = players[players.length - 1];
    const maxGoals       = Math.max(...players.map(p => p.goals));
    const maxWins        = Math.max(...players.map(p => p.wins));
    const maxLosses      = Math.max(...players.map(p => p.losses));
    const maxCaptainWins = Math.max(...players.map(p => p.captainWins));

    const tiedTop         = players.filter(p => p.points === topPlayer.points && p.wins === topPlayer.wins && p.winPercentage === topPlayer.winPercentage);
    const tiedBottom      = players.filter(p => p.points === lastPlayer.points && p.wins === lastPlayer.wins && p.winPercentage === lastPlayer.winPercentage);
    const tiedGoals       = players.filter(p => p.goals       === maxGoals);
    const tiedWins        = players.filter(p => p.wins        === maxWins);
    const tiedLosses      = players.filter(p => p.losses      === maxLosses);
    const tiedCaptainWins = players.filter(p => p.captainWins === maxCaptainWins && maxCaptainWins > 0);

    function buildBars(player, bars) {
        return bars.map(bar => {
            const val = player[bar.key] || 0;
            const max = Math.max(...players.map(p => p[bar.key] || 0)) || 1;
            const pct = Math.round((val / max) * 100);
            return `<div class="hc-bar-row">
                <span class="hc-bar-label">${bar.label}</span>
                <div class="hc-bar-track"><div class="hc-bar-fill" style="width:${pct}%;background:${bar.color}"></div></div>
                <span class="hc-bar-val">${val}</span>
            </div>`;
        }).join('');
    }

    function buildCard(player, badge, statStr, bars, accent) {
        const url = convertToDirectLink(player.headshotLink);
        const avatarHtml = url
            ? `<img src="${url}" alt="${player.firstName}" class="hc-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="hc-avatar-fallback" style="display:none;background:${accent}">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`
            : `<div class="hc-avatar-fallback" style="background:${accent}">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`;
        return `
            <div class="hc-card" style="--hc-accent:${accent}" onclick="openPlayerProfileModal('${player.id}')">
                <div class="hc-card-badge">${badge}</div>
                <div class="hc-player-row">
                    <div class="hc-avatar-wrap">${avatarHtml}</div>
                    <div class="hc-player-info">
                        <div class="hc-name">${player.name}</div>
                        <div class="hc-stat-main">${statStr}</div>
                    </div>
                </div>
                <div class="hc-chart">${buildBars(player, bars)}</div>
            </div>`;
    }

    const B = {
        topPlayer:    [{key:'points',      label:'Points',    color:'#D97706'},{key:'wins',   label:'Wins',     color:'#4A90E2'},{key:'goals',      label:'Goals',    color:'#10B981'}],
        mostGoals:    [{key:'goals',       label:'Goals',     color:'#10B981'},{key:'wins',   label:'Wins',     color:'#4A90E2'},{key:'points',     label:'Points',   color:'#D97706'}],
        mostWins:     [{key:'wins',        label:'Wins',      color:'#4A90E2'},{key:'goals',  label:'Goals',    color:'#10B981'},{key:'cleanSheets',label:'Clean Sh.',color:'#6366F1'}],
        bestCaptain:  [{key:'captainWins', label:'Cap. Wins', color:'#7C3AED'},{key:'wins',   label:'Wins',     color:'#4A90E2'},{key:'goals',      label:'Goals',    color:'#10B981'}],
        mostLosses:   [{key:'losses',      label:'Losses',    color:'#EF4444'},{key:'games',  label:'Games',    color:'#6B7280'},{key:'goals',      label:'Goals',    color:'#10B981'}],
        biggestLoser: [{key:'losses',      label:'Losses',    color:'#EF4444'},{key:'wins',   label:'Wins',     color:'#4A90E2'},{key:'goals',      label:'Goals',    color:'#10B981'}]
    };

    const mvpCards        = tiedTop.map(p => buildCard(p, 'Top Player', `${topPlayer.points} pts`, B.topPlayer, '#D97706')).join('');
    const performerCards  = [
        ...tiedCaptainWins.map(p => buildCard(p, 'Best Captain', `${maxCaptainWins} captain win${maxCaptainWins !== 1 ? 's' : ''}`, B.bestCaptain, '#7C3AED')),
        ...tiedGoals.map(p  => buildCard(p, 'Most Goals',   `${maxGoals} goals`,       B.mostGoals,   '#10B981')),
        ...tiedWins.map(p   => buildCard(p, 'Most Wins',    `${maxWins} wins`,         B.mostWins,    '#4A90E2'))
    ].join('');
    const bottomCards     = [
        ...tiedLosses.map(p  => buildCard(p, 'Most Losses',   `${maxLosses} losses`,      B.mostLosses,   '#FB8C00')),
        ...tiedBottom.map(p  => buildCard(p, 'Biggest Loser', `${lastPlayer.points} pts`, B.biggestLoser, '#EF4444'))
    ].join('');

    grid.innerHTML = `
        <div class="hl-section">
            <div class="hl-header hl-header-leader">
                <span class="hl-header-icon">🏅</span>
                <span class="hl-header-title">MVP</span>
            </div>
            <div class="hl-cards-row">${mvpCards}</div>
        </div>

        <div class="hl-section">
            <div class="hl-header hl-header-performers">
                <span class="hl-header-icon">🏆</span>
                <span class="hl-header-title">High Performers</span>
            </div>
            <div class="hl-cards-row">${performerCards}</div>
        </div>

        <div class="hl-section">
            <div class="hl-header hl-header-bottom">
                <span class="hl-header-icon">📉</span>
                <span class="hl-header-title">Bottom of the Barrel</span>
            </div>
            <div class="hl-cards-row">${bottomCards}</div>
        </div>
    `;
}

function convertToDirectLink(url) {
    if (!url) return url;
    
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) {
        return url;
    }
    
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
                return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
            }
        }
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    
    return url;
}

function calculateAge(birthday) {
    if (!birthday) return 'N/A';
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function convertToEmbedLink(url) {
    if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    } else if (url.includes('vimeo.com/')) {
        const match = url.match(/vimeo\.com\/(\d+)/);
        if (match && match[1]) {
            return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
        }
    }
    return null;
}

function buildGameBreakdownSection(playerId, allGames) {
    const categories = [
        {
            label: 'Wins',
            filter: g => (g.playerStats?.[playerId]?.win || 0) > 0,
            detail: g => {
                const v = g.playerStats[playerId].win;
                return `${v} win${v > 1 ? 's' : ''}`;
            }
        },
        {
            label: 'Goals',
            filter: g => (g.playerStats?.[playerId]?.goals || 0) > 0,
            detail: g => {
                const v = g.playerStats[playerId].goals;
                return `${v} goal${v > 1 ? 's' : ''}`;
            },
            total: games => games.reduce((sum, g) => sum + (g.playerStats?.[playerId]?.goals || 0), 0)
        },
        {
            label: 'Captain Losses',
            filter: g => (g.playerStats?.[playerId]?.captainLoss || 0) > 0,
            detail: () => 'Captain Loss'
        },
        {
            label: 'Games Played',
            filter: g => g.playerStats?.[playerId] != null,
            detail: null
        },
        {
            label: 'Losses',
            filter: g => (g.playerStats?.[playerId]?.loss || 0) > 0,
            detail: g => {
                const v = g.playerStats[playerId].loss;
                return `${v} loss${v > 1 ? 'es' : ''}`;
            }
        },
        {
            label: 'Captain Wins',
            filter: g => (g.playerStats?.[playerId]?.captainWin || 0) > 0,
            detail: () => 'Captain Win'
        }
    ];

    const itemsHTML = categories.map(cat => {
        const matching = allGames
            .filter(cat.filter)
            .sort((a, b) => b.date.localeCompare(a.date));

        const count = cat.total ? cat.total(matching) : matching.length;
        const countClass = count === 0 ? 'zero' : '';

        let listHTML = '<p class="breakdown-empty">No games</p>';
        if (matching.length > 0) {
            const byYear = {};
            matching.forEach(game => {
                const year = game.year || new Date(game.date + 'T12:00:00').getFullYear();
                if (!byYear[year]) byYear[year] = [];
                byYear[year].push(game);
            });

            listHTML = Object.keys(byYear)
                .sort((a, b) => b - a)
                .map(year => {
                    const yearCount = cat.total
                        ? byYear[year].reduce((sum, g) => sum + (g.playerStats?.[playerId]?.goals || 0), 0)
                        : byYear[year].length;
                    const links = byYear[year].map(game => {
                        const d = new Date(game.date + 'T12:00:00');
                        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const detail = cat.detail ? ` — ${cat.detail(game)}` : '';
                        return `<a href="game-history.html?game=${game.id}" class="breakdown-game-link">${label}${detail}</a>`;
                    }).join('');
                    return `
                        <details class="breakdown-year-item">
                            <summary class="breakdown-year-summary">
                                <span class="breakdown-year-name">${year}</span>
                                <span class="breakdown-year-badge">${yearCount}</span>
                                <span class="breakdown-arrow-sm">▼</span>
                            </summary>
                            <div class="breakdown-year-games">${links}</div>
                        </details>`;
                }).join('');
        }

        return `
            <details class="breakdown-item">
                <summary>
                    <div class="breakdown-header-left">
                        <span class="breakdown-label">${cat.label}</span>
                        <span class="breakdown-count ${countClass}">${count}</span>
                    </div>
                    <span class="breakdown-arrow">▼</span>
                </summary>
                <div class="breakdown-list">${listHTML}</div>
            </details>`;
    }).join('');

    return `<div class="breakdown-inline"><div class="breakdown-accordion">${itemsHTML}</div></div>`;
}

window.openPlayerProfileModal = async function(playerId) {
    try {
        const playerDoc = await getDoc(doc(db, 'players', playerId));
        if (!playerDoc.exists()) {
            alert('Player not found');
            return;
        }
        
        const player = playerDoc.data();
        
        // Use cached games if available, otherwise fetch
        let gamesForPlayer;
        if (cachedGames) {
            gamesForPlayer = cachedGames;
        } else {
            const gamesQuery = query(
                collection(db, 'games'),
                where('year', '==', currentYear)
            );
            const gamesSnapshot = await getDocs(gamesQuery);
            gamesForPlayer = gamesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }

        // Fetch all games (all years) for the breakdown section
        const allGamesSnapshot = await getDocs(collection(db, 'games'));
        const allGames = allGamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const stats = calculatePlayerStatsOptimized(playerId, gamesForPlayer);
        
        const modal = document.getElementById('playerDetailModal');
        const modalContent = document.getElementById('playerDetailContent');
        
        const headshotUrl = convertToDirectLink(player.headshotLink);
        const avatarContent = player.headshotLink 
            ? `<div><img src="${headshotUrl}" alt="${player.firstName}" class="player-detail-avatar" onerror="this.style.display='none'; this.parentElement.innerHTML = '<div class=\\'player-detail-avatar\\'>⚽</div>';"></div>` 
            : `<div class="player-detail-avatar">⚽</div>`;
        
        const age = calculateAge(player.birthday);
        
        let videosSection = '';
        if (player.highlightVideos && player.highlightVideos.length > 0) {
            const videoButtons = player.highlightVideos.map((link, index) => {
                const isDriveVideo = link.includes('drive.google.com');
                const videoId = `video-${playerDoc.id}-${index}`;
                
                if (isDriveVideo) {
                    const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    const fileId = match ? match[1] : null;
                    if (!fileId) return '';
                    
                    const driveDirectLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
                    return `
                        <div class="video-file-box" data-drive-video="${driveDirectLink}" data-video-id="${videoId}">
                            <div class="video-icon">🎬</div>
                            <div class="video-file-name">Highlight Video ${index + 1}</div>
                            <div class="video-play-icon">▶</div>
                        </div>
                    `;
                } else {
                    const embedLink = convertToEmbedLink(link);
                    if (!embedLink) return '';
                    
                    return `
                        <div class="video-file-box" data-embed-link="${embedLink}" data-video-id="${videoId}">
                            <div class="video-icon">🎬</div>
                            <div class="video-file-name">Highlight Video ${index + 1}</div>
                            <div class="video-play-icon">▶</div>
                        </div>
                    `;
                }
            }).join('');
            
            if (videoButtons) {
                videosSection = `
                    <div class="videos-section">
                        <h3>Highlight Videos</h3>
                        <div class="video-file-list">
                            ${videoButtons}
                        </div>
                    </div>
                `;
            }
        }
        
        const content = `
            <div class="player-detail-grid">
                <div class="player-detail-left">
                    ${avatarContent}
                    <h2>${player.firstName} ${player.lastName}</h2>
                    <p class="position">${player.position || 'Player'}</p>
                </div>
                <div class="player-detail-info">
                    <div class="info-row">
                        <div class="info-label">Age:</div>
                        <div>${age}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Height:</div>
                        <div>${player.height || 'N/A'}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Weight:</div>
                        <div>${player.weight ? player.weight + ' lbs' : 'N/A'}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Total Points:</div>
                        <div><strong>${stats.points}</strong></div>
                    </div>
                    ${player.hobbies ? `
                    <div class="info-row info-row-full">
                        <div class="info-label">Hobbies:</div>
                        <div>${player.hobbies}</div>
                    </div>
                    ` : ''}
                    ${buildGameBreakdownSection(playerId, allGames)}
                </div>
            </div>
            ${videosSection}
        `;
        
        modalContent.innerHTML = content;
        document.getElementById('detailModalTitle').textContent = `${player.firstName} ${player.lastName}`;
        modal.style.display = 'block';
        
        // Close button handler
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
        
        // Attach event listeners to video boxes
        setTimeout(() => {
            document.querySelectorAll('.video-file-box').forEach(box => {
                box.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const driveVideo = this.getAttribute('data-drive-video');
                    const embedLink = this.getAttribute('data-embed-link');
                    
                    if (driveVideo) {
                        openDriveVideoModal(driveVideo);
                    } else if (embedLink) {
                        openVideoModal(embedLink);
                    }
                });
            });
        }, 50);
    } catch (error) {
        console.error('Error opening player profile:', error);
        alert('Error loading player profile. Please try again.');
    }
};

window.openVideoModal = function(embedUrl) {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('videoModalIframe');
    
    if (!modal || !iframe) return;
    
    iframe.src = embedUrl;
    modal.style.display = 'block';
};

window.openDriveVideoModal = function(videoUrl) {
    const modal = document.getElementById('videoModal');
    const modalContent = modal.querySelector('.video-modal-content');
    
    if (!modal || !modalContent) return;
    
    modalContent.innerHTML = `
        <span class="close video-close" onclick="closeVideoModal()">&times;</span>
        <video id="driveVideoPlayer" controls autoplay style="width: 100%; height: 675px; background: #000;">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    
    modal.style.display = 'block';
    
    setTimeout(() => {
        const video = document.getElementById('driveVideoPlayer');
        if (video) video.play().catch(err => console.log('Autoplay prevented:', err));
    }, 100);
};

window.closeVideoModal = function() {
    const modal = document.getElementById('videoModal');
    const modalContent = modal.querySelector('.video-modal-content');
    
    const video = document.getElementById('driveVideoPlayer');
    if (video) {
        video.pause();
        video.src = '';
    }
    
    modalContent.innerHTML = `
        <span class="close video-close" onclick="closeVideoModal()">&times;</span>
        <iframe id="videoModalIframe" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
    `;
    
    const iframe = document.getElementById('videoModalIframe');
    if (iframe) iframe.src = '';
    
    modal.style.display = 'none';
};
