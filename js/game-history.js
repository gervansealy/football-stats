import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUserRole = 'viewer';
let allPlayers = [];
let cachedGames = []; // Cache games for performance
let cachedPointValues = null; // Cache point values

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    currentUserRole = authData.role;
    await loadPlayers();
    await loadPointValues();
    loadGameHistory();
});

async function loadPlayers() {
    const playersSnapshot = await getDocs(collection(db, 'players'));
    allPlayers = [];
    playersSnapshot.forEach((doc) => {
        allPlayers.push({
            id: doc.id,
            ...doc.data()
        });
    });
}

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

function showLoadingIndicator() {
    const container = document.getElementById('gameHistoryContainer');
    container.innerHTML = '<p class="loading-message">⏳ Loading game history...</p>';
}

function loadGameHistory() {
    showLoadingIndicator();
    const gamesQuery = query(collection(db, 'games'), orderBy('date', 'desc'));
    
    onSnapshot(gamesQuery, async (snapshot) => {
        const container = document.getElementById('gameHistoryContainer');
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No games recorded yet</p>';
            cachedGames = [];
            return;
        }

        // Update cached games
        cachedGames = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const gamesHTML = [];
        
        for (const gameDoc of snapshot.docs) {
            const gameData = gameDoc.data();
            // Fix timezone issue by adding 'T12:00:00' to treat as local noon
            const date = new Date(gameData.date + 'T12:00:00');
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const playerCount = Object.keys(gameData.playerStats || {}).length;
            
            const editDeleteButtons = currentUserRole === 'admin' ? `
                <div class="game-card-actions">
                    <button class="btn-edit-small" onclick="openEditGameModal('${gameDoc.id}')" title="Edit">✏️</button>
                    <button class="btn-delete-small" onclick="deleteGame('${gameDoc.id}', '${formattedDate}')" title="Delete">🗑️</button>
                </div>
            ` : '';

            gamesHTML.push(`
                <div class="game-card-compact" onclick="openGameDetailModal('${gameDoc.id}')">
                    <div class="game-card-header">
                        <h3>📅 ${formattedDate}</h3>
                        ${editDeleteButtons}
                    </div>
                    <div class="game-card-info">
                        <span>⚽ ${playerCount} Players</span>
                    </div>
                </div>
            `);
        }

        container.innerHTML = gamesHTML.join('');
    });
}

// OPTIMIZED: Calculate standings from cached data
function calculateStandingsAtDateOptimized(targetDate, gamesArray, playersArray, pointValues) {
    const players = [];

    playersArray.forEach((playerData) => {
        const stats = {
            id: playerData.id,
            name: `${playerData.firstName} ${playerData.lastName}`,
            games: 0,
            wins: 0,
            points: 0
        };

        gamesArray.forEach((game) => {
            if (game.date <= targetDate) {
                const playerStats = game.playerStats?.[playerData.id];
                
                if (playerStats) {
                    stats.games++;
                    stats.wins += playerStats.win || 0;

                    stats.points += (playerStats.win || 0) * pointValues.win;
                    stats.points += (playerStats.draw || 0) * pointValues.draw;
                    stats.points += (playerStats.loss || 0) * pointValues.loss;
                    stats.points += playerStats.cleanSheet ? pointValues.cleanSheet : 0;
                    stats.points += (playerStats.goals || 0) * pointValues.goal;
                    stats.points += (playerStats.captainWin || 0) * pointValues.captainWin;
                    stats.points += (playerStats.captainDraw || 0) * pointValues.captainDraw;
                    stats.points += (playerStats.captainLoss || 0) * pointValues.captainLoss;
                }
            }
        });

        stats.points = parseFloat(stats.points.toFixed(1));
        players.push(stats);
    });

    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
    });

    return players;
}

async function calculateStandingsAtDate(targetDate) {
    // Use cached data if available
    if (cachedGames.length > 0 && allPlayers.length > 0 && cachedPointValues) {
        return calculateStandingsAtDateOptimized(targetDate, cachedGames, allPlayers, cachedPointValues);
    }

    // Fallback to database calls (only if cache is empty)
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const gamesQuery = query(collection(db, 'games'));
    const gamesSnapshot = await getDocs(gamesQuery);

    const pointsSnapshot = await getDocs(collection(db, 'config'));
    let pointValues = cachedPointValues || {
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

    const players = [];

    playersSnapshot.forEach((playerDoc) => {
        const playerData = playerDoc.data();
        const stats = {
            id: playerDoc.id,
            name: `${playerData.firstName} ${playerData.lastName}`,
            games: 0,
            wins: 0,
            points: 0
        };

        gamesSnapshot.forEach((gameDoc) => {
            const gameData = gameDoc.data();
            
            if (gameData.date <= targetDate) {
                const playerStats = gameData.playerStats?.[playerDoc.id];
                
                if (playerStats) {
                    stats.games++;
                    stats.wins += playerStats.win || 0;

                    stats.points += (playerStats.win || 0) * pointValues.win;
                    stats.points += (playerStats.draw || 0) * pointValues.draw;
                    stats.points += (playerStats.loss || 0) * pointValues.loss;
                    stats.points += playerStats.cleanSheet ? pointValues.cleanSheet : 0;
                    stats.points += (playerStats.goals || 0) * pointValues.goal;
                    stats.points += (playerStats.captainWin || 0) * pointValues.captainWin;
                    stats.points += (playerStats.captainDraw || 0) * pointValues.captainDraw;
                    stats.points += (playerStats.captainLoss || 0) * pointValues.captainLoss;
                }
            }
        });

        stats.points = parseFloat(stats.points.toFixed(1));
        players.push(stats);
    });

    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
    });

    return players;
}

