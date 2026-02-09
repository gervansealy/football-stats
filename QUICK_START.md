# Quick Start Guide ⚡

Get your Football Stats Database up and running in 30 minutes!

## Prerequisites

- Google account (for Firebase)
- GitHub account (for hosting)
- Web browser (Chrome recommended)
- Text editor (VS Code, Notepad++, etc.)

---

## 🔥 Step 1: Firebase Setup (15 minutes)

### Create Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project"
3. Name it `football-stats-db`
4. Disable Google Analytics
5. Click "Create project"

### Enable Authentication
1. Click "Authentication" → "Get started"
2. Enable "Email/Password"
3. Add users:
   - `gervansealy@gmail.com` with a password
   - `footballzess@gmail.com` with a password

### Create Database
1. Click "Firestore Database" → "Create database"
2. Select "Production mode"
3. Choose your region
4. Click "Enable"

### Add Initial Data
1. Create collection `config`
2. Add document `passwords`:
   ```
   admin: "your_admin_password"
   viewer: "your_viewer_password"
   ```
3. Add document `points`:
   ```
   win: 3
   draw: 1
   loss: -1
   cleanSheet: 3
   goal: 1
   captainWin: 5
   captainDraw: 2.5
   captainLoss: -2
   ```

### Set Security Rules
1. Go to "Rules" tab
2. Copy rules from `firestore.rules` file
3. Click "Publish"

### Get Config
1. Click gear icon → "Project settings"
2. Scroll to "Your apps" → Click web icon `</>`
3. Copy the `firebaseConfig` object
4. Paste into `js/firebase-config.js`

---

## 💻 Step 2: Configure Application (5 minutes)

### Update Firebase Config

Open `js/firebase-config.js` and replace:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

### Test Locally

1. Open `index.html` in browser
2. Enter admin password
3. Should redirect to standings
4. Try adding a test player

---

## 🚀 Step 3: Deploy to GitHub Pages (10 minutes)

### Create Repository
1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Name: `football-stats`
4. Set to Public
5. Click "Create repository"

### Push Code

In terminal/command prompt:

```bash
cd path/to/your/project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/football-stats.git
git push -u origin main
```

### Enable Pages
1. Go to Settings → Pages
2. Source: `main` branch, `/ (root)` folder
3. Click Save
4. Wait 2 minutes
5. Visit: `https://YOUR_USERNAME.github.io/football-stats/`

---

## ✅ Verification Checklist

Test these features:

### Admin Login
- [ ] Login with admin password
- [ ] See red "Admin" badge
- [ ] Access all navigation links

### Add Player
- [ ] Go to Player Profiles
- [ ] Click "Add New Player"
- [ ] Fill in details, save
- [ ] Player appears in list

### Input Stats
- [ ] Go to Input Stats
- [ ] Select today's date
- [ ] Enter stats for a player
- [ ] Click "Save Game Stats"
- [ ] Success message appears

### View Standings
- [ ] Go to Standings
- [ ] Player appears in table
- [ ] Stats are correct

### View Game History
- [ ] Go to Game History
- [ ] Game appears with date
- [ ] Standings shown after game

### Viewer Login
- [ ] Logout (click "Change Role")
- [ ] Login with viewer password
- [ ] See green "Viewer" badge
- [ ] Can view data but not edit

### Settings (Admin)
- [ ] Go to Settings
- [ ] Change a point value
- [ ] Save successfully

---

## 📱 First Steps After Setup

### 1. Add All Players
- Go to Player Profiles
- Click "Add New Player" for each team member
- Fill in their information
- Add profile pictures and videos (optional)

### 2. Record First Game
- Go to Input Stats
- Select the game date
- Enter stats for each player who played
- Save the game

### 3. Check Standings
- Go to Standings
- Verify calculations are correct
- Share the URL with your team

### 4. Secure Your Passwords
- Go to Settings
- Change both admin and viewer passwords
- Use strong passwords
- Save them in a password manager

### 5. Bookmark Your Site
- Save admin password separately
- Share viewer password with team
- Bookmark the live URL

---

## 🎯 Common Use Cases

### After Each Game
1. Login as admin
2. Input Stats → Select date
3. Enter all player statistics
4. Save
5. Check standings update

### Viewing Player Performance
1. Go to Player Profiles
2. Click on player card
3. View detailed stats and videos

### Adjusting Point System
1. Settings → Point Values Configuration
2. Modify values as needed
3. Save (applies to all games automatically)

### Sharing with Team
- **Live URL**: `https://YOUR_USERNAME.github.io/football-stats/`
- **Viewer Password**: Share this with team
- **Admin Password**: Keep private!

---

## 🆘 Quick Troubleshooting

### Can't login?
- Check passwords match in Firebase Authentication AND config/passwords
- Clear browser cache
- Check browser console (F12) for errors

### Data not showing?
- Verify Firebase config is correct
- Check Firestore rules are published
- Ensure you're logged in

### Can't add players?
- Must be logged in as admin
- Check browser console for errors
- Verify Firestore rules allow write for admin

### GitHub Pages 404?
- Wait a few minutes after enabling
- Check repository is public
- Verify index.html is in root folder

---

## 📚 More Help

- **Full Setup Guide**: See `FIREBASE_SETUP_GUIDE.md`
- **Complete Documentation**: See `README.md`
- **Project Structure**: See `PROJECT_STRUCTURE.md`
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)

---

## 🎉 You're Done!

Your Football Stats Database is now live and ready to use!

**Share with your team**:
> Hey team! Check out our new stats tracker at:
> [YOUR_URL]
> 
> Password: [VIEWER_PASSWORD]
> 
> You can view standings, game history, and player profiles!

**Admin tasks**:
- Add players before the season starts
- Input stats after each game
- Monitor standings and share updates
- Adjust settings as needed

Enjoy tracking your football season! ⚽🏆

---

**Need help?** Contact admin at gervansealy@gmail.com
