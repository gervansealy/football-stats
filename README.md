# Football Season Player Database

A comprehensive web application for tracking football player statistics, game results, and season standings with real-time Firebase synchronization.

## Features

- **Player Management**: Add, edit, and delete player profiles with photos and highlight videos
- **Game Statistics**: Track wins, losses, draws, goals, clean sheets, and captain performances
- **Dynamic Standings**: Automatically calculated rankings based on configurable point system
- **Dual Access Modes**: Admin and Viewer roles with different permissions
- **Real-time Sync**: All data stored and synchronized through Firebase
- **Game History**: View past games with detailed player statistics and historical standings
- **Customizable Scoring**: Configure point values for wins, draws, losses, goals, clean sheets, and captain bonuses

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Navigate to **Project Settings** > **General**
4. Scroll down to "Your apps" and click the web icon (</>)
5. Register your app and copy the Firebase configuration object

### 2. Configure Firebase in the Application

1. Open `firebase-config.js`
2. Replace the placeholder values with your Firebase project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Enable Firebase Realtime Database

1. In Firebase Console, go to **Build** > **Realtime Database**
2. Click **Create Database**
3. Choose your location
4. Start in **Test Mode** (you can configure security rules later)

### 4. Configure Database Rules (Important for Security)

For production, update your database rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**Note**: For better security in production, implement proper authentication and restrict write access.

### 5. Run the Application

1. Open `index.html` in a web browser
2. Default login credentials:
   - **Admin**: `admin123`
   - **Viewer**: `viewer123`

You can change these passwords in the Settings tab when logged in as Admin.

## Default Point System

- **Win**: 3 points
- **Draw**: 1 point
- **Loss**: -1 point
- **Clean Sheet**: 3 points
- **Goal**: 1 point per goal
- **Captain Win**: 5 bonus points
- **Captain Draw**: 2.5 bonus points
- **Captain Loss**: -2 penalty points

All point values are customizable through the Settings panel (Admin only).

## Data Structure

The application stores three main data collections in Firebase:

### Players
```json
{
  "players": {
    "playerId": {
      "firstName": "John",
      "lastName": "Doe",
      "position": "Forward",
      "height": "6'2\"",
      "weight": "180",
      "birthday": "1995-05-15",
      "hobbies": "Basketball, Gaming",
      "headshot": "https://...",
      "video": "https://..."
    }
  }
}
```

### Games
```json
{
  "games": {
    "gameId": {
      "date": "2026-02-07",
      "timestamp": 1738886400000,
      "playerStats": {
        "playerId": {
          "result": "win",
          "captain": true,
          "cleanSheet": true,
          "goals": 2
        }
      }
    }
  }
}
```

### Settings
```json
{
  "settings": {
    "winPoints": 3,
    "drawPoints": 1,
    "lossPoints": -1,
    "cleanSheetPoints": 3,
    "goalPoints": 1,
    "captainWinPoints": 5,
    "captainDrawPoints": 2.5,
    "captainLossPoints": -2,
    "adminPassword": "admin123",
    "viewerPassword": "viewer123"
  }
}
```

## User Roles

### Admin
- Full access to all features
- Add, edit, and delete players
- Input game statistics
- Modify point system configuration
- Change access passwords
- View all data and reports

### Viewer
- Read-only access
- View standings and player profiles
- View game history
- Cannot modify any data

## Technology Stack

- **Frontend**: Pure HTML, CSS, and JavaScript
- **Database**: Firebase Realtime Database
- **Authentication**: Password-based role authentication
- **Hosting**: Can be hosted on any web server or Firebase Hosting

## Notes

- **No Local Storage**: All data is stored exclusively in Firebase to prevent data loss
- **Real-time Updates**: Changes are automatically synchronized across all connected clients
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Profile Images**: Supports direct image URLs (Google Drive, Dropbox, etc.)
- **Video Links**: Supports YouTube, Google Drive, and other video hosting platforms

## Backup and Data Management

Since all data is stored in Firebase:
1. Regular backups are handled by Firebase
2. You can export data from Firebase Console
3. No risk of data loss from browser cache clearing
4. Data persists across devices and browsers

## Support

For issues or questions, refer to the [Firebase Documentation](https://firebase.google.com/docs) for database-related queries.
