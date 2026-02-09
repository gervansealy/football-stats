import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, query, orderBy, onSnapshot, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadGameHistory();
});

function loadGameHistory() {
    const gamesQuery = query(collection(db, 'games'), orderBy('date', 'desc'));
    
    onSnapshot(gamesQuery, async (snapshot) => {
        const container = document.getElementById('gameHistoryContainer');
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No games recorded yet</p>';
            return;
        }

        const gamesHTML = [];
        
        for (const gameDoc of snapshot.docs) {
            const gameData = gameDoc.data();
            const date = new Date(gameData.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            const standings = await calculateStandingsAtDate(gameData.date);

            gamesHTML.push(`
                <div class="game-card">
                    <h3>Game on ${formattedDate}</h3>
                    <div class="game-stats">
                        <div class="game-info">
                            <strong>Players participated: ${Object.keys(gameData.playerStats || {}).length}</strong>
                        </div>
                        <div class="game-standings">
                            <h4>Standings After This Game</h4>
                            <table class="standings-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>Games</th>
                                        <th>Wins</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${standings.map((p, idx) => `
                                        <tr>
                                            <td>${idx + 1}</td>
                                            <td>${p.name}</td>
                                            <td>${p.games}</td>
                                            <td>${p.wins}</td>
                                            <td><strong>${p.points}</strong></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `);
        }

        container.innerHTML = gamesHTML.join('');
    });
}

async function calculateStandingsAtDate(targetDate) {
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const gamesQuery = query(collection(db, 'games'));
    const gamesSnapshot = await getDocs(gamesQuery);

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
