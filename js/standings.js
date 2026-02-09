import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, query, where, onSnapshot, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentYear = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    
    const yearSelect = document.getElementById('yearSelect');
    yearSelect.value = currentYear;
    
    yearSelect.addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        loadStandings();
    });

    loadStandings();
});

function loadStandings() {
    const playersQuery = query(collection(db, 'players'));
    
    onSnapshot(playersQuery, async (playersSnapshot) => {
        const players = [];
        
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            const stats = await calculatePlayerStats(playerDoc.id, currentYear);
            
            players.push({
                id: playerDoc.id,
                name: `${playerData.firstName} ${playerData.lastName}`,
                ...stats
            });
        }

        players.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winPercentage - a.winPercentage;
        });

        displayStandings(players);
    });
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

    const pointsDoc = await getDocs(collection(db, 'config'));
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

    for (const configDoc of pointsDoc.docs) {
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

    tbody.innerHTML = players.map((player, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${player.name}</strong></td>
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
    `).join('');
}
