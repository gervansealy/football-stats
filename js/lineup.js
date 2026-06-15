import { db, auth } from './firebase-config.js';
import {
    collection, getDocs, doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const ADMIN_EMAIL = 'gervansealy@gmail.com';

function generateRevOTP() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let otp = '';
    for (let i = 0; i < 6; i++) otp += chars[Math.floor(Math.random() * chars.length)];
    return otp;
}

const TEAM_COLORS = {
    red:    { hex: '#DC3545', textColor: '#fff', border: '',                    emoji: '🔴', name: 'Red'    },
    black:  { hex: '#333333', textColor: '#fff', border: 'rgba(255,255,255,0.2)', emoji: '⚫', name: 'Black'  },
    blue:   { hex: '#1976D2', textColor: '#fff', border: '',                    emoji: '🔵', name: 'Blue'   },
    green:  { hex: '#2E7D32', textColor: '#fff', border: '',                    emoji: '🟢', name: 'Green'  },
    white:  { hex: '#E8E8E8', textColor: '#333', border: '#aaa',                emoji: '⚪', name: 'White'  },
    yellow: { hex: '#F9A825', textColor: '#333', border: '',                    emoji: '🟡', name: 'Yellow' },
    orange: { hex: '#F57C00', textColor: '#fff', border: '',                    emoji: '🟠', name: 'Orange' },
    purple: { hex: '#7B1FA2', textColor: '#fff', border: '',                    emoji: '🟣', name: 'Purple' },
};

function getTeamColor(team, pregame) {
    const key = team === 'red'
        ? (pregame?.team1Color || 'red')
        : (pregame?.team2Color || 'black');
    return TEAM_COLORS[key] || TEAM_COLORS[team] || TEAM_COLORS.red;
}

// ── Player photo map ───────────────────────────────
const playersMap = {};

function convertToDirectLink(url) {
    if (!url) return null;
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) return url;
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
                   || url.match(/\/d\/([a-zA-Z0-9_-]+)/)
                   || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
}

async function loadPlayersMap() {
    const snap = await getDocs(collection(db, 'players'));
    snap.forEach(d => { playersMap[d.id] = d.data(); });
}

// ── State ──────────────────────────────────────────
let currentPregame = null;
let currentTeam    = null;   // 'red' | 'black'
let teamPlayers    = [];     // [{ id, name }]
let placedPlayers  = {};     // { id: { x, y } } — % coords on pitch
let isEditable     = false;

let draggingToken  = null;
let dragOffsetX    = 0;
let dragOffsetY    = 0;

// ── Entry ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('otpInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') verifyOTP();
    });

    const params    = new URLSearchParams(window.location.search);
    const otp       = params.get('otp');
    const revOtp    = params.get('revotp');
    const viewId    = params.get('view');
    const adminId   = params.get('admin');
    const adminTeam = params.get('team');

    const hasParam = otp || revOtp || viewId || adminId;
    if (!hasParam) {
        showSection('otp');
        return;
    }

    try {
        await loadPlayersMap();

        if (viewId) {
            await initViewMode(viewId);
        } else if (adminId && adminTeam) {
            await initAdminEdit(adminId, adminTeam);
        } else if (revOtp) {
            await processRevOTP(revOtp.toUpperCase());
        } else if (otp) {
            await processOTP(otp.toUpperCase(), true);
        }
    } catch (err) {
        console.error(err);
        showLinkError('Something went wrong loading your lineup. Please try the link again.');
    }
});

function showSection(which) {
    document.getElementById('linkErrorSection').style.display = which === 'linkerror' ? 'flex'  : 'none';
    document.getElementById('otpSection').style.display       = which === 'otp'       ? 'flex'  : 'none';
    document.getElementById('editorSection').style.display    = which === 'editor'    ? 'block' : 'none';
    document.getElementById('viewSection').style.display      = which === 'view'      ? 'block' : 'none';
}

function showLinkError(msg) {
    document.getElementById('linkErrorMsg').textContent = msg;
    showSection('linkerror');
}

