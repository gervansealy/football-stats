import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, addDoc, onSnapshot, doc, getDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players    = [];
let pregameData = null;
let pregameId   = null;

const TEAM_COLORS = {
    red:    { name: 'Red',    emoji: '🔴', hex: '#DC3545', bg: '#FFCDD2', text: '#B71C1C' },
    black:  { name: 'Black',  emoji: '⚫', hex: '#333333', bg: '#424242', text: '#ffffff' },
    blue:   { name: 'Blue',   emoji: '🔵', hex: '#1976D2', bg: '#BBDEFB', text: '#0D47A1' },
    green:  { name: 'Green',  emoji: '🟢', hex: '#2E7D32', bg: '#C8E6C9', text: '#1B5E20' },
    white:  { name: 'White',  emoji: '⚪', hex: '#9E9E9E', bg: '#EEEEEE', text: '#424242' },
    yellow: { name: 'Yellow', emoji: '🟡', hex: '#F9A825', bg: '#FFF9C4', text: '#F57F17' },
    orange: { name: 'Orange', emoji: '🟠', hex: '#F57C00', bg: '#FFE0B2', text: '#E65100' },
    purple: { name: 'Purple', emoji: '🟣', hex: '#7B1FA2', bg: '#E1BEE7', text: '#4A148C' },
};

// Tracks selected result per team: 'win' | 'draw' | 'loss' | null
const teamResults = { red: null, black: null };

// When Red wins → Black loses, Red draws → Black draws, etc.
const complement = { win: 'loss', draw: 'draw', loss: 'win' };

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

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
    const banner     = document.getElementById('pregameBanner');
    const bannerText = document.getElementById('pregameBannerText');
    const date       = new Date(pregameData.date + 'T12:00:00');
    const formatted  = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const t1Name = TEAM_COLORS[pregameData.team1Color]?.name || 'Red';
    const t2Name = TEAM_COLORS[pregameData.team2Color]?.name || 'Black';
    bannerText.textContent = `${formatted} — ${pregameData.redTeam.length} ${t1Name} players, ${pregameData.blackTeam.length} ${t2Name} players`;
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

// ── Render helpers ────────────────────────────────

function renderPlayerCard(player) {
    return `
        <div class="player-stat-card" data-player-id="${player.id}">
            <div class="player-name-input">${player.firstName} ${player.lastName}</div>
            <div class="stat-inputs-row">
                <div class="stat-input-group">
                    <label>Goals</label>
                    <input type="number" class="stat-goals" min="0" value="0">
                </div>
                <div class="stat-input-group">
                    <label>Own Goals</label>
                    <input type="number" class="stat-owngoals" min="0" value="0">
                </div>
                <div class="stat-input-group checkbox-group">
                    <label>Clean Sheet</label>
                    <input type="checkbox" class="stat-cleansheet">
                </div>
            </div>
        </div>
    `;
}

function renderTeamControls(team, teamPlayers, captainId) {
    const playerOptions = teamPlayers.map(p =>
        `<option value="${p.id}" ${p.id === captainId ? 'selected' : ''}>${p.firstName} ${p.lastName}</option>`
    ).join('');

    return `
        <div class="team-controls" data-team-controls="${team}">
            <div class="team-control-item">
                <span class="control-label">Result</span>
                <div class="result-btn-group">
                    <button type="button" class="result-btn win-btn"  onclick="setTeamResult('${team}','win',this)">🏆 Win</button>
                    <button type="button" class="result-btn draw-btn" onclick="setTeamResult('${team}','draw',this)">🤝 Draw</button>
                    <button type="button" class="result-btn loss-btn" onclick="setTeamResult('${team}','loss',this)">📉 Loss</button>
                </div>
            </div>
            <div class="team-control-item">
                <label class="control-label" for="${team}CaptainSelect">⭐ Captain</label>
                <select id="${team}CaptainSelect" class="captain-select">
                    <option value="">— None —</option>
                    ${playerOptions}
                </select>
            </div>
        </div>
    `;
}

function renderTeamSection(team, teamPlayers, captainId, colorKey) {
    const isRed   = team === 'red';
    const defKey  = isRed ? 'red' : 'black';
    const c       = TEAM_COLORS[colorKey] || TEAM_COLORS[defKey];
    const label   = `${c.emoji} ${c.name} Team`;

    return `
        <div class="team-section" data-team="${team}">
            <div class="team-section-header" style="background:${c.bg};color:${c.text};">${label}</div>
            ${renderTeamControls(team, teamPlayers, captainId)}
            <div class="player-stats-grid">
                ${teamPlayers.map(renderPlayerCard).join('')}
            </div>
        </div>
    `;
}

