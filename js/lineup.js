import { db, auth } from './firebase-config.js';
import {
    collection, getDocs, doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const ADMIN_EMAIL = 'gervansealy@gmail.com';

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
    const params  = new URLSearchParams(window.location.search);
    const otp     = params.get('otp');
    const viewId  = params.get('view');
    const adminId = params.get('admin');
    const adminTeam = params.get('team');

    document.getElementById('otpInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') verifyOTP();
    });

    if (viewId) {
        await initViewMode(viewId);
    } else if (adminId && adminTeam) {
        await initAdminEdit(adminId, adminTeam);
    } else if (otp) {
        await processOTP(otp.toUpperCase());
    } else {
        showSection('otp');
    }
});

function showSection(which) {
    document.getElementById('otpSection').style.display  = which === 'otp'    ? 'flex'  : 'none';
    document.getElementById('editorSection').style.display = which === 'editor' ? 'block' : 'none';
    document.getElementById('viewSection').style.display = which === 'view'   ? 'block' : 'none';
}

// ── OTP Flow ───────────────────────────────────────
window.verifyOTP = async function () {
    const otp = document.getElementById('otpInput').value.toUpperCase().trim();
    if (!otp) return;
    const btn = document.querySelector('#otpSection .btn-login');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    await processOTP(otp);
    btn.disabled = false;
    btn.innerHTML = 'Continue <span class="arrow">→</span>';
};

async function processOTP(otp) {
    try {
        const snap = await getDocs(collection(db, 'pregames'));
        let found = null, team = null;

        snap.forEach(d => {
            const data = d.data();
            if (data.redOTP === otp)   { found = { id: d.id, ...data }; team = 'red'; }
            else if (data.blackOTP === otp) { found = { id: d.id, ...data }; team = 'black'; }
        });

        if (!found) {
            showOTPError('Invalid password. Please try again.');
            return;
        }

        // If already submitted, switch to view mode
        const lineupDoc = await getDoc(doc(db, 'lineups', found.id));
        if (lineupDoc.exists()) {
            const ld = lineupDoc.data();
            const submitted = team === 'red' ? ld.redSubmitted : ld.blackSubmitted;
            if (submitted) {
                await initViewMode(found.id);
                return;
            }
            // Load draft positions
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
        showOTPError('Error verifying password. Please try again.');
    }
}

function showOTPError(msg) {
    const el = document.getElementById('otpError');
    el.textContent = msg;
    el.style.display = 'block';
}

// ── Build team player list from pregame doc ─────────
function buildTeamPlayers() {
    const ids      = currentTeam === 'red' ? currentPregame.redTeam  : currentPregame.blackTeam;
    const nameMap  = currentTeam === 'red' ? (currentPregame.redTeamNames  || {})
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
    // overflow grid
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
    const date      = new Date(currentPregame.date + 'T12:00:00');
    const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const label     = currentTeam === 'red' ? '🔴 Red Team' : '⚫ Black Team';

    document.getElementById('editorTitle').textContent    = `${label} Lineup`;
    document.getElementById('editorSubtitle').textContent = formatted;

    showSection('editor');
    renderTokensOnPitch('pitch', [{ team: currentTeam, players: teamPlayers }], true);
    initDragDrop();

    document.getElementById('submitLineupBtn').addEventListener('click', submitLineup);
}

// ── Token rendering ────────────────────────────────
function renderTokensOnPitch(pitchId, groups, draggable) {
    const pitch = document.getElementById(pitchId);
    pitch.querySelectorAll('.player-token').forEach(t => t.remove());

    groups.forEach(({ team, players }) => {
        players.forEach(p => {
            const pos   = placedPlayers[p.id] || { x: 50, y: 50 };
            const token = makeToken(p.id, p.name, team, pos.x, pos.y, draggable);
            pitch.appendChild(token);
        });
    });
}

function makeToken(id, name, team, x, y, draggable) {
    const el = document.createElement('div');
    el.className        = 'player-token' + (draggable ? '' : ' view-only');
    el.dataset.playerId = id;
    el.style.left       = x + '%';
    el.style.top        = y + '%';

    const initials = name.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase();
    const first    = name.split(' ')[0];

    el.innerHTML = `
        <div class="token-jersey ${team}">${initials}</div>
        <div class="token-name">${first}</div>
    `;
    return el;
}

// ── Drag & Drop ────────────────────────────────────
function initDragDrop() {
    const pitch = document.getElementById('pitch');
    pitch.addEventListener('pointerdown',  onDown);
    pitch.addEventListener('pointermove',  onMove);
    pitch.addEventListener('pointerup',    onUp);
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
    const pX = (e.clientX - pr.left)  / pr.width  * 100;
    const pY = (e.clientY - pr.top)   / pr.height * 100;
    dragOffsetX = pX - parseFloat(token.style.left);
    dragOffsetY = pY - parseFloat(token.style.top);
}

function onMove(e) {
    if (!draggingToken) return;
    const pr = document.getElementById('pitch').getBoundingClientRect();
    const pX = (e.clientX - pr.left)  / pr.width  * 100;
    const pY = (e.clientY - pr.top)   / pr.height * 100;

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
        const key = currentTeam;
        await setDoc(doc(db, 'lineups', currentPregame.id), {
            pregameId:            currentPregame.id,
            date:                 currentPregame.date,
            [`${key}Lineup`]:     lineupData,
            [`${key}Submitted`]:  true,
            [`${key}SubmittedAt`]: new Date().toISOString(),
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

    document.getElementById('viewTitle').textContent    = 'Match Lineup';
    document.getElementById('viewSubtitle').textContent = date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const redLineup    = ld.redLineup    || [];
    const blackLineup  = ld.blackLineup  || [];
    const redDone      = ld.redSubmitted   || false;
    const blackDone    = ld.blackSubmitted || false;

    // Status badges
    document.getElementById('lineupStatus').innerHTML = `
        <div class="lineup-status-item ${redDone   ? 'submitted' : 'pending'}">🔴 Red: ${redDone   ? '✓ Set' : '⏳ Pending'}</div>
        <div class="lineup-status-item ${blackDone ? 'submitted' : 'pending'}">⚫ Black: ${blackDone ? '✓ Set' : '⏳ Pending'}</div>
    `;

    // Build combined placed map for rendering
    placedPlayers = {};
    [...redLineup, ...blackLineup].forEach(p => { placedPlayers[p.id] = { x: p.x, y: p.y }; });

    const groups = [];
    if (redLineup.length)   groups.push({ team: 'red',   players: redLineup   });
    if (blackLineup.length) groups.push({ team: 'black', players: blackLineup });

    renderTokensOnPitch('viewPitch', groups, false);
    showSection('view');

    // Check if admin for edit buttons (no redirect if not logged in)
    onAuthStateChanged(auth, user => {
        if (user && user.email === ADMIN_EMAIL) {
            const adminBtns = document.getElementById('viewAdminBtns');
            adminBtns.style.display = 'flex';
            adminBtns.innerHTML = `
                <button onclick="adminEditTeam('${pregameId}','red')"   class="btn-secondary" style="background:#DC3545;color:white;border:none;">Edit Red Lineup</button>
                <button onclick="adminEditTeam('${pregameId}','black')" class="btn-secondary" style="border:none;">Edit Black Lineup</button>
            `;
        }
    });
}

// ── Admin edit ─────────────────────────────────────
async function initAdminEdit(pregameId, team) {
    // Verify admin via Firebase Auth
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
