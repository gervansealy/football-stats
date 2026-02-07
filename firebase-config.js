// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDDQ1C-P3AHX9kFQI55Lv16WmV5_ce1YOA",
    authDomain: "footballdatabase-54e01.firebaseapp.com",
    databaseURL: "https://footballdatabase-54e01-default-rtdb.firebaseio.com",
    projectId: "footballdatabase-54e01",
    storageBucket: "footballdatabase-54e01.firebasestorage.app",
    messagingSenderId: "911578883248",
    appId: "1:911578883248:web:b4b39ba2dcb5cd0a214775"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('✅ Firebase Realtime Database connected!');
