import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, addDoc, getDocs, onSnapshot,
    doc, updateDoc, deleteDoc, getDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players = [];
let lineupStatusCache = {};
let currentPregames   = [];
let isAdmin = false;

const teamDataCache = {};

const TEAM_COLORS = {
    //                                                              text = on-badge  darkText = on-light-bg
    red:    { name: 'Red',    emoji: '🔴', hex: '#DC3545', bg: '#FFCDD2', text: '#B71C1C', darkText: '#B71C1C', lightBg: '#FFF0F0', border: '#FFCDD2' },
    black:  { name: 'Black',  emoji: '⚫', hex: '#333333', bg: '#424242', text: '#ffffff', darkText: '#212121', lightBg: '#F5F5F5', border: '#E0E0E0' },
    blue:   { name: 'Blue',   emoji: '🔵', hex: '#1976D2', bg: '#BBDEFB', text: '#0D47A1', darkText: '#0D47A1', lightBg: '#E3F2FD', border: '#90CAF9' },
    green:  { name: 'Green',  emoji: '🟢', hex: '#2E7D32', bg: '#C8E6C9', text: '#1B5E20', darkText: '#1B5E20', lightBg: '#E8F5E9', border: '#A5D6A7' },
    white:  { name: 'White',  emoji: '⚪', hex: '#9E9E9E', bg: '#EEEEEE', text: '#424242', darkText: '#424242', lightBg: '#FAFAFA', border: '#BDBDBD' },
    yellow: { name: 'Yellow', emoji: '🟡', hex: '#F9A825', bg: '#FFF9C4', text: '#F57F17', darkText: '#F57F17', lightBg: '#FFFDE7', border: '#FFF176' },
    orange: { name: 'Orange', emoji: '🟠', hex: '#F57C00', bg: '#FFE0B2', text: '#E65100', darkText: '#E65100', lightBg: '#FFF3E0', border: '#FFCC80' },
    purple: { name: 'Purple', emoji: '🟣', hex: '#7B1FA2', bg: '#E1BEE7', text: '#4A148C', darkText: '#4A148C', lightBg: '#F3E5F5', border: '#CE93D8' },
};

let newTeam1Color  = 'red';
let newTeam2Color  = 'black';
let editTeam1Color = 'red';
let editTeam2Color = 'black';

// ── OTP generator ────────────────────────────────────
function generateOTP() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let otp = '';
    for (let i = 0; i < 6; i++) otp += chars[Math.floor(Math.random() * chars.length)];
    return otp;
}

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    isAdmin = authData.role === 'admin';

    if (!isAdmin) {
        document.getElementById('newPregameBtn').style.display = 'none';
    }

    await loadPlayers();

    onSnapshot(collection(db, 'lineups'), snap => {
        lineupStatusCache = {};
        snap.forEach(d => { lineupStatusCache[d.id] = d.data(); });
        renderPregameCards();
    });

    const q = query(collection(db, 'pregames'), orderBy('date', 'desc'));
    onSnapshot(q, snap => {
        currentPregames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPregameCards();
    });

    document.getElementById('newPregameBtn').addEventListener('click', openNewPregameModal);
});

// ── Players ──────────────────────────────────────────
async function loadPlayers() {
    const snapshot = await getDocs(collection(db, 'players'));
    players = [];
    snapshot.forEach(d => players.push({ id: d.id, ...d.data() }));
    players.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
}

// ── Color picker ──────────────────────────────────────
function initColorPicker(swatchesId, labelId, defaultColor, onPick) {
    const swatchesEl = document.getElementById(swatchesId);
    const labelEl    = document.getElementById(labelId);

    function applyColor(colorKey) {
        const c = TEAM_COLORS[colorKey];
        swatchesEl.querySelectorAll('.color-swatch').forEach(s =>
            s.classList.toggle('active', s.dataset.color === colorKey)
        );
        labelEl.textContent        = `${c.emoji} ${c.name} Team`;
        labelEl.style.background   = c.bg;
        labelEl.style.color        = c.text;
        onPick(colorKey);
    }

    swatchesEl.innerHTML = Object.entries(TEAM_COLORS).map(([key, c]) =>
        `<span class="color-swatch${key === defaultColor ? ' active' : ''}" data-color="${key}" style="background:${c.hex}" title="${c.name}"></span>`
    ).join('');

    swatchesEl.querySelectorAll('.color-swatch').forEach(s =>
        s.addEventListener('click', () => applyColor(s.dataset.color))
    );

    applyColor(defaultColor);
}

