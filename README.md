# Football Season Player Database

A professional, real-time football stats tracking application built with Firebase. Track player statistics, game history, standings, and player profiles with role-based access control.

## Features

- **Role-Based Authentication**: Admin and Viewer roles with password-based login
- **Real-Time Updates**: All data syncs instantly across all users via Firebase
- **Season Standings**: Dynamic leaderboard with comprehensive statistics
- **Game History**: View all games with historical standings snapshots
- **Player Profiles**: Detailed player information with images and highlight videos
- **Stats Input**: Easy-to-use interface for recording game statistics
- **Settings Management**: Configurable point values and password management
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## User Roles

### Admin (gervansealy@gmail.com)
- Full control over the application
- Add and manage players
- Input game statistics
- Configure point values
- Change passwords for both roles
- View all data

### Viewer (footballzess@gmail.com)
- View season standings
- View game history
- View player profiles
- Read-only access

## Firebase Setup Instructions

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `football-stats-db` (or your preferred name)
4. Follow the setup wizard (disable Google Analytics if not needed)

### Step 2: Enable Firebase Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication
3. Click on **Users** tab
4. Add two users:
   - **Admin**: Email: `gervansealy@gmail.com`, Password: `YourAdminPassword123`
   - **Viewer**: Email: `footballzess@gmail.com`, Password: `YourViewerPassword123`

### Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Production mode** (we'll set custom rules)
4. Select your preferred region
5. Click **Enable**

### Step 4: Set Up Firestore Collections

You need to create initial documents in Firestore:

1. Go to **Firestore Database** → **Data**
2. Create a collection called `config`
3. Add a document with ID `passwords`:
   ```
   admin: "YourAdminPassword123"
   viewer: "YourViewerPassword123"
   ```
4. Add another document with ID `points`:
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

### Step 5: Set Up Firestore Security Rules

1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Copy the contents from `firestore.rules` file in this repository
3. Click **Publish**

### Step 6: Configure the Application

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`)
4. Register your app with a nickname
5. Copy the Firebase configuration object
6. Open `js/firebase-config.js` in your code editor
7. Replace the placeholder values with your Firebase config:

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

### Step 7: Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to repository **Settings** → **Pages**
4. Under "Source", select `main` branch and `/root` folder
5. Click **Save**
6. Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## Security Notes

✅ **Secure Configuration**:
- Firebase security rules restrict access to authenticated users only
- Only admin email can modify data
- Viewer email has read-only access
- All other access is denied

✅ **Data Protection**:
- Passwords are stored securely in Firestore
- Authentication is handled by Firebase
- API keys in `firebase-config.js` are safe to expose (they're restricted by security rules)

⚠️ **Important**:
- Change default passwords immediately after setup
- Keep your Firebase project private
- Regularly backup your Firestore data
- Monitor Firebase usage in the console

## Data Structure

### Collections

#### `players`
```javascript
{
  firstName: string
  lastName: string
  position: string
  height: string
  weight: number
  birthday: date
  hobbies: string
  headshotLink: string
  highlightVideos: array<string>
  createdAt: timestamp
}
```

#### `games`
```javascript
{
  date: string (YYYY-MM-DD)
  year: number
  playerStats: {
    [playerId]: {
      win: number
      draw: number
      loss: number
      cleanSheet: boolean
      goals: number
      captainWin: number
      captainDraw: number
      captainLoss: number
    }
  }
  createdAt: timestamp
}
```

#### `config`
- **points**: Point values for calculations
- **passwords**: User passwords for authentication

## Usage

### Adding Players
1. Login as Admin
2. Go to **Player Profiles**
3. Click **Add New Player**
4. Fill in player information
5. For images: Use direct URLs or Google Drive links (make sure they're publicly accessible)
6. For videos: YouTube and Google Drive links are automatically embedded

### Recording Game Stats
1. Login as Admin
2. Go to **Input Stats**
3. Select game date
4. Enter statistics for each player
5. Click **Save Game Stats**

### Viewing Standings
- Current season standings update automatically
- Click year dropdown to view different seasons
- Standings are sorted by: Points → Wins → Win %

### Game History
- View all recorded games in chronological order
- See standings as they were after each game
- Useful for tracking progress over time

### Configuring Points
1. Login as Admin
2. Go to **Settings**
3. Modify point values as needed
4. Click **Save Settings**
5. New calculations will apply to all games

### Changing Passwords
1. Login as Admin
2. Go to **Settings**
3. Scroll to Password Management
4. Enter new password and confirm
5. Click update button

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore Database)
- **Authentication**: Firebase Authentication
- **Hosting**: GitHub Pages
- **Real-time Sync**: Firestore onSnapshot listeners

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## Troubleshooting

### Login Issues
- Verify users are created in Firebase Authentication
- Check that passwords in Firestore match authentication
- Clear browser cache and try again

### Data Not Showing
- Check Firebase security rules are properly set
- Verify you're logged in with correct credentials
- Check browser console for errors

### Images Not Loading
- Ensure image URLs are publicly accessible
- For Google Drive: Right-click image → Share → "Anyone with the link"
- Use direct image URLs when possible

### Videos Not Playing
- YouTube links work best for embedding
- Google Drive videos may require "Anyone with the link" access
- Check that video links are properly formatted

## Support

For issues or questions, contact the system administrator at gervansealy@gmail.com

## License

Private - All Rights Reserved
