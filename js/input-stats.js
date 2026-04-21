import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, addDoc, onSnapshot, doc, getDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players = [];
let pregameData = null;
let pregameId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    pregameId = params.get('pregame');

    if (pregameId) {
        const pgDoc = await getDoc(doc(db, 'pregames', pregameId));
        if (pgDoc.exists()) {
            pregameData = pgDoc.data();
            document.getElementById('gameDate').value = pregameData.date;
            showPregameBanner();
        } else {
            pregameId = null;
        }
    }

    if (!pregameId) {
        document.getElementById('gameDate').valueAsDate = new Date();
    }

    loadPlayers();
    document.getElementById('saveStatsBtn').addEventListener('click', saveGameStats);
});

function showPregameBanner() {
    const banner = document.getElementById('pregameBanner');
    const bannerText = document.getElementById('pregameBannerText');
    const date = new Date(pregameData.date + 'T12:00:00');
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    bannerText.textContent = `${formattedDate} — ${pregameData.redTeam.length} Red players, ${pregameData.blackTeam.length} Black players`;
    banner.style.display = 'flex';
}

function loadPlayers() {
    const container = document.getElementById('playerStatsContainer');
    container.innerHTML = '<p class="loading-message">⏳ Loading players...</p>';

    onSnapshot(collection(db, 'players'), snapshot => {
        players = [];
        snapshot.forEach(d => players.push({ id: d.id, ...d.data() }));
        displayPlayerStats();
    });
}

function renderPlayerCard(player) {
    return `
        <div class="player-stat-card" data-player-id="${player.id}">
            <div class="player-name-input">${player.firstName} ${player.lastName}</div>
            <div class="stat-inputs-row">
                <div class="stat-input-group">
                    <label>Wins</label>
                    <input type="number" class="stat-win" min="0" value="0">
                </div>
                <div class="stat-input-group">
                    <label>Draws</label>
                    <input type="number" class="stat-draw" min="0" value="0">
                </div>
                <div class="stat-input-group">
                    <label>Losses</label>
                    <input type="number" class="stat-loss" min="0" value="0">
                </div>
                <div class="stat-input-group">
                    <label>Goals</label>
                    <input type="number" class="stat-goals" min="0" value="0">
                </div>
                <div class="stat-input-group checkbox-group">
                    <label>Clean Sheet</label>
                    <input type="checkbox" class="stat-cleansheet">
                </div>
                <div class="stat-input-group checkbox-group captain-box">
                    <label>⭐ Captain</label>
                    <input type="checkbox" class="stat-captain">
                </div>
            </div>
        </div>
    `;
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

    if (pregameData) {
        const redPlayers = (pregameData.redTeam || [])
            .map(id => players.find(p => p.id === id))
            .filter(Boolean);
        const blackPlayers = (pregameData.blackTeam || [])
            .map(id => players.find(p => p.id === id))
            .filter(Boolean);

        container.className = '';
        container.innerHTML = `
            <div class="team-section">
                <div class="team-section-header red-header">🔴 Red Team</div>
                <div class="player-stats-grid">
                    ${redPlayers.map(renderPlayerCard).join('')}
                </div>
            </div>
            <div class="team-section">
                <div class="team-section-header black-header">⚫ Black Team</div>
                <div class="player-stats-grid">
                    ${blackPlayers.map(renderPlayerCard).join('')}
                </div>
            </div>
        `;
    } else {
        container.className = 'player-stats-grid';
        container.innerHTML = players.map(renderPlayerCard).join('');
    }
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

        const captainWins = isCaptain ? wins : 0;
        const captainDraws = isCaptain ? draws : 0;
        const captainLosses = isCaptain ? losses : 0;

        if (wins > 0 || draws > 0 || losses > 0 || cleanSheet || goals > 0) {
            playerStats[playerId] = {
                win: wins,
                draw: draws,
                loss: losses,
                cleanSheet,
                goals,
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
            playerStats,
            createdAt: new Date().toISOString()
        });

        if (pregameId) {
            await deleteDoc(doc(db, 'pregames', pregameId));
            alert('Game stats saved! Pre-selection moved to game history.');
            window.location.href = 'game-history.html';
        } else {
            alert('Game stats saved successfully!');
            playerStatsCards.forEach(card => {
                card.querySelector('.stat-win').value = 0;
                card.querySelector('.stat-draw').value = 0;
                card.querySelector('.stat-loss').value = 0;
                card.querySelector('.stat-cleansheet').checked = false;
                card.querySelector('.stat-goals').value = 0;
                card.querySelector('.stat-captain').checked = false;
            });
        }
    } catch (error) {
        console.error('Error saving game stats:', error);
        alert('Error saving game stats. Please try again.');
    }
}