// ── Render cards ─────────────────────────────────────
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

        const redPlayers   = (pg.redTeam   || []).map(id => ({ id, name: (pg.redTeamNames   || {})[id] || id }));
        const blackPlayers = (pg.blackTeam || []).map(id => ({ id, name: (pg.blackTeamNames || {})[id] || id }));

        const t1Key = pg.team1Color || 'red';
        const t2Key = pg.team2Color || 'black';
        const t1    = TEAM_COLORS[t1Key] || TEAM_COLORS.red;
        const t2    = TEAM_COLORS[t2Key] || TEAM_COLORS.black;

        teamDataCache[pg.id] = {
            red: redPlayers, black: blackPlayers,
            redCaptain: pg.redCaptain || null, blackCaptain: pg.blackCaptain || null,
            team1Color: t1Key, team2Color: t2Key,
        };

        const redCaptainName   = pg.redCaptain   ? (pg.redTeamNames   || {})[pg.redCaptain]   || '' : '';
        const blackCaptainName = pg.blackCaptain ? (pg.blackTeamNames || {})[pg.blackCaptain] || '' : '';

        const ld        = lineupStatusCache[pg.id] || {};
        const redDone   = ld.redSubmitted   || false;
        const blackDone = ld.blackSubmitted || false;

        const baseURL = window.location.href.replace(/[^/]*$/, '');

        const adminControls = isAdmin ? `
            <div class="otp-badges">
                <div class="otp-badge" style="background:${t1.lightBg};border:1px solid ${t1.border};">
                    <span class="otp-badge-label">${t1.emoji}</span>
                    <span class="otp-badge-code" style="color:${t1.darkText};">${pg.redOTP || '—'}</span>
                    <button class="btn-copy-otp" onclick="copyLineupLink('${baseURL}lineup.html?otp=${pg.redOTP}', this)">Copy Link</button>
                </div>
                <div class="otp-badge" style="background:${t2.lightBg};border:1px solid ${t2.border};">
                    <span class="otp-badge-label">${t2.emoji}</span>
                    <span class="otp-badge-code" style="color:${t2.darkText};">${pg.blackOTP || '—'}</span>
                    <button class="btn-copy-otp" onclick="copyLineupLink('${baseURL}lineup.html?otp=${pg.blackOTP}', this)">Copy Link</button>
                </div>
            </div>
        ` : '';

        const adminFooterExtra = isAdmin
            ? `<a href="input-stats.html?pregame=${pg.id}" class="btn-enter-stats">Enter Stats →</a>`
            : '';

        const adminCardActions = isAdmin ? `
            <div class="game-card-actions">
                <button class="btn-edit-small" onclick="openEditPregameModal('${pg.id}')" title="Edit">✏️</button>
                <button class="btn-delete-small" onclick="deletePregame('${pg.id}', '${formattedDate}')" title="Delete">🗑️</button>
            </div>
        ` : '';

        return `
            <div class="pregame-card">
                <div class="pregame-card-header">
                    <h3>📅 ${formattedDate}</h3>
                    ${adminCardActions}
                </div>

                <div class="pregame-teams">
                    <div class="team-preview" style="background:${t1.lightBg};border:1px solid ${t1.border};">
                        <button class="team-label-badge team-label-btn" style="background:${t1.bg};color:${t1.text};" onclick="showTeamPlayers('${pg.id}','red')">
                            ${t1.emoji} ${t1.name} Team <span class="team-player-count">${redPlayers.length}</span>
                        </button>
                        ${redCaptainName ? `<p class="captain-display" style="color:${t1.darkText};">⭐ Captain: ${redCaptainName}</p>` : ''}
                    </div>
                    <div class="team-preview" style="background:${t2.lightBg};border:1px solid ${t2.border};">
                        <button class="team-label-badge team-label-btn" style="background:${t2.bg};color:${t2.text};" onclick="showTeamPlayers('${pg.id}','black')">
                            ${t2.emoji} ${t2.name} Team <span class="team-player-count">${blackPlayers.length}</span>
                        </button>
                        ${blackCaptainName ? `<p class="captain-display" style="color:${t2.darkText};">⭐ Captain: ${blackCaptainName}</p>` : ''}
                    </div>
                </div>

                <div class="lineup-status-badges">
                    <span class="lineup-status-badge ${redDone   ? 'done' : 'pending'}">${t1.emoji} ${redDone   ? '✓ Lineup Set' : '⏳ Lineup Pending'}</span>
                    <span class="lineup-status-badge ${blackDone ? 'done' : 'pending'}">${t2.emoji} ${blackDone ? '✓ Lineup Set' : '⏳ Lineup Pending'}</span>
                </div>

                ${adminControls}

                <div class="pregame-card-footer" style="gap:8px; justify-content:space-between; align-items:center;">
                    <a href="lineup.html?view=${pg.id}" class="btn-view-lineup" target="_blank">📋 View Lineup</a>
                    ${adminFooterExtra}
                </div>
            </div>
        `;
    }).join('');
}