// ── OTP Flow ───────────────────────────────────────
window.verifyOTP = async function () {
    const otp = document.getElementById('otpInput').value.toUpperCase().trim();
    if (!otp) return;
    const btn = document.querySelector('#otpSection .btn-login');
    btn.disabled    = true;
    btn.textContent = 'Checking…';
    await processOTP(otp);
    btn.disabled  = false;
    btn.innerHTML = 'Continue <span class="arrow">→</span>';
};

async function processOTP(otp, fromLink = false) {
    try {
        const snap = await getDocs(collection(db, 'pregames'));
        let found = null, team = null;

        snap.forEach(d => {
            const data = d.data();
            if (data.redOTP === otp)        { found = { id: d.id, ...data }; team = 'red'; }
            else if (data.blackOTP === otp) { found = { id: d.id, ...data }; team = 'black'; }
        });

        if (!found) {
            if (fromLink) showLinkError('This link is invalid or has expired. Please contact the admin for a new link.');
            else { showSection('otp'); showOTPError('Invalid password. Please try again.'); }
            return;
        }

        const lineupDoc = await getDoc(doc(db, 'lineups', found.id));
        if (lineupDoc.exists()) {
            const ld        = lineupDoc.data();
            const submitted = team === 'red' ? ld.redSubmitted : ld.blackSubmitted;
            if (submitted) {
                await initViewMode(found.id);
                return;
            }
            const existing = team === 'red' ? ld.redLineup : ld.blackLineup;
            if (existing) {
                existing.forEach(p => {
                    if (p.x != null) placedPlayers[p.id] = { x: p.x, y: p.y };
                });
            }
        }

        currentPregame = found;
        currentTeam    = team;
        buildTeamPlayers();
        applyDefaultPositions();
        isEditable = true;
        initEditor();

    } catch (err) {
        console.error(err);
        if (fromLink) showLinkError('Something went wrong loading your lineup. Please try the link again.');
        else { showSection('otp'); showOTPError('Error verifying password. Please try again.'); }
    }
}

async function processRevOTP(otp) {
    try {
        const snap = await getDocs(collection(db, 'lineups'));
        let pregameId = null, team = null, lineupData = null;

        snap.forEach(d => {
            const data = d.data();
            if (data.redRevOTP === otp)        { pregameId = d.id; team = 'red';   lineupData = data; }
            else if (data.blackRevOTP === otp) { pregameId = d.id; team = 'black'; lineupData = data; }
        });

        if (!pregameId) {
            showLinkError('This re-edit link is invalid or has expired. Please ask the admin to generate a new one.');
            return;
        }

        const pgDoc = await getDoc(doc(db, 'pregames', pregameId));
        if (!pgDoc.exists()) {
            showLinkError('Game not found. Please contact the admin.');
            return;
        }

        currentPregame = { id: pgDoc.id, ...pgDoc.data() };
        currentTeam    = team;
        placedPlayers  = {};

        const savedLineup = team === 'red' ? lineupData.redLineup : lineupData.blackLineup;
        if (savedLineup) {
            savedLineup.forEach(p => { if (p.x != null) placedPlayers[p.id] = { x: p.x, y: p.y }; });
        }

        buildTeamPlayers();
        applyDefaultPositions();
        isEditable = true;
        initEditor();

    } catch (err) {
        console.error(err);
        showLinkError('Something went wrong loading your lineup. Please try the link again.');
    }
}

function showOTPError(msg) {
    const el = document.getElementById('otpError');
    el.textContent    = msg;
    el.style.display  = 'block';
}

// ── Build team player list from pregame doc ─────────
function buildTeamPlayers() {
    const ids     = currentTeam === 'red' ? currentPregame.redTeam  : currentPregame.blackTeam;
    const nameMap = currentTeam === 'red' ? (currentPregame.redTeamNames  || {})
                                          : (currentPregame.blackTeamNames || {});
    teamPlayers = ids.map(id => ({ id, name: nameMap[id] || id }));
}