function renderLiveScore() {
    const t1Name = capitalize(pregameData?.team1Color || 'Red');
    const t2Name = capitalize(pregameData?.team2Color || 'Black');
    return `
        <div id="liveScoreDisplay" class="live-score-display">
            <div class="lsd-label">Final Score</div>
            <div class="lsd-row">
                <span class="lsd-team">${t1Name}</span>
                <span class="lsd-num" id="lsdTeam1">0</span>
                <span class="lsd-sep">–</span>
                <span class="lsd-num" id="lsdTeam2">0</span>
                <span class="lsd-team">${t2Name}</span>
            </div>
        </div>
    `;
}

function updateLiveScore() {
    const el1 = document.getElementById('lsdTeam1');
    const el2 = document.getElementById('lsdTeam2');
    if (!el1 || !el2) return;

    let redGoals = 0, redOwnGoals = 0, blackGoals = 0, blackOwnGoals = 0;

    document.querySelector('.team-section[data-team="red"]')?.querySelectorAll('.player-stat-card').forEach(card => {
        redGoals    += parseInt(card.querySelector('.stat-goals').value)    || 0;
        redOwnGoals += parseInt(card.querySelector('.stat-owngoals').value) || 0;
    });
    document.querySelector('.team-section[data-team="black"]')?.querySelectorAll('.player-stat-card').forEach(card => {
        blackGoals    += parseInt(card.querySelector('.stat-goals').value)    || 0;
        blackOwnGoals += parseInt(card.querySelector('.stat-owngoals').value) || 0;
    });

    el1.textContent = redGoals   + blackOwnGoals;
    el2.textContent = blackGoals + redOwnGoals;
}

// ── Team result buttons ───────────────────────────

window.setTeamResult = function (team, result, btn) {
    // Set this team's result
    teamResults[team] = result;
    const group = btn.closest('.result-btn-group');
    group.querySelectorAll('.result-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Auto-set the complementary result on the other team
    const other       = team === 'red' ? 'black' : 'red';
    const otherResult = complement[result];
    teamResults[other] = otherResult;
    const otherGroup = document.querySelector(`[data-team-controls="${other}"] .result-btn-group`);
    if (otherGroup) {
        otherGroup.querySelectorAll('.result-btn').forEach(b => b.classList.remove('active'));
        const otherBtn = otherGroup.querySelector(`.${otherResult}-btn`);
        if (otherBtn) otherBtn.classList.add('active');
    }
};

// ── Non-pregame: assign players to teams ──────────

window.assignToTeam = function (playerId, team) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Remove from whichever team section already has this player
    ['red', 'black'].forEach(t => {
        document.querySelector(`.team-section[data-team="${t}"] .player-stat-card[data-player-id="${playerId}"]`)?.remove();
        const opt = document.querySelector(`#${t}CaptainSelect option[value="${playerId}"]`);
        if (opt) opt.remove();
    });

    if (team === 'none') {
        document.getElementById(`urow-${playerId}`)?.classList.remove('assigned-to-red', 'assigned-to-black');
        return;
    }

    // Add card to target team grid
    const grid = document.querySelector(`.team-section[data-team="${team}"] .player-stats-grid`);
    if (grid) grid.insertAdjacentHTML('beforeend', renderPlayerCard(player));

    // Add to captain dropdown
    const sel = document.getElementById(`${team}CaptainSelect`);
    if (sel) {
        const opt = document.createElement('option');
        opt.value       = playerId;
        opt.textContent = `${player.firstName} ${player.lastName}`;
        sel.appendChild(opt);
    }

    // Highlight unassigned row
    const row = document.getElementById(`urow-${playerId}`);
    if (row) {
        row.classList.remove('assigned-to-red', 'assigned-to-black');
        row.classList.add(`assigned-to-${team}`);
    }

    updateLiveScore();
};

// ── Display ───────────────────────────────────────