// ── Team player popup ─────────────────────────────────
window.showTeamPlayers = function (pregameId, team) {
    const data = teamDataCache[pregameId];
    if (!data) return;

    const captainId   = team === 'red' ? data.redCaptain : data.blackCaptain;
    const teamPlayers = [...(data[team] || [])].sort((a, b) => {
        if (a.id === captainId) return -1;
        if (b.id === captainId) return 1;
        return 0;
    });

    const colorKey = team === 'red' ? (data.team1Color || 'red') : (data.team2Color || 'black');
    const c        = TEAM_COLORS[colorKey] || TEAM_COLORS.red;

    document.getElementById('teamPopupTitle').textContent = `${c.emoji} ${c.name} Team`;
    document.getElementById('teamPopupList').innerHTML = teamPlayers.length
        ? teamPlayers.map(p => `
            <li class="${p.id === captainId ? 'popup-captain' : ''}">
                ${p.id === captainId ? '⭐ ' : ''}<strong>${p.name}</strong>
                ${p.id === captainId ? '<span class="popup-captain-badge">Captain</span>' : ''}
            </li>
          `).join('')
        : '<li style="color:var(--text-secondary)">No players selected</li>';

    document.getElementById('teamPlayerPopup').style.display = 'flex';
};

window.closeTeamPlayerPopup = function () {
    document.getElementById('teamPlayerPopup').style.display = 'none';
};

// ── Copy link helper ──────────────────────────────────
window.copyLineupLink = function (url, btn) {
    navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1800);
    });
};

