import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAbQgr9z8ZQUbNP-quIQglyvnpBqIup2sU",
    authDomain: "sweat-squad-stats.firebaseapp.com",
    projectId: "sweat-squad-stats",
    storageBucket: "sweat-squad-stats.firebasestorage.app",
    messagingSenderId: "25309305756",
    appId: "1:25309305756:web:dbefb3d367483210dec659",
    measurementId: "G-1J57ZZ5EL0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
