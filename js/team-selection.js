import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, addDoc, getDocs, onSnapshot,
    doc, updateDoc, deleteDoc, getDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let players = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    await loadPlayers();
    loadPregames();

    document.getElementById('newPregameBtn').addEventListener('click', openNewPregameModal);
});

async function loadPlayers() {
    const snapshot = await getDocs(collection(db, 'players'));
    players = [];
    snapshot.forEach(d => players.push({ id: d.id, ...d.data() }));
    players.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

function loadPregames() {
    const q = query(collection(db, 'pregames'), orderBy('date', 'desc'));
    onSnapshot(q, snapshot => {
        const container = document.getElementById('pregamesContainer');

        if (snapshot.empty) {
            container.innerHTML = '<p class="no-data">No pre-selections yet. Click "+ New Pre-Selection" to get started.</p>';
            return;
        }

        const pregames = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        container.innerHTML = pregames.map(pg => {
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
                    <div class="pregame-card-footer">
                        <a href="input-stats.html?pregame=${pg.id}" class="btn-enter-stats">Enter Stats →</a>
                    </div>
                </div>
            `;
        }).join('');
    });
}

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

function openNewPregameModal() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('pregameDate').value = `${yyyy}-${mm}-${dd}`;
    buildPlayerCheckboxes('redTeamCheckboxes');
    buildPlayerCheckboxes('blackTeamCheckboxes');
    wireSearchInput('redTeamSearch', 'redTeamCheckboxes');
    wireSearchInput('blackTeamSearch', 'blackTeamCheckboxes');
    document.getElementById('pregameModal').style.display = 'block';
}

window.openEditPregameModal = async function(pregameId) {
    const pgDoc = await getDoc(doc(db, 'pregames', pregameId));
    if (!pgDoc.exists()) return;

    const pg = pgDoc.data();
    document.getElementById('editPregameId').value = pregameId;
    document.getElementById('editPregameDate').value = pg.date;
    buildPlayerCheckboxes('editRedTeamCheckboxes', pg.redTeam || []);
    buildPlayerCheckboxes('editBlackTeamCheckboxes', pg.blackTeam || []);
    wireSearchInput('editRedTeamSearch', 'editRedTeamCheckboxes');
    wireSearchInput('editBlackTeamSearch', 'editBlackTeamCheckboxes');
    document.getElementById('editPregameModal').style.display = 'block';
};

window.savePregame = async function() {
    const date = document.getElementById('pregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam = getCheckedIds('redTeamCheckboxes');
    const blackTeam = getCheckedIds('blackTeamCheckboxes');

    if (redTeam.length === 0) { alert('Please select at least one player for Red Team'); return; }
    if (blackTeam.length === 0) { alert('Please select at least one player for Black Team'); return; }

    const overlap = redTeam.filter(id => blackTeam.includes(id));
    if (overlap.length > 0) { alert('A player cannot be on both teams'); return; }

    try {
        await addDoc(collection(db, 'pregames'), {
            date,
            redTeam,
            blackTeam,
            createdAt: new Date().toISOString()
        });
        document.getElementById('pregameModal').style.display = 'none';
    } catch (error) {
        alert('Error saving pre-selection: ' + error.message);
    }
};

window.saveEditPregame = async function() {
    const pregameId = document.getElementById('editPregameId').value;
    const date = document.getElementById('editPregameDate').value;
    if (!date) { alert('Please select a game date'); return; }

    const redTeam = getCheckedIds('editRedTeamCheckboxes');
    const blackTeam = getCheckedIds('editBlackTeamCheckboxes');

    if (redTeam.length === 0) { alert('Please select at least one player for Red Team'); return; }
    if (blackTeam.length === 0) { alert('Please select at least one player for Black Team'); return; }

    const overlap = redTeam.filter(id => blackTeam.includes(id));
    if (overlap.length > 0) { alert('A player cannot be on both teams'); return; }

    try {
        await updateDoc(doc(db, 'pregames', pregameId), {
            date,
            redTeam,
            blackTeam,
            updatedAt: new Date().toISOString()
        });
        document.getElementById('editPregameModal').style.display = 'none';
    } catch (error) {
        alert('Error updating pre-selection: ' + error.message);
    }
};

window.deletePregame = async function(pregameId, formattedDate) {
    if (!confirm(`Delete pre-selection for ${formattedDate}? This cannot be undone.`)) return;
    try {
        await deleteDoc(doc(db, 'pregames', pregameId));
    } catch (error) {
        alert('Error deleting pre-selection: ' + error.message);
    }
};

function getCheckedIds(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

window.closePregameModal = function() {
    document.getElementById('pregameModal').style.display = 'none';
};

window.closeEditPregameModal = function() {
    document.getElementById('editPregameModal').style.display = 'none';
};