window.openGameDetailModal = async function(gameId) {
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) return;
    
    const gameData = gameDoc.data();
    // Fix timezone issue by adding 'T12:00:00' to treat as local noon
    const date = new Date(gameData.date + 'T12:00:00');
    const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const standings = await calculateStandingsAtDate(gameData.date);
    
    const modal = document.getElementById('gameDetailModal');
    const content = document.getElementById('gameDetailContent');
    
    // Build player stats for this game with full text labels
    const playerResults = Object.keys(gameData.playerStats || {}).map(playerId => {
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) return null;
        
        const stats = gameData.playerStats[playerId];
        const badges = [];
        
        if (stats.win > 0) badges.push(`<span class="stat-badge-compact win">Win ${stats.win}</span>`);
        if (stats.draw > 0) badges.push(`<span class="stat-badge-compact draw">Draw ${stats.draw}</span>`);
        if (stats.loss > 0) badges.push(`<span class="stat-badge-compact loss">Loss ${stats.loss}</span>`);
        if (stats.goals > 0) badges.push(`<span class="stat-badge-compact goal">⚽ ${stats.goals} Goal${stats.goals > 1 ? 's' : ''}</span>`);
        if (stats.cleanSheet) badges.push(`<span class="stat-badge-compact cleansheet">Clean Sheet</span>`);
        if (stats.captainWin > 0) badges.push(`<span class="stat-badge-compact captain">⭐ Captain Win ${stats.captainWin}</span>`);
        if (stats.captainDraw > 0) badges.push(`<span class="stat-badge-compact captain">⭐ Captain Draw ${stats.captainDraw}</span>`);
        if (stats.captainLoss > 0) badges.push(`<span class="stat-badge-compact captain">⭐ Captain Loss ${stats.captainLoss}</span>`);
        
        return {
            playerId,
            name: `${player.firstName} ${player.lastName}`,
            stats,
            badges: badges.join(''),
            isCaptainWin: (stats.captainWin || 0) > 0,
            isCaptainLoss: (stats.captainLoss || 0) > 0,
            isCaptainDraw: (stats.captainDraw || 0) > 0,
            hasWin: (stats.win || 0) > 0,
            hasLoss: (stats.loss || 0) > 0,
            hasDraw: (stats.draw || 0) > 0,
            hasGoals: (stats.goals || 0) > 0,
            hasCleanSheet: stats.cleanSheet || false,
            goalCount: stats.goals || 0
        };
    }).filter(p => p !== null);
    
    // Smart sorting
    playerResults.sort((a, b) => {
        const isWinGame = playerResults.some(p => p.hasWin);
        const isDrawGame = !isWinGame && playerResults.some(p => p.hasDraw);
        const hasCleanSheet = playerResults.some(p => p.hasCleanSheet);
        
        if (isWinGame) {
            if (hasCleanSheet) {
                if (a.isCaptainWin !== b.isCaptainWin) return b.isCaptainWin ? 1 : -1;
                if (a.hasCleanSheet !== b.hasCleanSheet) return b.hasCleanSheet ? 1 : -1;
                if (a.hasWin && b.hasWin && a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
                if (a.hasWin !== b.hasWin) return b.hasWin ? 1 : -1;
                if (a.isCaptainLoss !== b.isCaptainLoss) return b.isCaptainLoss ? 1 : -1;
                if (a.hasLoss && b.hasLoss && a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
            } else {
                if (a.isCaptainWin !== b.isCaptainWin) return b.isCaptainWin ? 1 : -1;
                if (a.hasWin && b.hasWin && a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
                if (a.hasWin !== b.hasWin) return b.hasWin ? 1 : -1;
                if (a.isCaptainLoss !== b.isCaptainLoss) return b.isCaptainLoss ? 1 : -1;
                if (a.hasLoss && b.hasLoss && a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
            }
        } else if (isDrawGame) {
            if (a.isCaptainDraw !== b.isCaptainDraw) return b.isCaptainDraw ? 1 : -1;
            if (a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
            if (a.goalCount !== b.goalCount) return b.goalCount - a.goalCount;
        } else {
            if (a.isCaptainLoss !== b.isCaptainLoss) return b.isCaptainLoss ? 1 : -1;
            if (a.hasGoals !== b.hasGoals) return b.hasGoals ? 1 : -1;
            if (a.goalCount !== b.goalCount) return b.goalCount - a.goalCount;
        }
        return 0;
    });
    
    const playerStatsHTML = playerResults.map(player => `
        <div class="game-player-stat-compact">
            <span class="player-name-compact">${player.name}</span>
            <div class="stat-badges-compact">
                ${player.badges}
            </div>
        </div>
    `).join('');
    
    content.innerHTML = `
        <h2>Game on ${formattedDate}</h2>
        <div class="game-detail-layout">
            <div class="game-player-stats">
                <h3>Player Results</h3>
                ${playerStatsHTML}
            </div>
            <div class="game-standings-table">
                <h3>Standings After This Game</h3>
                <table class="standings-table compact">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((p, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${p.name}</td>
                                <td><strong>${p.points}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.openEditGameModal = async function(gameId) {
    event.stopPropagation();
    
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) return;
    
    const gameData = gameDoc.data();
    const modal = document.getElementById('editGameModal');
    const content = document.getElementById('editGameContent');
    
    document.getElementById('editGameDate').value = gameData.date;
    document.getElementById('editGameId').value = gameId;
    
    const playerStatsHTML = allPlayers.map(player => {
        const stats = gameData.playerStats?.[player.id] || {};
        const wins = stats.win || 0;
        const draws = stats.draw || 0;
        const losses = stats.loss || 0;
        const isCaptain = (stats.captainWin || 0) > 0 || (stats.captainDraw || 0) > 0 || (stats.captainLoss || 0) > 0;
        
        return `
            <div class="player-stat-card" data-player-id="${player.id}">
                <h3>${player.firstName} ${player.lastName}</h3>
                
                <div class="stat-input-group">
                    <label>Wins:</label>
                    <input type="number" class="stat-win" min="0" value="${wins}">
                </div>
                
                <div class="stat-input-group">
                    <label>Draws:</label>
                    <input type="number" class="stat-draw" min="0" value="${draws}">
                </div>
                
                <div class="stat-input-group">
                    <label>Losses:</label>
                    <input type="number" class="stat-loss" min="0" value="${losses}">
                </div>
                
                <div class="stat-input-group">
                    <label>Clean Sheet:</label>
                    <input type="checkbox" class="stat-cleansheet" ${stats.cleanSheet ? 'checked' : ''}>
                </div>
                
                <div class="stat-input-group">
                    <label>Goals:</label>
                    <input type="number" class="stat-goals" min="0" value="${stats.goals || 0}">
                </div>
                
                <div class="stat-input-group captain-checkbox">
                    <label><strong>⭐ Captain:</strong></label>
                    <input type="checkbox" class="stat-captain" ${isCaptain ? 'checked' : ''}>
                </div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = playerStatsHTML;
    modal.style.display = 'block';
};

window.saveEditedGame = async function() {
    const gameId = document.getElementById('editGameId').value;
    const gameDate = document.getElementById('editGameDate').value;
    
    if (!gameId || !gameDate) {
        alert('Error: Missing game ID or date');
        return;
    }
    
    const playerStatsCards = document.querySelectorAll('#editGameContent .player-stat-card');
    const playerStats = {};
    
    playerStatsCards.forEach(card => {
        const playerId = card.dataset.playerId;
        const wins = parseInt(card.querySelector('.stat-win').value) || 0;
        const draws = parseInt(card.querySelector('.stat-draw').value) || 0;
        const losses = parseInt(card.querySelector('.stat-loss').value) || 0;
        const cleanSheet = card.querySelector('.stat-cleansheet').checked;
        const goals = parseInt(card.querySelector('.stat-goals').value) || 0;
        const isCaptain = card.querySelector('.stat-captain').checked;
        
        const captainWins = isCaptain ? wins : 0;
        const captainDraws = isCaptain ? draws : 0;
        const captainLosses = isCaptain ? losses : 0;
        
        if (wins > 0 || draws > 0 || losses > 0 || cleanSheet || goals > 0) {
            playerStats[playerId] = {
                win: wins,
                draw: draws,
                loss: losses,
                cleanSheet: cleanSheet,
                goals: goals,
                captainWin: captainWins,
                captainDraw: captainDraws,
                captainLoss: captainLosses
            };
        }
    });
    
    if (Object.keys(playerStats).length === 0) {
        alert('Please enter stats for at least one player');
        return;
    }
    
    try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
            date: gameDate,
            year: new Date(gameDate).getFullYear(),
            playerStats: playerStats,
            updatedAt: new Date().toISOString()
        });
        
        alert('Game updated successfully!');
        document.getElementById('editGameModal').style.display = 'none';
    } catch (error) {
        console.error('Error updating game:', error);
        alert('Error updating game: ' + error.message);
    }
};

window.deleteGame = async function(gameId, formattedDate) {
    event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete the game on ${formattedDate}? This cannot be undone.`)) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'games', gameId));
        alert('Game deleted successfully!');
    } catch (error) {
        console.error('Error deleting game:', error);
        alert('Error deleting game. Please try again.');
    }
};

window.closeGameDetailModal = function() {
    document.getElementById('gameDetailModal').style.display = 'none';
};

window.closeEditGameModal = function() {
    document.getElementById('editGameModal').style.display = 'none';
};