// ── Checkbox + captain builder ────────────────────────
function buildPlayerCheckboxes(containerId, captainSelectId, selectedIds = [], captainId = '') {
    const container = document.getElementById(containerId);
    if (players.length === 0) {
        container.innerHTML = '<p style="padding:8px;color:var(--text-secondary);font-size:13px;">No players found.</p>';
        return;
    }
    container.innerHTML = players.map(p => `
        <label class="player-checkbox-label" data-name="${p.firstName} ${p.lastName}" data-id="${p.id}">
            <input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}>
            ${p.firstName} ${p.lastName}
        </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => refreshCaptainSelect(containerId, captainSelectId));
    });

    refreshCaptainSelect(containerId, captainSelectId, captainId);
}

function refreshCaptainSelect(checkboxListId, captainSelectId, preselect = '') {
    const checked = Array.from(
        document.getElementById(checkboxListId).querySelectorAll('input[type="checkbox"]:checked')
    );
    const current = preselect || document.getElementById(captainSelectId)?.value || '';
    const select  = document.getElementById(captainSelectId);
    if (!select) return;

    select.innerHTML = '<option value="">— Select Captain —</option>' +
        checked.map(cb => {
            const label = cb.closest('.player-checkbox-label');
            const name  = label ? label.dataset.name : cb.value;
            return `<option value="${cb.value}" ${cb.value === current ? 'selected' : ''}>${name}</option>`;
        }).join('');
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

// ── New pregame ───────────────────────────────────────
function openNewPregameModal() {
    newTeam1Color = 'red';
    newTeam2Color = 'black';

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('pregameDate').value = `${today.getFullYear()}-${mm}-${dd}`;

    buildPlayerCheckboxes('redTeamCheckboxes',   'redCaptain');
    buildPlayerCheckboxes('blackTeamCheckboxes', 'blackCaptain');
    wireSearchInput('redTeamSearch',   'redTeamCheckboxes');
    wireSearchInput('blackTeamSearch', 'blackTeamCheckboxes');

    initColorPicker('newTeam1Swatches', 'newTeam1Label', 'red',   c => { newTeam1Color = c; });
    initColorPicker('newTeam2Swatches', 'newTeam2Label', 'black', c => { newTeam2Color = c; });

    document.getElementById('pregameModal').style.display = 'block';
}

window.savePregame = async function () {
    const date = document.getElementById('pregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam   = getCheckedIds('redTeamCheckboxes');
    const blackTeam = getCheckedIds('blackTeamCheckboxes');

    const t1Name = TEAM_COLORS[newTeam1Color].name;
    const t2Name = TEAM_COLORS[newTeam2Color].name;

    if (redTeam.length === 0)   { alert(`Please select at least one player for ${t1Name} Team`);   return; }
    if (blackTeam.length === 0) { alert(`Please select at least one player for ${t2Name} Team`); return; }

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

    const redCaptain   = document.getElementById('redCaptain').value   || null;
    const blackCaptain = document.getElementById('blackCaptain').value || null;

    try {
        await addDoc(collection(db, 'pregames'), {
            date, redTeam, blackTeam, redTeamNames, blackTeamNames,
            redCaptain, blackCaptain,
            team1Color: newTeam1Color, team2Color: newTeam2Color,
            redOTP: generateOTP(), blackOTP: generateOTP(),
            createdAt: new Date().toISOString(),
        });
        document.getElementById('pregameModal').style.display = 'none';
    } catch (error) {
        alert('Error saving pre-selection: ' + error.message);
    }
};

// ── Edit pregame ──────────────────────────────────────
window.openEditPregameModal = async function (pregameId) {
    const pgDoc = await getDoc(doc(db, 'pregames', pregameId));
    if (!pgDoc.exists()) return;

    const pg = pgDoc.data();
    editTeam1Color = pg.team1Color || 'red';
    editTeam2Color = pg.team2Color || 'black';

    document.getElementById('editPregameId').value   = pregameId;
    document.getElementById('editPregameDate').value = pg.date;

    buildPlayerCheckboxes('editRedTeamCheckboxes',   'editRedCaptain',   pg.redTeam   || [], pg.redCaptain   || '');
    buildPlayerCheckboxes('editBlackTeamCheckboxes', 'editBlackCaptain', pg.blackTeam || [], pg.blackCaptain || '');
    wireSearchInput('editRedTeamSearch',   'editRedTeamCheckboxes');
    wireSearchInput('editBlackTeamSearch', 'editBlackTeamCheckboxes');

    initColorPicker('editTeam1Swatches', 'editTeam1Label', editTeam1Color, c => { editTeam1Color = c; });
    initColorPicker('editTeam2Swatches', 'editTeam2Label', editTeam2Color, c => { editTeam2Color = c; });

    document.getElementById('editPregameModal').style.display = 'block';
};

window.saveEditPregame = async function () {
    const pregameId = document.getElementById('editPregameId').value;
    const date      = document.getElementById('editPregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam   = getCheckedIds('editRedTeamCheckboxes');
    const blackTeam = getCheckedIds('editBlackTeamCheckboxes');

    const t1Name = TEAM_COLORS[editTeam1Color].name;
    const t2Name = TEAM_COLORS[editTeam2Color].name;

    if (redTeam.length === 0)   { alert(`Please select at least one player for ${t1Name} Team`);   return; }
    if (blackTeam.length === 0) { alert(`Please select at least one player for ${t2Name} Team`); return; }

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

    const redCaptain   = document.getElementById('editRedCaptain').value   || null;
    const blackCaptain = document.getElementById('editBlackCaptain').value || null;

    try {
        await updateDoc(doc(db, 'pregames', pregameId), {
            date, redTeam, blackTeam, redTeamNames, blackTeamNames,
            redCaptain, blackCaptain,
            team1Color: editTeam1Color, team2Color: editTeam2Color,
            updatedAt: new Date().toISOString(),
        });
        document.getElementById('editPregameModal').style.display = 'none';
    } catch (error) {
        alert('Error updating pre-selection: ' + error.message);
    }
};

// ── Delete pregame ────────────────────────────────────
window.deletePregame = async function (pregameId, formattedDate) {
    if (!confirm(`Delete pre-selection for ${formattedDate}? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, 'pregames', pregameId));
    } catch (error) {
        alert('Error deleting pre-selection: ' + error.message);
    }
};

// ── Helpers ───────────────────────────────────────────
function getCheckedIds(containerId) {
    return Array.from(
        document.getElementById(containerId).querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);
}

window.closePregameModal     = () => { document.getElementById('pregameModal').style.display     = 'none'; };
window.closeEditPregameModal = () => { document.getElementById('editPregameModal').style.display = 'none'; };