// ── Default formation positions (% x, % y) ─────────
function getDefaultPosition(index, total) {
    const F = {
        1:  [[50,85]],
        2:  [[50,85],[50,20]],
        3:  [[50,85],[30,48],[70,48]],
        4:  [[50,85],[25,65],[50,62],[75,65]],
        5:  [[50,85],[25,65],[75,65],[30,38],[70,38]],
        6:  [[50,85],[20,68],[50,68],[80,68],[35,36],[65,36]],
        7:  [[50,85],[20,70],[45,70],[70,70],[30,44],[60,44],[50,22]],
        8:  [[50,85],[18,70],[38,70],[62,70],[82,70],[28,44],[50,44],[72,44]],
        9:  [[50,85],[18,70],[38,70],[62,70],[82,70],[25,46],[50,46],[75,46],[50,22]],
        10: [[50,85],[18,72],[36,72],[54,72],[72,72],[22,48],[44,48],[66,48],[88,48],[50,24]],
        11: [[50,85],[18,72],[36,72],[54,72],[72,72],[22,48],[44,48],[66,48],[35,25],[50,18],[65,25]],
    };
    const n   = Math.min(total, 11);
    const pos = F[n] || F[11];
    if (index < pos.length) return { x: pos[index][0], y: pos[index][1] };
    return { x: 20 + (index % 4) * 20, y: 12 + Math.floor(index / 4) * 18 };
}

function applyDefaultPositions() {
    teamPlayers.forEach((p, i) => {
        if (!placedPlayers[p.id]) {
            placedPlayers[p.id] = getDefaultPosition(i, teamPlayers.length);
        }
    });
}

// ── Editor ─────────────────────────────────────────
function initEditor() {
    const tc        = getTeamColor(currentTeam, currentPregame);
    const date      = new Date(currentPregame.date + 'T12:00:00');
    const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    document.getElementById('editorTitle').textContent    = `${tc.emoji} ${tc.name} Team Lineup`;
    document.getElementById('editorSubtitle').textContent = formatted;

    const captainId = currentTeam === 'red' ? currentPregame.redCaptain : currentPregame.blackCaptain;
    showSection('editor');
    renderTokensOnPitch('pitch', [{ team: currentTeam, players: teamPlayers }], true, captainId, tc);
    initDragDrop();

    document.getElementById('submitLineupBtn').onclick = submitLineup;
}

// ── Token rendering ────────────────────────────────

function renderTeamPitch(pitchId, pendingId, lineup, team, captainId = null, tc = TEAM_COLORS.red) {
    const pitch   = document.getElementById(pitchId);
    const pending = document.getElementById(pendingId);
    pitch.querySelectorAll('.player-token').forEach(t => t.remove());

    if (!lineup || lineup.length === 0) {
        if (pending) pending.style.display = 'flex';
        return;
    }
    if (pending) pending.style.display = 'none';
    lineup.forEach(p => pitch.appendChild(makeToken(p.id, p.name || p.id, team, p.x, p.y, false, p.id === captainId, tc)));
}

function renderTokensOnPitch(pitchId, groups, draggable, captainId = null, tc = TEAM_COLORS.red) {
    const pitch = document.getElementById(pitchId);
    pitch.querySelectorAll('.player-token').forEach(t => t.remove());
    groups.forEach(({ team, players }) => {
        players.forEach(p => {
            const pos = placedPlayers[p.id] || { x: 50, y: 50 };
            pitch.appendChild(makeToken(p.id, p.name, team, pos.x, pos.y, draggable, p.id === captainId, tc));
        });
    });
}

