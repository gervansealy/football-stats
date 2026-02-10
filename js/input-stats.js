import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { collection, addDoc, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    const gameDateInput = document.getElementById('gameDate');
    gameDateInput.valueAsDate = new Date();

    loadPlayers();

    document.getElementById('saveStatsBtn').addEventListener('click', saveGameStats);
});

function loadPlayers() {
    const playersQuery = collection(db, 'players');
    
    onSnapshot(playersQuery, (snapshot) => {
        players = [];
        snapshot.forEach((doc) => {
            players.push({
                id: doc.id,
                ...doc.data()
            });
        });

        displayPlayerStats();
    });
}

function displayPlayerStats() {
    const container = document.getElementById('playerStatsContainer');
    const saveBtn = document.getElementById('saveStatsBtn');

    if (players.length === 0) {
        container.innerHTML = '<p class="no-data">No players added yet. Add players in the Player Profiles section.</p>';
        saveBtn.style.display = 'none';
        return;
    }

    saveBtn.style.display = 'block';

    container.innerHTML = players.map(player => `
        <div class="player-stat-card" data-player-id="${player.id}">
            <h3>${player.firstName} ${player.lastName}</h3>
            
            <div class="stat-input-group">
                <label>Wins:</label>
                <input type="number" class="stat-win" min="0" value="0">
            </div>
            
            <div class="stat-input-group">
                <label>Draws:</label>
                <input type="number" class="stat-draw" min="0" value="0">
            </div>
            
            <div class="stat-input-group">
                <label>Losses:</label>
                <input type="number" class="stat-loss" min="0" value="0">
            </div>
            
            <div class="stat-input-group">
                <label>Clean Sheet:</label>
                <input type="checkbox" class="stat-cleansheet">
            </div>
            
            <div class="stat-input-group">
                <label>Goals:</label>
                <input type="number" class="stat-goals" min="0" value="0">
            </div>
            
            <div class="stat-input-group captain-checkbox">
                <label><strong>⭐ Captain:</strong></label>
                <input type="checkbox" class="stat-captain">
            </div>
        </div>
    `).join('');
}

async function saveGameStats() {
    const gameDate = document.getElementById('gameDate').value;
    
    if (!gameDate) {
        alert('Please select a game date');
        return;
    }

    const playerStatsCards = document.querySelectorAll('.player-stat-card');
    const playerStats = {};

    playerStatsCards.forEach(card => {
        const playerId = card.dataset.playerId;
        const wins = parseInt(card.querySelector('.stat-win').value) || 0;
        const draws = parseInt(card.querySelector('.stat-draw').value) || 0;
        const losses = parseInt(card.querySelector('.stat-loss').value) || 0;
        const cleanSheet = card.querySelector('.stat-cleansheet').checked;
        const goals = parseInt(card.querySelector('.stat-goals').value) || 0;
        const isCaptain = card.querySelector('.stat-captain').checked;

        // If captain checkbox is checked, wins/draws/losses count as captain stats
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
        await addDoc(collection(db, 'games'), {
            date: gameDate,
            year: new Date(gameDate).getFullYear(),
            playerStats: playerStats,
            createdAt: new Date().toISOString()
        });

        alert('Game stats saved successfully!');
        
        playerStatsCards.forEach(card => {
            card.querySelector('.stat-win').value = 0;
            card.querySelector('.stat-draw').value = 0;
            card.querySelector('.stat-loss').value = 0;
            card.querySelector('.stat-cleansheet').checked = false;
            card.querySelector('.stat-goals').value = 0;
            card.querySelector('.stat-captain').checked = false;
        });
    } catch (error) {
        console.error('Error saving game stats:', error);
        alert('Error saving game stats. Please try again.');
    }
}
