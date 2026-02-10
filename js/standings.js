import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentYear = new Date().getFullYear();
let unsubscribe = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    
    const yearSelect = document.getElementById('yearSelect');
    yearSelect.value = currentYear;
    
    yearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        if (unsubscribe) unsubscribe();
        loadStandings();
    });

    loadStandings();
});

function loadStandings() {
    const playersQuery = query(collection(db, 'players'));
    
    unsubscribe = onSnapshot(playersQuery, async (playersSnapshot) => {
        if (playersSnapshot.empty) {
            displayStandings([]);
            return;
        }

        const players = [];
        
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            const stats = await calculatePlayerStats(playerDoc.id, currentYear);
            
            players.push({
                id: playerDoc.id,
                name: `${playerData.firstName} ${playerData.lastName}`,
                firstName: playerData.firstName,
                lastName: playerData.lastName,
                profilePicture: playerData.profilePicture || '',
                ...stats
            });
        }

        players.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winPercentage - a.winPercentage;
        });

        displayStandings(players);
    }, (error) => {
        console.error('Error loading players:', error);
        displayStandings([]);
    });
}

let cachedPointValues = null;

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

async function calculatePlayerStats(playerId, year) {
    const gamesQuery = query(
        collection(db, 'games'),
        where('year', '==', year)
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    
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

    const pointValues = await getPointValues();

    gamesSnapshot.forEach((gameDoc) => {
        const gameData = gameDoc.data();
        const playerStats = gameData.playerStats?.[playerId];
        
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
        const profilePicUrl = convertToDirectLink(player.profilePicture);
        const avatarHtml = profilePicUrl 
            ? `<img src="${profilePicUrl}" alt="${player.firstName}" class="player-standings-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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

window.openPlayerProfileModal = async function(playerId) {
    const playerDoc = await getDoc(doc(db, 'players', playerId));
    if (!playerDoc.exists()) {
        alert('Player not found');
        return;
    }
    
    const player = playerDoc.data();
    const stats = await calculatePlayerStats(playerId, currentYear);
    
    const modal = document.getElementById('playerProfileModal');
    const modalContent = document.getElementById('playerProfileContent');
    
    const profilePicUrl = convertToDirectLink(player.profilePicture);
    const avatarHtml = profilePicUrl 
        ? `<img src="${profilePicUrl}" alt="${player.firstName}" class="profile-modal-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="profile-modal-avatar-fallback" style="display:none;">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`
        : `<div class="profile-modal-avatar-fallback">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`;
    
    modalContent.innerHTML = `
        <div class="profile-modal-header">
            ${avatarHtml}
            <div>
                <h2>${player.firstName} ${player.lastName}</h2>
                <p class="profile-position">${player.position || 'Player'}</p>
            </div>
        </div>
        <div class="profile-modal-stats">
            <div class="stat-row">
                <span>Games Played:</span>
                <strong>${stats.games}</strong>
            </div>
            <div class="stat-row">
                <span>Wins:</span>
                <strong>${stats.wins}</strong>
            </div>
            <div class="stat-row">
                <span>Draws:</span>
                <strong>${stats.draws}</strong>
            </div>
            <div class="stat-row">
                <span>Losses:</span>
                <strong>${stats.losses}</strong>
            </div>
            <div class="stat-row">
                <span>Goals:</span>
                <strong>${stats.goals}</strong>
            </div>
            <div class="stat-row">
                <span>Clean Sheets:</span>
                <strong>${stats.cleanSheets}</strong>
            </div>
            <div class="stat-row">
                <span>Captain Wins:</span>
                <strong>${stats.captainWins}</strong>
            </div>
            <div class="stat-row">
                <span>Captain Losses:</span>
                <strong>${stats.captainLosses}</strong>
            </div>
            <div class="stat-row">
                <span>Win %:</span>
                <strong>${stats.winPercentage}%</strong>
            </div>
            <div class="stat-row">
                <span>Total Points:</span>
                <strong class="highlight-points">${stats.points}</strong>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
};
