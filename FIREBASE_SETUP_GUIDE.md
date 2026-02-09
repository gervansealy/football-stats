# Firebase Setup Guide - Step by Step

This guide will walk you through setting up Firebase for your Football Stats Database from scratch.

## Part 1: Firebase Project Setup (10 minutes)

### 1. Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. **Project name**: Enter `Football Stats Database` (or any name you prefer)
4. Click **Continue**
5. **Google Analytics**: Toggle OFF (not needed for this project)
6. Click **Create project**
7. Wait for project to be created
8. Click **Continue** when ready

### 2. Register Your Web App

1. On the project overview page, click the **Web icon** (`</>`)
2. **App nickname**: Enter `Football Stats Web App`
3. **Firebase Hosting**: Leave UNCHECKED (we're using GitHub Pages)
4. Click **Register app**
5. **IMPORTANT**: Copy the `firebaseConfig` object - you'll need this later
6. Click **Continue to console**

---

## Part 2: Enable Authentication (5 minutes)

### 1. Enable Email/Password Authentication

1. In the left sidebar, click **Authentication**
2. Click **Get started**
3. Click on **Sign-in method** tab
4. Click **Email/Password**
5. Toggle the first switch to **Enable**
6. Click **Save**

### 2. Create User Accounts

1. Click on the **Users** tab
2. Click **Add user**

**Admin User:**
- Email: `gervansealy@gmail.com`
- Password: Choose a strong password (min 6 characters)
- Click **Add user**

3. Click **Add user** again

**Viewer User:**
- Email: `footballzess@gmail.com`
- Password: Choose a strong password (min 6 characters)
- Click **Add user**

**IMPORTANT**: Remember these passwords! You'll need them to login.

---

## Part 3: Create Firestore Database (5 minutes)

### 1. Create Database

1. In the left sidebar, click **Firestore Database**
2. Click **Create database**
3. **Secure rules**: Select **Production mode**
4. Click **Next**
5. **Cloud Firestore location**: Choose the region closest to you
   - Example: `us-east1` for USA East Coast
   - Example: `europe-west1` for Europe
6. Click **Enable**
7. Wait for database to be created

### 2. Create Initial Data Structure

Now we'll create the initial configuration documents:

#### Create `config` collection with `passwords` document:

1. Click **Start collection**
2. **Collection ID**: Enter `config`
3. Click **Next**
4. **Document ID**: Enter `passwords`
5. Add fields:
   - Click **Add field**
     - Field: `admin`
     - Type: `string`
     - Value: Enter the SAME password you used for gervansealy@gmail.com
   - Click **Add field** again
     - Field: `viewer`
     - Type: `string`
     - Value: Enter the SAME password you used for footballzess@gmail.com
6. Click **Save**

#### Create `points` document:

1. Click the **+** icon next to the `config` collection name
2. **Document ID**: Enter `points`
3. Add fields (click **Add field** for each):
   - Field: `win`, Type: `number`, Value: `3`
   - Field: `draw`, Type: `number`, Value: `1`
   - Field: `loss`, Type: `number`, Value: `-1`
   - Field: `cleanSheet`, Type: `number`, Value: `3`
   - Field: `goal`, Type: `number`, Value: `1`
   - Field: `captainWin`, Type: `number`, Value: `5`
   - Field: `captainDraw`, Type: `number`, Value: `2.5`
   - Field: `captainLoss`, Type: `number`, Value: `-2`
4. Click **Save**

---

## Part 4: Set Firestore Security Rules (3 minutes)

### 1. Update Security Rules

1. In Firestore Database, click on the **Rules** tab
2. Delete ALL existing text in the editor
3. Copy the following rules and paste them:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'gervansealy@gmail.com';
    }
    
    function isViewer() {
      return request.auth != null && request.auth.token.email == 'footballzess@gmail.com';
    }
    
    function isAuthenticated() {
      return request.auth != null && (isAdmin() || isViewer());
    }
    
    match /players/{playerId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }
    
    match /games/{gameId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }
    
    match /config/{configId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**

---

## Part 5: Configure Your Application (5 minutes)

### 1. Update Firebase Config

1. Open your code editor
2. Navigate to `js/firebase-config.js`
3. Find the `firebaseConfig` object (line 4)
4. Replace the placeholder values with YOUR Firebase config from Part 1, Step 2

**Before:**
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

**After (example with your actual values):**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX",
    authDomain: "football-stats-db.firebaseapp.com",
    projectId: "football-stats-db",
    storageBucket: "football-stats-db.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

5. Save the file

---

## Part 6: Test Locally (5 minutes)

### 1. Test the Application

1. Open `index.html` in your web browser
2. You should see the login page with animated background
3. Enter the **admin password** (the one you set for gervansealy@gmail.com)
4. Click **Login**
5. You should be redirected to the Standings page
6. The navbar should show "Admin" badge in red

### 2. Test Admin Features

1. Click **Player Profiles**
2. Click **Add New Player**
3. Fill in test data:
   - First Name: John
   - Last Name: Doe
   - Position: Forward
4. Click **Add Player**
5. You should see the player card appear

### 3. Test Viewer Role

1. Click **Change Role** button
2. Enter the **viewer password**
3. Click **Login**
4. You should see "Viewer" badge in green
5. Notice that "Input Stats" and "Settings" are hidden
6. You can only view data

---

## Part 7: Deploy to GitHub Pages (10 minutes)

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click **+** → **New repository**
3. **Repository name**: `football-stats-database` (or your preferred name)
4. **Visibility**: Select **Public** (required for free GitHub Pages)
5. **DON'T** initialize with README, .gitignore, or license
6. Click **Create repository**

### 2. Push Your Code

Open terminal/command prompt in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit - Football Stats Database"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings**
3. Scroll down and click **Pages** in the left sidebar
4. Under **Source**:
   - Branch: Select `main`
   - Folder: Select `/ (root)`
5. Click **Save**
6. Wait 1-2 minutes
7. Refresh the page
8. You'll see: "Your site is live at https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"

### 4. Test Live Site

1. Click the live site URL
2. Test login with both admin and viewer passwords
3. Verify all features work

---

## Part 8: Firebase Security Best Practices

### 1. Set Up Budgets (Prevent Unexpected Charges)

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Click **Usage and billing**
3. Click **Details & settings**
4. Set a budget alert (e.g., $5 or $10)
5. Firebase has a generous free tier - you likely won't exceed it

### 2. Backup Your Database

Firebase doesn't have automatic exports in the free plan, but you can:

1. Go to **Firestore Database**
2. Periodically export important data manually
3. OR set up Cloud Functions for automated backups (requires Blaze plan)

### 3. Monitor Usage

1. Check **Authentication** → **Usage** regularly
2. Check **Firestore Database** → **Usage** regularly
3. Make sure you're within free tier limits

---

## Troubleshooting

### "Firebase: Error (auth/wrong-password)"
- Check that the password in Firestore `config/passwords` matches the password you're entering
- Check that you created the user in Authentication

### "Missing or insufficient permissions"
- Verify security rules are published correctly
- Make sure you're logged in
- Check that the email matches exactly (gervansealy@gmail.com or footballzess@gmail.com)

### Data Not Showing
- Open browser console (F12) and check for errors
- Verify Firebase config in `js/firebase-config.js` is correct
- Make sure you created the `config` collection with `passwords` and `points` documents

### Can't Add Players
- Make sure you're logged in as Admin
- Check Firestore rules are published
- Open browser console and check for errors

### GitHub Pages Shows 404
- Wait a few minutes after enabling GitHub Pages
- Make sure you selected the correct branch (`main`) and folder (`root`)
- Check that `index.html` is in the root of your repository

---

## Summary Checklist

✅ Firebase project created  
✅ Web app registered and config copied  
✅ Email/Password authentication enabled  
✅ Admin user created (gervansealy@gmail.com)  
✅ Viewer user created (footballzess@gmail.com)  
✅ Firestore database created  
✅ `config/passwords` document created  
✅ `config/points` document created  
✅ Security rules published  
✅ `firebase-config.js` updated with your config  
✅ Tested locally in browser  
✅ GitHub repository created  
✅ Code pushed to GitHub  
✅ GitHub Pages enabled  
✅ Live site tested  

---

## Next Steps

1. **Change passwords** to secure ones (use Settings page as Admin)
2. **Add players** to your database
3. **Record game stats** after matches
4. **Share the URL** with your team
5. **Bookmark** both admin and viewer passwords securely

---

## Support

If you encounter issues:
1. Check the browser console for errors (press F12)
2. Verify each step was completed correctly
3. Review the troubleshooting section
4. Check Firebase documentation at [firebase.google.com/docs](https://firebase.google.com/docs)

Enjoy tracking your football stats! ⚽🏆
