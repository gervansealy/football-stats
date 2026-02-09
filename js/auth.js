import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ADMIN_EMAIL = 'gervansealy@gmail.com';
const VIEWER_EMAIL = 'footballzess@gmail.com';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                window.location.href = 'standings.html';
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('emailInput').value;
            const password = passwordInput.value;
            errorMessage.textContent = '';

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error('Login error:', error);
                if (error.code === 'auth/wrong-password') {
                    errorMessage.textContent = 'Invalid password';
                } else if (error.code === 'auth/user-not-found') {
                    errorMessage.textContent = 'User not found';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage.textContent = 'Invalid email address';
                } else if (error.code === 'auth/invalid-credential') {
                    errorMessage.textContent = 'Invalid email or password';
                } else {
                    errorMessage.textContent = 'Login failed. Please try again.';
                }
            }
        });
    }
});

export function checkAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            const role = user.email === ADMIN_EMAIL ? 'admin' : 'viewer';
            
            if (role === 'admin') {
                document.body.classList.add('admin');
            }

            const roleElements = document.querySelectorAll('#userRole');
            roleElements.forEach(el => {
                el.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                el.classList.add(role);
            });

            const changeRoleBtn = document.getElementById('changeRoleBtn');
            if (changeRoleBtn) {
                changeRoleBtn.addEventListener('click', async () => {
                    await auth.signOut();
                    window.location.href = 'index.html';
                });
            }

            resolve({ user, role });
        });
    });
}
