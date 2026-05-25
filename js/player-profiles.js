import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, addDoc, getDocs, doc, getDoc, onSnapshot, query, where, updateDoc, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { buildCareerOverviewSection, buildPlayerInfoCards, initCareerOverview } from './career-overview.js';
import { openHighlightPlaylist } from './highlight-video-player.js';

let isAdmin = false;
let editingPlayerId = null;
let cachedGames = []; // Cache games for performance
let cachedPointValues = null; // Cache point values

function escapeHtmlAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;');
}

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    isAdmin = authData.role === 'admin';

    await loadPointValues();
    loadPlayers();

    if (isAdmin) {
        document.getElementById('addPlayerBtn').addEventListener('click', openPlayerModal);
    }

    const modal = document.getElementById('playerModal');
    const detailModal = document.getElementById('playerDetailModal');
    const closeBtns = document.querySelectorAll('.close');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
            detailModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === detailModal) detailModal.style.display = 'none';
    });

    document.getElementById('playerForm').addEventListener('submit', handlePlayerSubmit);
    document.getElementById('addVideoBtn').addEventListener('click', addVideoField);
});

async function loadPointValues() {
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
}

function openPlayerModal() {
    editingPlayerId = null;
    document.getElementById('modalTitle').textContent = 'Add New Player';
    document.getElementById('playerForm').reset();
    document.getElementById('videoLinksContainer').innerHTML = '';
    document.getElementById('playerModal').style.display = 'block';
}

window.openEditModal = async function(playerId) {
    editingPlayerId = playerId;
    document.getElementById('modalTitle').textContent = 'Edit Player';
    
    const playerDoc = await getDoc(doc(db, 'players', playerId));
    const player = playerDoc.data();
    
    document.getElementById('firstName').value = player.firstName || '';
    document.getElementById('lastName').value = player.lastName || '';
    document.getElementById('position').value = player.position || '';
    document.getElementById('height').value = player.height || '';
    document.getElementById('weight').value = player.weight || '';
    document.getElementById('birthday').value = player.birthday || '';
    document.getElementById('hobbies').value = player.hobbies || '';
    document.getElementById('headshotLink').value = player.headshotLink || '';
    
    const videoLinksContainer = document.getElementById('videoLinksContainer');
    videoLinksContainer.innerHTML = '';
    
    if (player.highlightVideos && player.highlightVideos.length > 0) {
        const first = player.highlightVideos[0];
        const firstUrl = typeof first === 'string' ? first : (first?.url || '');
        const firstName = typeof first === 'string' ? '' : (first?.name || '');
        document.getElementById('highlightVideoUrl').value = firstUrl;
        document.getElementById('highlightVideoName').value = firstName;

        for (let i = 1; i < player.highlightVideos.length; i++) {
            const v = player.highlightVideos[i];
            const url = typeof v === 'string' ? v : (v?.url || '');
            const name = typeof v === 'string' ? '' : (v?.name || '');
            addVideoField(url, name);
        }
    }
    
    document.getElementById('playerModal').style.display = 'block';
};

window.deletePlayer = async function(playerId, playerName) {
    if (!confirm(`Move ${playerName} to the Recycle Bin?`)) return;

    try {
        const playerDoc = await getDoc(doc(db, 'players', playerId));
        if (!playerDoc.exists()) return;

        await setDoc(doc(db, 'trash', playerId), {
            type: 'player',
            originalId: playerId,
            data: playerDoc.data(),
            deletedAt: new Date().toISOString()
        });
        await deleteDoc(doc(db, 'players', playerId));
        alert(`${playerName} moved to Recycle Bin.`);
    } catch (error) {
        console.error('Error deleting player:', error);
        alert('Error deleting player. Please try again.');
    }
};

function addVideoField(url = '', name = '') {
    const container = document.getElementById('videoLinksContainer');
    const index = container.children.length;

    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
        <label>Highlight Video ${index + 2}:</label>
        <div class="video-entry-stack">
            <div class="video-entry-field">
                <span class="video-field-label">Name</span>
                <input type="text" class="video-name" placeholder="e.g. Luke finisher" value="${name}">
            </div>
            <div class="video-entry-field">
                <span class="video-field-label">Link</span>
                <input type="url" class="video-link" placeholder="Paste video link" value="${url}">
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function handlePlayerSubmit(e) {
    e.preventDefault();

    const videoLinks = [];
    const mainUrl = document.getElementById('highlightVideoUrl').value.trim();
    const mainName = document.getElementById('highlightVideoName').value.trim();
    if (mainUrl) videoLinks.push({ url: mainUrl, name: mainName || 'Highlight Video 1' });

    document.querySelectorAll('#videoLinksContainer .form-group').forEach((entry, i) => {
        const url = entry.querySelector('.video-link')?.value.trim();
        const name = entry.querySelector('.video-name')?.value.trim();
        if (url) videoLinks.push({ url, name: name || `Highlight Video ${videoLinks.length + 1}` });
    });

    const playerData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        position: document.getElementById('position').value.trim(),
        height: document.getElementById('height').value.trim(),
        weight: document.getElementById('weight').value ? parseInt(document.getElementById('weight').value) : null,
        birthday: document.getElementById('birthday').value,
        hobbies: document.getElementById('hobbies').value.trim(),
        headshotLink: document.getElementById('headshotLink').value.trim(),
        highlightVideos: videoLinks
    };

    try {
        if (editingPlayerId) {
            // Update existing player
            playerData.updatedAt = new Date().toISOString();
            await updateDoc(doc(db, 'players', editingPlayerId), playerData);
            alert('Player updated successfully!');
        } else {
            // Add new player
            playerData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'players'), playerData);
            alert('Player added successfully!');
        }
        document.getElementById('playerModal').style.display = 'none';
        editingPlayerId = null;
    } catch (error) {
        console.error('Error saving player:', error);
        alert('Error saving player. Please try again.');
    }
}