function makeToken(id, name, team, x, y, draggable, isCaptain = false, tc = TEAM_COLORS.red) {
    const el = document.createElement('div');
    el.className        = 'player-token' + (draggable ? '' : ' view-only') + (isCaptain ? ' token-captain' : '');
    el.dataset.playerId = id;
    el.style.left       = x + '%';
    el.style.top        = y + '%';
    if (draggable) el.style.touchAction = 'none';

    const parts     = name.trim().split(' ');
    const initials  = parts.map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    const first     = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`
        : parts[0];
    const rawPhoto  = playersMap[id]?.headshotLink;
    const photoUrl  = rawPhoto ? convertToDirectLink(rawPhoto) : null;
    const picHTML   = photoUrl
        ? `<img class="token-pic" src="${photoUrl}" alt="${first}" onerror="this.outerHTML='<div class=\\'token-pic-placeholder\\'>${initials}</div>'">`
        : `<div class="token-pic-placeholder">${initials}</div>`;

    el.innerHTML = `
        <div class="token-pic-wrapper">
            ${isCaptain ? '<div class="token-captain-badge">C</div>' : ''}
            ${picHTML}
        </div>
        <div class="token-color-dot" style="background:${tc.hex};"></div>
        <div class="token-name">${first}</div>
    `;
    return el;
}

// ── Drag & Drop ────────────────────────────────────
function initDragDrop() {
    const pitch = document.getElementById('pitch');
    pitch.addEventListener('pointerdown',   onDown);
    pitch.addEventListener('pointermove',   onMove);
    pitch.addEventListener('pointerup',     onUp);
    pitch.addEventListener('pointercancel', onUp);
}

function onDown(e) {
    const token = e.target.closest('.player-token:not(.view-only)');
    if (!token) return;
    e.preventDefault();

    draggingToken = token;
    token.setPointerCapture(e.pointerId);
    token.classList.add('token-dragging');

    const pr = document.getElementById('pitch').getBoundingClientRect();
    const pX = (e.clientX - pr.left) / pr.width  * 100;
    const pY = (e.clientY - pr.top)  / pr.height * 100;
    dragOffsetX = pX - parseFloat(token.style.left);
    dragOffsetY = pY - parseFloat(token.style.top);
}

function onMove(e) {
    if (!draggingToken) return;
    const pr = document.getElementById('pitch').getBoundingClientRect();
    const pX = (e.clientX - pr.left) / pr.width  * 100;
    const pY = (e.clientY - pr.top)  / pr.height * 100;

    const x = Math.max(3, Math.min(97, pX - dragOffsetX));
    const y = Math.max(3, Math.min(97, pY - dragOffsetY));

    draggingToken.style.left = x + '%';
    draggingToken.style.top  = y + '%';
    placedPlayers[draggingToken.dataset.playerId] = { x, y };
}

function onUp() {
    if (!draggingToken) return;
    draggingToken.classList.remove('token-dragging');
    draggingToken = null;
}

// ── Submit ─────────────────────────────────────────
async function submitLineup() {
    if (!confirm('Submit this lineup? Changes cannot be made after submission (admin can still edit).')) return;

    const lineupData = teamPlayers.map(p => ({
        id:   p.id,
        name: p.name,
        x:    placedPlayers[p.id]?.x ?? 50,
        y:    placedPlayers[p.id]?.y ?? 50,
    }));

    const btn = document.getElementById('submitLineupBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
        const key    = currentTeam;
        const revOTP = generateRevOTP();
        await setDoc(doc(db, 'lineups', currentPregame.id), {
            pregameId:              currentPregame.id,
            date:                   currentPregame.date,
            [`${key}Lineup`]:       lineupData,
            [`${key}Submitted`]:    true,
            [`${key}SubmittedAt`]:  new Date().toISOString(),
            [`${key}RevOTP`]:       revOTP,
        }, { merge: true });

        await initViewMode(currentPregame.id);
    } catch (err) {
        console.error(err);
        alert('Error saving lineup. Please try again.');
        btn.disabled    = false;
        btn.textContent = 'Submit Lineup ✓';
    }
}

// ── View mode ──────────────────────────────────────
async function initViewMode(pregameId) {
    const [pgDoc, ldDoc] = await Promise.all([
        getDoc(doc(db, 'pregames', pregameId)),
        getDoc(doc(db, 'lineups',  pregameId)),
    ]);

    if (!pgDoc.exists()) {
        document.getElementById('viewTitle').textContent = 'Lineup not found';
        showSection('view');
        return;
    }

    const pg   = { id: pgDoc.id, ...pgDoc.data() };
    const ld   = ldDoc.exists() ? ldDoc.data() : {};
    const date = new Date(pg.date + 'T12:00:00');

    const t1 = getTeamColor('red',   pg);
    const t2 = getTeamColor('black', pg);

    document.getElementById('viewTitle').textContent    = 'Match Lineup';
    document.getElementById('viewSubtitle').textContent = date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    // Update panel title labels and colors
    const redTitle   = document.getElementById('redPanelTitle');
    const blackTitle = document.getElementById('blackPanelTitle');
    if (redTitle) {
        redTitle.textContent      = `${t1.emoji} ${t1.name} Team`;
        redTitle.style.background = `${t1.hex}55`;
        redTitle.style.border     = `1px solid ${t1.hex}99`;
        redTitle.style.color      = '#fff';
    }
    if (blackTitle) {
        blackTitle.textContent      = `${t2.emoji} ${t2.name} Team`;
        blackTitle.style.background = `${t2.hex}55`;
        blackTitle.style.border     = `1px solid ${t2.hex}99`;
        blackTitle.style.color      = '#fff';
    }

    const redLineup   = ld.redLineup    || [];
    const blackLineup = ld.blackLineup  || [];
    const redDone     = ld.redSubmitted   || false;
    const blackDone   = ld.blackSubmitted || false;

    document.getElementById('lineupStatus').innerHTML = `
        <div class="lineup-status-item ${redDone   ? 'submitted' : 'pending'}">${t1.emoji} ${t1.name}: ${redDone   ? '✓ Set' : '⏳ Pending'}</div>
        <div class="lineup-status-item ${blackDone ? 'submitted' : 'pending'}">${t2.emoji} ${t2.name}: ${blackDone ? '✓ Set' : '⏳ Pending'}</div>
    `;

    placedPlayers = {};
    [...redLineup, ...blackLineup].forEach(p => { placedPlayers[p.id] = { x: p.x, y: p.y }; });

    renderTeamPitch('redViewPitch',   'redPitchPending',   redLineup,   'red',   pg.redCaptain   || null, t1);
    renderTeamPitch('blackViewPitch', 'blackPitchPending', blackLineup, 'black', pg.blackCaptain || null, t2);
    showSection('view');

    onAuthStateChanged(auth, user => {
        if (user && user.email === ADMIN_EMAIL) {
            const adminBtns = document.getElementById('viewAdminBtns');
            adminBtns.style.display = 'flex';
            adminBtns.innerHTML = `
                <button onclick="adminEditTeam('${pregameId}','red')"   class="btn-secondary" style="background:${t1.hex};color:${t1.textColor};border:none;">Edit ${t1.name} Lineup</button>
                <button onclick="adminEditTeam('${pregameId}','black')" class="btn-secondary" style="background:${t2.hex};color:${t2.textColor};border:none;">Edit ${t2.name} Lineup</button>
            `;
        }
    });
}

// ── Admin edit ─────────────────────────────────────
async function initAdminEdit(pregameId, team) {
    await new Promise(resolve => {
        onAuthStateChanged(auth, user => {
            if (!user || user.email !== ADMIN_EMAIL) {
                window.location.href = 'team-selection.html';
            }
            resolve();
        });
    });

    const [pgDoc, ldDoc] = await Promise.all([
        getDoc(doc(db, 'pregames', pregameId)),
        getDoc(doc(db, 'lineups',  pregameId)),
    ]);
    if (!pgDoc.exists()) return;

    currentPregame = { id: pgDoc.id, ...pgDoc.data() };
    currentTeam    = team;
    placedPlayers  = {};

    buildTeamPlayers();

    if (ldDoc.exists()) {
        const existing = team === 'red' ? ldDoc.data().redLineup : ldDoc.data().blackLineup;
        if (existing) existing.forEach(p => { if (p.x != null) placedPlayers[p.id] = { x: p.x, y: p.y }; });
    }

    applyDefaultPositions();
    isEditable = true;
    initEditor();
}

window.adminEditTeam = async function (pregameId, team) {
    currentTeam   = team;
    placedPlayers = {};
    teamPlayers   = [];
    await initAdminEdit(pregameId, team);
};
