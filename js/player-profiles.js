import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, addDoc, getDocs, doc, getDoc, onSnapshot, query, where, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let isAdmin = false;
let editingPlayerId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    isAdmin = authData.role === 'admin';

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
        document.getElementById('highlightVideos').value = player.highlightVideos[0] || '';
        
        for (let i = 1; i < player.highlightVideos.length; i++) {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label>Video ${i + 1}:</label>
                <input type="url" class="video-link" placeholder="Paste video link" value="${player.highlightVideos[i]}">
            `;
            videoLinksContainer.appendChild(div);
        }
    }
    
    document.getElementById('playerModal').style.display = 'block';
};

window.deletePlayer = async function(playerId, playerName) {
    if (!confirm(`Are you sure you want to delete ${playerName}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'players', playerId));
        alert('Player deleted successfully!');
    } catch (error) {
        console.error('Error deleting player:', error);
        alert('Error deleting player. Please try again.');
    }
};

function addVideoField() {
    const container = document.getElementById('videoLinksContainer');
    const index = container.children.length;
    
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
        <label>Video ${index + 2}:</label>
        <input type="url" class="video-link" placeholder="Paste video link">
    `;
    container.appendChild(div);
}

async function handlePlayerSubmit(e) {
    e.preventDefault();

    const videoLinks = [];
    const mainVideo = document.getElementById('highlightVideos').value.trim();
    if (mainVideo) videoLinks.push(mainVideo);

    document.querySelectorAll('.video-link').forEach(input => {
        const link = input.value.trim();
        if (link) videoLinks.push(link);
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

function loadPlayers() {
    const playersQuery = collection(db, 'players');
    
    onSnapshot(playersQuery, async (snapshot) => {
        const container = document.getElementById('playerProfilesContainer');
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No players added yet</p>';
            return;
        }

        const playersHTML = [];

        for (const playerDoc of snapshot.docs) {
            const player = playerDoc.data();
            const stats = await getPlayerStats(playerDoc.id);

            const imageUrl = convertToDirectLink(player.headshotLink);
            const avatarContent = player.headshotLink 
                ? `<img src="${imageUrl}" alt="${player.firstName}" class="player-avatar" crossorigin="anonymous" onerror="this.onerror=null; this.src='https://drive.google.com/uc?export=view&id=${player.headshotLink.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || ''}'; console.error('Image failed to load:', '${imageUrl}');">` 
                : `<div class="player-avatar">⚽</div>`;

            const editDeleteButtons = isAdmin ? `
                <div class="player-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); openEditModal('${playerDoc.id}');" title="Edit">✏️</button>
                    <button class="btn-delete" onclick="event.stopPropagation(); deletePlayer('${playerDoc.id}', '${player.firstName} ${player.lastName}');" title="Delete">🗑️</button>
                </div>
            ` : '';

            playersHTML.push(`
                <div class="player-card" onclick="showPlayerDetail('${playerDoc.id}')">
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
            `);
        }

        container.innerHTML = playersHTML.join('');
    });
}

async function getPlayerStats(playerId) {
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

    const pointsSnapshot = await getDocs(collection(db, 'config'));
    let pointValues = {
        win: 3,
        draw: 1,
        loss: -1,
        cleanSheet: 3,
        goal: 1,
        captainWin: 5,
        captainDraw: 2.5,
        captainLoss: -2
    };

    for (const configDoc of pointsSnapshot.docs) {
        if (configDoc.id === 'points') {
            pointValues = configDoc.data();
        }
    }

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

window.showPlayerDetail = async function(playerId) {
    const playerDoc = await getDoc(doc(db, 'players', playerId));
    const player = playerDoc.data();
    const stats = await getPlayerStats(playerId);

    const detailImageUrl = convertToDirectLink(player.headshotLink);
    const avatarContent = player.headshotLink 
        ? `<img src="${detailImageUrl}" alt="${player.firstName}" class="player-detail-avatar" crossorigin="anonymous" onerror="this.onerror=null; this.src='https://drive.google.com/uc?export=view&id=${player.headshotLink.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || ''}';">` 
        : `<div class="player-detail-avatar">⚽</div>`;

    const age = player.birthday ? calculateAge(player.birthday) : 'N/A';

    let videosSection = '';
    if (player.highlightVideos && player.highlightVideos.length > 0) {
        const videoEmbeds = player.highlightVideos.map(link => {
            const embedLink = convertToEmbedLink(link);
            return embedLink ? `
                <div class="video-embed">
                    <iframe src="${embedLink}" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                </div>
            ` : '';
        }).join('');

        if (videoEmbeds) {
            videosSection = `
                <div class="videos-section">
                    <h3>Highlight Videos</h3>
                    <div class="video-grid">
                        ${videoEmbeds}
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
                    <div class="info-label">Games Played:</div>
                    <div>${stats.games}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Wins:</div>
                    <div>${stats.wins}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Losses:</div>
                    <div>${stats.losses}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Goals:</div>
                    <div>${stats.goals}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Captain Wins:</div>
                    <div>${stats.captainWins}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Captain Losses:</div>
                    <div>${stats.captainLosses}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Points:</div>
                    <div><strong>${stats.points}</strong></div>
                </div>
                ${player.hobbies ? `
                <div class="info-row">
                    <div class="info-label">Hobbies:</div>
                    <div>${player.hobbies}</div>
                </div>
                ` : ''}
            </div>
        </div>
        ${videosSection}
    `;

    document.getElementById('playerDetailContent').innerHTML = content;
    document.getElementById('detailModalTitle').textContent = `${player.firstName} ${player.lastName}`;
    document.getElementById('playerDetailModal').style.display = 'block';
};

function convertToDirectLink(url) {
    if (!url) return url;
    
    if (url.includes('drive.google.com')) {
        // Extract file ID from Google Drive URL
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        }
        if (!match) {
            match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        }
        if (match && match[1]) {
            const fileId = match[1];
            // Use multiple fallback URLs for better compatibility
            // Primary: googleusercontent (most reliable for public images)
            const directUrl = `https://lh3.googleusercontent.com/d/${fileId}=s500?authuser=0`;
            console.log('Google Drive Image - File ID:', fileId);
            console.log('Direct URL:', directUrl);
            return directUrl;
        }
    }
    return url;
}

function convertToEmbedLink(url) {
    if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } else if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }
    return null;
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