function showLoadingIndicator() {
    const container = document.getElementById('playerProfilesContainer');
    container.innerHTML = '<p class="loading-message">⏳ Loading player profiles...</p>';
}

function loadPlayers() {
    showLoadingIndicator();
    const playersQuery = collection(db, 'players');
    
    onSnapshot(playersQuery, async (snapshot) => {
        const container = document.getElementById('playerProfilesContainer');
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No players added yet</p>';
            return;
        }

        // Fetch all games ONCE for the current year
        const currentYear = new Date().getFullYear();
        const gamesQuery = query(collection(db, 'games'), where('year', '==', currentYear));
        const gamesSnapshot = await getDocs(gamesQuery);
        cachedGames = gamesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Build player array with stats for sorting
        const playersWithStats = [];

        for (const playerDoc of snapshot.docs) {
            const player = playerDoc.data();
            const stats = getPlayerStatsOptimized(playerDoc.id, cachedGames);
            
            playersWithStats.push({
                id: playerDoc.id,
                player: player,
                stats: stats,
                winPercentage: stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : 0
            });
        }

        // Sort by standings order: points DESC, wins DESC, win percentage DESC
        playersWithStats.sort((a, b) => {
            if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
            if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
            return b.winPercentage - a.winPercentage;
        });

        // Generate HTML from sorted array
        const playersHTML = playersWithStats.map(item => {
            const player = item.player;
            const stats = item.stats;
            const playerId = item.id;

            const imageUrl = convertToDirectLink(player.headshotLink);
            const avatarContent = player.headshotLink 
                ? `<div class="player-avatar-container"><img src="${imageUrl}" alt="${player.firstName}" class="player-avatar" onerror="this.style.display='none'; this.parentElement.innerHTML = '<div class=\\'player-avatar\\'>⚽</div>';"></div>` 
                : `<div class="player-avatar">⚽</div>`;

            const playerName = `${player.firstName} ${player.lastName}`;
            const editDeleteButtons = isAdmin ? `
                <div class="player-actions">
                    <button type="button" class="btn-edit" data-player-id="${playerId}" title="Edit">✏️</button>
                    <button type="button" class="btn-delete" data-player-id="${playerId}" data-player-name="${escapeHtmlAttr(playerName)}" title="Delete">🗑️</button>
                </div>
            ` : '';

            return `
                <div class="player-card" data-player-id="${playerId}">
                    ${editDeleteButtons}
                    ${avatarContent}
                    <h3>${player.firstName} ${player.lastName}</h3>
                    <p class="position">${player.position || 'Player'}</p>
                    <div class="player-stats-summary">
                        <div class="stat-item">
                            <div class="label">Games</div>
                            <div class="value">${stats.games}</div>
                        </div>
                        <div class="stat-item">
                            <div class="label">Wins</div>
                            <div class="value">${stats.wins}</div>
                        </div>
                        <div class="stat-item">
                            <div class="label">Goals</div>
                            <div class="value">${stats.goals}</div>
                        </div>
                        <div class="stat-item">
                            <div class="label">Points</div>
                            <div class="value">${stats.points}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = playersHTML.join('');

        container.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', () => showPlayerDetail(card.dataset.playerId));
        });

        if (isAdmin) {
            container.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(btn.dataset.playerId);
                });
            });
            container.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deletePlayer(btn.dataset.playerId, btn.dataset.playerName);
                });
            });
        }
    });
}

// OPTIMIZED: Calculate player stats from cached games array (no database calls)
function getPlayerStatsOptimized(playerId, gamesArray) {
    const stats = {
        games: 0,
        wins: 0,
        losses: 0,
        goals: 0,
        captainWins: 0,
        captainLosses: 0,
        points: 0
    };

    const pointValues = cachedPointValues || {
        win: 3,
        draw: 1,
        loss: -1,
        cleanSheet: 3,
        goal: 1,
        captainWin: 5,
        captainDraw: 2.5,
        captainLoss: -2
    };

    gamesArray.forEach((game) => {
        const playerStats = game.playerStats?.[playerId];
        
        if (playerStats) {
            stats.games++;
            stats.wins += playerStats.win || 0;
            stats.losses += playerStats.loss || 0;
            stats.goals += playerStats.goals || 0;
            stats.captainWins += playerStats.captainWin || 0;
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

    stats.points = parseFloat(stats.points.toFixed(1));

    return stats;
}

async function getPlayerStats(playerId) {
    // Use cached games if available
    if (cachedGames.length > 0) {
        return getPlayerStatsOptimized(playerId, cachedGames);
    }

    // Fallback to database calls (only if cache is empty)
    const gamesQuery = collection(db, 'games');
    const gamesSnapshot = await getDocs(gamesQuery);

    const stats = {
        games: 0,
        wins: 0,
        losses: 0,
        goals: 0,
        captainWins: 0,
        captainLosses: 0,
        points: 0
    };

    const pointValues = cachedPointValues || {
        win: 3,
        draw: 1,
        loss: -1,
        cleanSheet: 3,
        goal: 1,
        captainWin: 5,
        captainDraw: 2.5,
        captainLoss: -2
    };

    gamesSnapshot.forEach((gameDoc) => {
        const gameData = gameDoc.data();
        const playerStats = gameData.playerStats?.[playerId];
        
        if (playerStats) {
            stats.games++;
            stats.wins += playerStats.win || 0;
            stats.losses += playerStats.loss || 0;
            stats.goals += playerStats.goals || 0;
            stats.captainWins += playerStats.captainWin || 0;
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

    stats.points = parseFloat(stats.points.toFixed(1));

    return stats;
}

function buildVideoItems(player) {
    if (!player.highlightVideos?.length) return [];

    return player.highlightVideos.map((video, index) => {
        const link = typeof video === 'string' ? video : (video?.url || '');
        const name = (typeof video === 'string' ? '' : video?.name) || `Highlight Video ${index + 1}`;
        if (!link) return null;

        let embedLink = '';
        let driveLink = '';

        if (link.includes('drive.google.com')) {
            const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) driveLink = `https://drive.google.com/uc?export=download&id=${match[1]}`;
        } else {
            embedLink = convertToEmbedLink(link) || '';
        }

        if (!embedLink && !driveLink) return null;
        return { name, embedLink, driveLink };
    }).filter(Boolean);
}

