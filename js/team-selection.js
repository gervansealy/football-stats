import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, addDoc, getDocs, onSnapshot,
    doc, updateDoc, deleteDoc, getDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players = [];
let lineupStatusCache = {};   // { pregameId: lineupDoc data }
let currentPregames   = [];

// ── OTP generator (avoids ambiguous chars) ──────────
function generateOTP() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let otp = '';
    for (let i = 0; i < 6; i++) otp += chars[Math.floor(Math.random() * chars.length)];
    return otp;
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    await loadPlayers();

    // Real-time lineup status
    onSnapshot(collection(db, 'lineups'), snap => {
        lineupStatusCache = {};
        snap.forEach(d => { lineupStatusCache[d.id] = d.data(); });
        renderPregameCards();
    });

    // Real-time pregames
    const q = query(collection(db, 'pregames'), orderBy('date', 'desc'));
    onSnapshot(q, snap => {
        currentPregames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPregameCards();
    });

    document.getElementById('newPregameBtn').addEventListener('click', openNewPregameModal);
});

// ── Players ─────────────────────────────────────────
async function loadPlayers() {
    const snapshot = await getDocs(collection(db, 'players'));
    players = [];
    snapshot.forEach(d => players.push({ id: d.id, ...d.data() }));
    players.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
}

// ── Render cards ────────────────────────────────────
function renderPregameCards() {
    const container = document.getElementById('pregamesContainer');

    if (currentPregames.length === 0) {
        container.innerHTML = '<p class="no-data">No pre-selections yet. Click "+ New Pre-Selection" to get started.</p>';
        return;
    }

    container.innerHTML = currentPregames.map(pg => {
        const date = new Date(pg.date + 'T12:00:00');
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });

        const redNames = (pg.redTeam || []).map(id => {
            const p = players.find(pl => pl.id === id);
            return p ? `${p.firstName} ${p.lastName}` : '?';
        }).join(', ') || 'None selected';

        const blackNames = (pg.blackTeam || []).map(id => {
            const p = players.find(pl => pl.id === id);
            return p ? `${p.firstName} ${p.lastName}` : '?';
        }).join(', ') || 'None selected';

        const ld = lineupStatusCache[pg.id] || {};
        const redDone   = ld.redSubmitted   || false;
        const blackDone = ld.blackSubmitted || false;

        const baseURL = window.location.href.replace(/[^/]*$/, '');

        return `
            <div class="pregame-card">
                <div class="pregame-card-header">
                    <h3>📅 ${formattedDate}</h3>
                    <div class="game-card-actions">
                        <button class="btn-edit-small" onclick="openEditPregameModal('${pg.id}')" title="Edit">✏️</button>
                        <button class="btn-delete-small" onclick="deletePregame('${pg.id}', '${formattedDate}')" title="Delete">🗑️</button>
                    </div>
                </div>

                <div class="pregame-teams">
                    <div class="team-preview red-team-preview">
                        <span class="team-label-badge red">🔴 Red Team</span>
                        <p>${redNames}</p>
                    </div>
                    <div class="team-preview black-team-preview">
                        <span class="team-label-badge black">⚫ Black Team</span>
                        <p>${blackNames}</p>
                    </div>
                </div>

                <div class="otp-badges">
                    <div class="otp-badge red">
                        <span class="otp-badge-label">🔴</span>
                        <span class="otp-badge-code">${pg.redOTP || '—'}</span>
                        <button class="btn-copy-otp" onclick="copyLineupLink('${baseURL}lineup.html?otp=${pg.redOTP}', this)">Copy Link</button>
                    </div>
                    <div class="otp-badge black">
                        <span class="otp-badge-label">⚫</span>
                        <span class="otp-badge-code">${pg.blackOTP || '—'}</span>
                        <button class="btn-copy-otp" onclick="copyLineupLink('${baseURL}lineup.html?otp=${pg.blackOTP}', this)">Copy Link</button>
                    </div>
                </div>

                <div class="lineup-status-badges">
                    <span class="lineup-status-badge ${redDone   ? 'done' : 'pending'}">🔴 ${redDone   ? '✓ Lineup Set' : '⏳ Lineup Pending'}</span>
                    <span class="lineup-status-badge ${blackDone ? 'done' : 'pending'}">⚫ ${blackDone ? '✓ Lineup Set' : '⏳ Lineup Pending'}</span>
                </div>

                <div class="pregame-card-footer" style="gap:8px; justify-content:space-between; align-items:center;">
                    <a href="lineup.html?view=${pg.id}" class="btn-view-lineup" target="_blank">📋 View Lineup</a>
                    <a href="input-stats.html?pregame=${pg.id}" class="btn-enter-stats">Enter Stats →</a>
                </div>
            </div>
        `;
    }).join('');
}

// ── Copy link helper ─────────────────────────────────
window.copyLineupLink = function (url, btn) {
    navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1800);
    });
};

// ── Checkbox builder ─────────────────────────────────
function buildPlayerCheckboxes(containerId, selectedIds = []) {
    const container = document.getElementById(containerId);
    if (players.length === 0) {
        container.innerHTML = '<p style="padding:8px;color:var(--text-secondary);font-size:13px;">No players found.</p>';
        return;
    }
    container.innerHTML = players.map(p => `
        <label class="player-checkbox-label" data-name="${p.firstName} ${p.lastName}">
            <input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}>
            ${p.firstName} ${p.lastName}
        </label>
    `).join('');
}

