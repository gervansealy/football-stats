import { db, auth } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { updatePassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await checkAuth();
    
    if (authData.role !== 'admin') {
        window.location.href = 'standings.html';
        return;
    }

    loadPointsConfig();

    document.getElementById('pointsForm').addEventListener('submit', savePointsConfig);
    document.getElementById('adminPasswordForm').addEventListener('submit', updateAdminPassword);
    document.getElementById('viewerPasswordForm').addEventListener('submit', updateViewerPassword);
});

async function loadPointsConfig() {
    try {
        const pointsDoc = await getDoc(doc(db, 'config', 'points'));
        
        if (pointsDoc.exists()) {
            const points = pointsDoc.data();
            document.getElementById('winPoints').value = points.win || 3;
            document.getElementById('drawPoints').value = points.draw || 1;
            document.getElementById('lossPoints').value = points.loss || -1;
            document.getElementById('cleanSheetPoints').value = points.cleanSheet || 3;
            document.getElementById('goalPoints').value = points.goal || 1;
            document.getElementById('captainWinPoints').value = points.captainWin || 5;
            document.getElementById('captainDrawPoints').value = points.captainDraw || 2.5;
            document.getElementById('captainLossPoints').value = points.captainLoss || -2;
        }
    } catch (error) {
        console.error('Error loading points config:', error);
    }
}

async function savePointsConfig(e) {
    e.preventDefault();

    const pointsConfig = {
        win: parseFloat(document.getElementById('winPoints').value),
        draw: parseFloat(document.getElementById('drawPoints').value),
        loss: parseFloat(document.getElementById('lossPoints').value),
        cleanSheet: parseFloat(document.getElementById('cleanSheetPoints').value),
        goal: parseFloat(document.getElementById('goalPoints').value),
        captainWin: parseFloat(document.getElementById('captainWinPoints').value),
        captainDraw: parseFloat(document.getElementById('captainDrawPoints').value),
        captainLoss: parseFloat(document.getElementById('captainLossPoints').value)
    };

    try {
        await setDoc(doc(db, 'config', 'points'), pointsConfig);
        alert('Point values saved successfully!');
    } catch (error) {
        console.error('Error saving points config:', error);
        alert('Error saving settings. Please try again.');
    }
}

async function updateAdminPassword(e) {
    e.preventDefault();

    const newPassword = document.getElementById('newAdminPassword').value;
    const confirmPassword = document.getElementById('confirmAdminPassword').value;

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        await updateDoc(doc(db, 'config', 'passwords'), {
            admin: newPassword
        });

        if (auth.currentUser.email === 'gervansealy@gmail.com') {
            await updatePassword(auth.currentUser, newPassword);
        }

        alert('Admin password updated successfully!');
        document.getElementById('adminPasswordForm').reset();
    } catch (error) {
        console.error('Error updating admin password:', error);
        alert('Error updating password. Please try again.');
    }
}

async function updateViewerPassword(e) {
    e.preventDefault();

    const newPassword = document.getElementById('newViewerPassword').value;
    const confirmPassword = document.getElementById('confirmViewerPassword').value;

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        await updateDoc(doc(db, 'config', 'passwords'), {
            viewer: newPassword
        });

        alert('Viewer password updated successfully!');
        document.getElementById('viewerPasswordForm').reset();
    } catch (error) {
        console.error('Error updating viewer password:', error);
        alert('Error updating password. Please try again.');
    }
}