window.showPlayerDetail = async function(playerId) {
    const playerDoc = await getDoc(doc(db, 'players', playerId));
    const player = playerDoc.data();
    const stats = await getPlayerStats(playerId);

    const allGamesSnapshot = await getDocs(collection(db, 'games'));
    const allGames = allGamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const detailImageUrl = convertToDirectLink(player.headshotLink);
    const avatarContent = player.headshotLink 
        ? `<div><img src="${detailImageUrl}" alt="${player.firstName}" class="player-detail-avatar" onerror="this.style.display='none'; this.parentElement.innerHTML = '<div class=\\'player-detail-avatar\\'>⚽</div>';"></div>` 
        : `<div class="player-detail-avatar">⚽</div>`;

    const age = player.birthday ? calculateAge(player.birthday) : 'N/A';
    const videoItems = buildVideoItems(player);

    const content = `
        <div class="player-detail-grid">
            <div class="player-detail-left">
                ${avatarContent}
                <h2>${player.firstName} ${player.lastName}</h2>
                <p class="position">${player.position || 'Player'}</p>
            </div>
            <div class="player-detail-info">
                ${buildPlayerInfoCards({
                    age,
                    height: player.height,
                    weight: player.weight,
                    points: stats.points,
                    hobbies: player.hobbies
                })}
            </div>
            ${buildCareerOverviewSection(playerId, allGames, videoItems.length)}
        </div>
    `;

    document.getElementById('playerDetailContent').innerHTML = content;
    document.getElementById('detailModalTitle').textContent = `${player.firstName} ${player.lastName}`;
    document.getElementById('playerDetailModal').style.display = 'block';

    const careerSection = document.getElementById('playerDetailContent').querySelector('.career-overview-section');
    initCareerOverview(careerSection, playerId, allGames, videoItems.length, videoItems, (items, startIndex) => {
        openHighlightPlaylist(items, startIndex);
    });
};

function convertToDirectLink(url) {
    if (!url) return url;
    
    // If it's already a direct image URL (ends with image extension), use it as-is
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) {
        console.log('Direct image URL detected:', url);
        return url;
    }
    
    // Handle Google Drive URLs
    if (url.includes('drive.google.com')) {
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        }
        if (!match) {
            match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        }
        if (match && match[1]) {
            const fileId = match[1];
            // Try multiple Google Drive formats
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
    }
    
    // For any other URL, return as-is and let the browser try to load it
    return url;
}

function convertToEmbedLink(url) {
    if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    } else if (url.includes('vimeo.com/')) {
        // Extract Vimeo video ID from URL
        const match = url.match(/vimeo\.com\/(\d+)/);
        if (match && match[1]) {
            return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
        }
    } else if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            // For Google Drive, return a direct link that opens in new window
            return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }
    return null;
}

function getVideoThumbnail(url) {
    if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    } else if (url.includes('drive.google.com')) {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%234285f4" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="40">▶</text></svg>';
    }
    return '';
}

function calculateAge(birthday) {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}
