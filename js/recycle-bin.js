import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, orderBy, query
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentFilter = 'all';
let trashItems = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    document.getElementById('emptyBinBtn').style.display = 'inline-block';
    document.getElementById('emptyBinBtn').addEventListener('click', confirmEmptyBin);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderItems();
        });
    });

    loadTrash();
});

function loadTrash() {
    const q = query(collection(db, 'trash'), orderBy('deletedAt', 'desc'));
    onSnapshot(q, snapshot => {
        trashItems = snapshot.docs.map(d => ({ trashId: d.id, ...d.data() }));
        renderItems();
    });
}

function renderItems() {
    const container = document.getElementById('recycleBinContainer');
    const filtered = currentFilter === 'all'
        ? trashItems
        : trashItems.filter(i => i.type === currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-data">Recycle bin is empty.</p>';
        return;
    }

    container.innerHTML = filtered.map(item => {
        const label = itemLabel(item);
        const deletedAt = new Date(item.deletedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const typeIcon  = item.type === 'player' ? '👤' : '⚽';
        const typeBadge = item.type === 'player' ? 'trash-badge-player' : 'trash-badge-game';

        return `
            <div class="trash-item">
                <div class="trash-item-left">
                    <span class="trash-type-icon">${typeIcon}</span>
                    <div class="trash-item-info">
                        <div class="trash-item-name">${label}</div>
                        <div class="trash-item-meta">
                            <span class="trash-badge ${typeBadge}">${item.type}</span>
                            <span class="trash-item-date">Deleted ${deletedAt}</span>
                        </div>
                    </div>
                </div>
                <div class="trash-item-actions">
                    <button class="btn-restore" onclick="restoreItem('${item.trashId}')">↩ Restore</button>
                    <button class="btn-delete-perm" onclick="confirmPermanentDelete('${item.trashId}', '${label.replace(/'/g, "\\'")}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function itemLabel(item) {
    if (item.type === 'player') {
        const d = item.data || {};
        return `${d.firstName || ''} ${d.lastName || ''}`.trim() || item.originalId;
    }
    if (item.type === 'game') {
        const d = item.data || {};
        if (d.date) {
            const date = new Date(d.date + 'T12:00:00');
            return 'Game — ' + date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }
        return 'Game — ' + item.originalId;
    }
    return item.originalId;
}

window.restoreItem = async function(trashId) {
    const item = trashItems.find(i => i.trashId === trashId);
    if (!item) return;

    const label = itemLabel(item);
    if (!confirm(`Restore "${label}"?`)) return;

    try {
        const targetCollection = item.type === 'player' ? 'players' : 'games';
        await setDoc(doc(db, targetCollection, item.originalId), item.data);
        await deleteDoc(doc(db, 'trash', trashId));
        alert(`"${label}" restored successfully.`);
    } catch (error) {
        console.error('Error restoring item:', error);
        alert('Error restoring item. Please try again.');
    }
};

window.confirmPermanentDelete = function(trashId, label) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = 'Permanently Delete';
    document.getElementById('confirmModalBody').textContent =
        `Permanently delete "${label}"? This cannot be undone.`;
    const actionBtn = document.getElementById('confirmModalAction');
    actionBtn.onclick = () => permanentDelete(trashId, label);
    modal.style.display = 'block';
};

async function permanentDelete(trashId, label) {
    document.getElementById('confirmModal').style.display = 'none';
    try {
        await deleteDoc(doc(db, 'trash', trashId));
        alert(`"${label}" permanently deleted.`);
    } catch (error) {
        console.error('Error permanently deleting:', error);
        alert('Error deleting item. Please try again.');
    }
}

function confirmEmptyBin() {
    if (trashItems.length === 0) { alert('Recycle bin is already empty.'); return; }
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = 'Empty Recycle Bin';
    document.getElementById('confirmModalBody').textContent =
        `Permanently delete all ${trashItems.length} item(s) in the recycle bin? This cannot be undone.`;
    const actionBtn = document.getElementById('confirmModalAction');
    actionBtn.onclick = emptyBin;
    modal.style.display = 'block';
}

async function emptyBin() {
    document.getElementById('confirmModal').style.display = 'none';
    try {
        await Promise.all(trashItems.map(item => deleteDoc(doc(db, 'trash', item.trashId))));
        alert('Recycle bin emptied.');
    } catch (error) {
        console.error('Error emptying bin:', error);
        alert('Error emptying recycle bin. Please try again.');
    }
}