function displayPlayerStats() {
    const container = document.getElementById('playerStatsContainer');
    const saveBtn   = document.getElementById('saveStatsBtn');

    if (players.length === 0) {
        container.innerHTML = '<p class="no-data">No players added yet. Add players in the Player Profiles section.</p>';
        saveBtn.style.display = 'none';
        return;
    }

    saveBtn.style.display = 'block';
    container.className   = '';

    if (pregameData) {
        const redPlayers   = (pregameData.redTeam   || []).map(id => players.find(p => p.id === id)).filter(Boolean);
        const blackPlayers = (pregameData.blackTeam || []).map(id => players.find(p => p.id === id)).filter(Boolean);

        container.innerHTML =
            renderTeamSection('red',   redPlayers,   pregameData.redCaptain   || '', pregameData.team1Color) +
            renderLiveScore() +
            renderTeamSection('black', blackPlayers, pregameData.blackCaptain || '', pregameData.team2Color);

    } else {
        // No pregame — two empty sections + player assignment pool
        container.innerHTML = `
            <div class="no-pregame-notice">
                ℹ️ No pre-selection loaded. Assign players to teams below, or
                <a href="team-selection.html">create a pre-selection</a> for a faster workflow.
            </div>
            ${renderTeamSection('red',   [], '', 'red')}
            ${renderLiveScore()}
            ${renderTeamSection('black', [], '', 'black')}
            <div class="unassigned-pool">
                <div class="unassigned-pool-title">Players — assign to a team</div>
                ${players.map(p => `
                    <div class="unassigned-row" id="urow-${p.id}">
                        <span class="unassigned-name">${p.firstName} ${p.lastName}</span>
                        <div class="assign-btns">
                            <button type="button" class="assign-btn assign-red"   onclick="assignToTeam('${p.id}','red')">Red</button>
                            <button type="button" class="assign-btn assign-black" onclick="assignToTeam('${p.id}','black')">Black</button>
                            <button type="button" class="assign-btn assign-none"  onclick="assignToTeam('${p.id}','none')">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Live score updates via event delegation
    container.addEventListener('input', e => {
        if (e.target.matches('.stat-goals, .stat-owngoals')) updateLiveScore();
    });
}

// ── Save ──────────────────────────────────────────

async function saveGameStats() {
    const gameDate = document.getElementById('gameDate').value;
    if (!gameDate) { alert('Please select a game date'); return; }

    const t1DisplayName = TEAM_COLORS[pregameData?.team1Color]?.name || 'Red';
    const t2DisplayName = TEAM_COLORS[pregameData?.team2Color]?.name || 'Black';

    if (!teamResults.red)   { alert(`Please select a result for ${t1DisplayName} Team`);   return; }
    if (!teamResults.black) { alert(`Please select a result for ${t2DisplayName} Team`); return; }

    const playerStats = {};
    const teamArrays  = { red: [], black: [] };
    const captainIds  = { red: '', black: '' };

    ['red', 'black'].forEach(team => {
        const result    = teamResults[team];
        captainIds[team] = document.getElementById(`${team}CaptainSelect`)?.value || '';
        const section   = document.querySelector(`.team-section[data-team="${team}"]`);
        if (!section) return;

        section.querySelectorAll('.player-stat-card').forEach(card => {
            const playerId   = card.dataset.playerId;
            const goals      = parseInt(card.querySelector('.stat-goals').value)    || 0;
            const ownGoals   = parseInt(card.querySelector('.stat-owngoals').value) || 0;
            const cleanSheet = card.querySelector('.stat-cleansheet').checked;
            const isCaptain  = playerId === captainIds[team];

            teamArrays[team].push(playerId);

            playerStats[playerId] = {
                win:         result === 'win'  ? 1 : 0,
                draw:        result === 'draw' ? 1 : 0,
                loss:        result === 'loss' ? 1 : 0,
                goals,
                ownGoals,
                cleanSheet,
                captainWin:  isCaptain && result === 'win'  ? 1 : 0,
                captainDraw: isCaptain && result === 'draw' ? 1 : 0,
                captainLoss: isCaptain && result === 'loss' ? 1 : 0,
            };
        });
    });

    if (Object.keys(playerStats).length === 0) {
        alert('Please assign players to teams before saving.');
        return;
    }

    // Compute final score: own goals count for the opposing team
    let team1Score = 0, team2Score = 0;
    teamArrays.red.forEach(id => {
        team1Score += playerStats[id]?.goals    || 0;
        team2Score += playerStats[id]?.ownGoals || 0;
    });
    teamArrays.black.forEach(id => {
        team2Score += playerStats[id]?.goals    || 0;
        team1Score += playerStats[id]?.ownGoals || 0;
    });

    const t1Name = capitalize(pregameData?.team1Color || 'Red');
    const t2Name = capitalize(pregameData?.team2Color || 'Black');

    try {
        await addDoc(collection(db, 'games'), {
            date:         gameDate,
            year:         new Date(gameDate).getFullYear(),
            playerStats,
            redTeam:      teamArrays.red,
            blackTeam:    teamArrays.black,
            redCaptain:   captainIds.red   || null,
            blackCaptain: captainIds.black || null,
            lineupId:     pregameId        || null,
            team1Color:   pregameData?.team1Color || 'red',
            team2Color:   pregameData?.team2Color || 'black',
            score:        { team1: team1Score, team2: team2Score },
            createdAt:    new Date().toISOString()
        });

        if (pregameId) {
            await deleteDoc(doc(db, 'pregames', pregameId));
            alert(`Game stats saved!\nFinal Score: ${t1Name} ${team1Score} – ${t2Name} ${team2Score}`);
            window.location.href = 'game-history.html';
        } else {
            alert(`Game stats saved!\nFinal Score: ${t1Name} ${team1Score} – ${t2Name} ${team2Score}`);
            window.location.reload();
        }
    } catch (error) {
        console.error('Error saving game stats:', error);
        alert('Error saving game stats. Please try again.');
    }
}