function wireSearchInput(searchId, listId) {
    const input = document.getElementById(searchId);
    input.value = '';
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        document.getElementById(listId).querySelectorAll('.player-checkbox-label').forEach(label => {
            label.style.display = label.dataset.name.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

// ── New pregame ──────────────────────────────────────
function openNewPregameModal() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('pregameDate').value = `${today.getFullYear()}-${mm}-${dd}`;
    buildPlayerCheckboxes('redTeamCheckboxes');
    buildPlayerCheckboxes('blackTeamCheckboxes');
    wireSearchInput('redTeamSearch', 'redTeamCheckboxes');
    wireSearchInput('blackTeamSearch', 'blackTeamCheckboxes');
    document.getElementById('pregameModal').style.display = 'block';
}

window.savePregame = async function () {
    const date = document.getElementById('pregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam   = getCheckedIds('redTeamCheckboxes');
    const blackTeam = getCheckedIds('blackTeamCheckboxes');

    if (redTeam.length === 0)   { alert('Please select at least one player for Red Team');   return; }
    if (blackTeam.length === 0) { alert('Please select at least one player for Black Team'); return; }

    const overlap = redTeam.filter(id => blackTeam.includes(id));
    if (overlap.length > 0) { alert('A player cannot be on both teams'); return; }

    // Build name maps for the lineup page (public, no auth)
    const redTeamNames = {}, blackTeamNames = {};
    redTeam.forEach(id => {
        const p = players.find(pl => pl.id === id);
        if (p) redTeamNames[id] = `${p.firstName} ${p.lastName}`;
    });
    blackTeam.forEach(id => {
        const p = players.find(pl => pl.id === id);
        if (p) blackTeamNames[id] = `${p.firstName} ${p.lastName}`;
    });

    try {
        await addDoc(collection(db, 'pregames'), {
            date,
            redTeam,
            blackTeam,
            redTeamNames,
            blackTeamNames,
            redOTP:   generateOTP(),
            blackOTP: generateOTP(),
            createdAt: new Date().toISOString(),
        });
        document.getElementById('pregameModal').style.display = 'none';
    } catch (error) {
        alert('Error saving pre-selection: ' + error.message);
    }
};

// ── Edit pregame ─────────────────────────────────────
window.openEditPregameModal = async function (pregameId) {
    const pgDoc = await getDoc(doc(db, 'pregames', pregameId));
    if (!pgDoc.exists()) return;

    const pg = pgDoc.data();
    document.getElementById('editPregameId').value  = pregameId;
    document.getElementById('editPregameDate').value = pg.date;
    buildPlayerCheckboxes('editRedTeamCheckboxes',   pg.redTeam   || []);
    buildPlayerCheckboxes('editBlackTeamCheckboxes', pg.blackTeam || []);
    wireSearchInput('editRedTeamSearch',   'editRedTeamCheckboxes');
    wireSearchInput('editBlackTeamSearch', 'editBlackTeamCheckboxes');
    document.getElementById('editPregameModal').style.display = 'block';
};

window.saveEditPregame = async function () {
    const pregameId = document.getElementById('editPregameId').value;
    const date      = document.getElementById('editPregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam   = getCheckedIds('editRedTeamCheckboxes');
    const blackTeam = getCheckedIds('editBlackTeamCheckboxes');

    if (redTeam.length === 0)   { alert('Please select at least one player for Red Team');   return; }
    if (blackTeam.length === 0) { alert('Please select at least one player for Black Team'); return; }

    const overlap = redTeam.filter(id => blackTeam.includes(id));
    if (overlap.length > 0) { alert('A player cannot be on both teams'); return; }

    const redTeamNames = {}, blackTeamNames = {};
    redTeam.forEach(id => {
        const p = players.find(pl => pl.id === id);
        if (p) redTeamNames[id] = `${p.firstName} ${p.lastName}`;
    });
    blackTeam.forEach(id => {
        const p = players.find(pl => pl.id === id);
        if (p) blackTeamNames[id] = `${p.firstName} ${p.lastName}`;
    });

    try {
        await updateDoc(doc(db, 'pregames', pregameId), {
            date,
            redTeam,
            blackTeam,
            redTeamNames,
            blackTeamNames,
            updatedAt: new Date().toISOString(),
        });
        document.getElementById('editPregameModal').style.display = 'none';
    } catch (error) {
        alert('Error updating pre-selection: ' + error.message);
    }
};

// ── Delete pregame ───────────────────────────────────
window.deletePregame = async function (pregameId, formattedDate) {
    if (!confirm(`Delete pre-selection for ${formattedDate}? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, 'pregames', pregameId));
    } catch (error) {
        alert('Error deleting pre-selection: ' + error.message);
    }
};

// ── Helpers ──────────────────────────────────────────
function getCheckedIds(containerId) {
    return Array.from(
        document.getElementById(containerId).querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);
}

window.closePregameModal     = () => { document.getElementById('pregameModal').style.display     = 'none'; };
window.closeEditPregameModal = () => { document.getElementById('editPregameModal').style.display = 'none'; };
