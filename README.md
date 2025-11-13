# Football Season Player Database

A comprehensive HTML-based football player statistics tracking system with role-based permissions.

## Features

### Admin-Controlled Permission System
- **Three Access Levels**:
  - **Admin**: Full control + manage access passwords for all roles
  - **Editor**: Full access to add, edit, and delete all data (password protected)
  - **Viewer**: Read-only access to standings, game history, and player profiles (optional password)
- **Password Protected**: Admin sets passwords to control who can access each role
- **Secure Access**: Users must enter the correct password for their selected role
- **Admin Control**: Only admins can change access passwords
- **Smart Navigation**: Navigation adapts to role
  - Viewers see "Game History" button (direct access, no edit options)
  - Admin/Editor see "Input Stats" button (both tabs: input form + history)
- **Persistent**: Role selection is saved and remembered
- **Easy Switching**: Change roles anytime with password verification
- **Visual Indicator**: Current role displayed in header (Admin 🛡️, Editor 🔓, Viewer 👁️)

### Year Filtering System
- **Default View**: Shows current year data automatically
- **Historical Data**: Filter by year to view past seasons
- **Available Everywhere**: Year filters in Standings, Player Profiles, and Game History
- **Automatic Tracking**: Each game is tagged with the year it was recorded

### Section 1: Standings Table
- **Player Rankings** based on total points for selected year
- **Comprehensive Stats**: Games Played, Wins, Draws, Losses, Clean Sheets, Goals Scored, Captain Wins, Captain Losses
- **Auto-calculated Metrics**:
  - Win:Loss Ratio (Wins - Losses)
  - Win % (Wins ÷ Games × 100)
  - Total Points (based on configurable point values)
  - Player Rating (rank from 1st descending)
- **Interactive**: Click any player row to view their full profile
- **Year Filter**: View standings for any season

### Section 2: Player Profiles
- **Compact Player Cards**: See all players in a grid layout showing:
  - Player headshot/photo (60x60px)
  - Name, rank, points, and position (on one line)
  - Titles and hobbies (on one line)
  - Minimal vertical height for easy scanning
- **Click to View**: Click any player card to open their full profile in a popup modal
- **Year Filter**: View player stats for any season
- **Add/Edit/Delete Players**
- **Personal Information**:
  - Headshot/picture upload
  - First name, last name
  - Position, height (ft'in"), weight (lbs)
  - Birthday with automatic age calculation
  - Hobbies
- **Titles Held**: Display previous season's achievements
  - Most Wins
  - Most Clean Sheets
  - Most Losses
  - Most Goals Scored
  - Most Captain Wins
  - Highest Player Rank
- **Video Highlights**: Upload and view MP4 video highlights for each player
  - Admin/Editor can upload MP4 videos
  - Viewer can see and play all videos
  - Videos pop up in center of screen at optimal viewing size
  - Click any video thumbnail to play
  - Delete videos individually (Admin/Editor only)
- **Full Statistics Display**: All Section 1 data displayed in an easy-to-read grid layout

### Input Stats Section
- **Date Selection**: Specify the exact date for each game (defaults to today)
- **Bulk Input**: Enter stats for all players at once for faster data entry
- **Automatic Year Tagging**: Games are automatically tagged with the year from the selected date
- **Game History**: 
  - View all games for selected year with full dates
  - Edit or delete previously entered games
  - Year filter to view historical games
  - Games sorted by date (newest first)
- **Automatic Recalculation**: Stats update automatically when games are edited/deleted

### Settings Section
- **Configurable Point Values** for each statistic:
  - Win Points (default: 3)
  - Draw Points (default: 1)
  - Loss Points (default: 0)
  - Clean Sheet Points (default: 1)
  - Goal Points (default: 1 per goal)
  - Captain Win Points (default: 2)
  - Captain Loss Points (default: -1)

## Usage

### First-Time Setup (Admin)
1. Open `index.html` in a web browser
2. **Click "Admin"** button on the welcome screen
3. **Set Access Passwords**:
   - Create an **Admin password** (required)
   - Create an **Editor password** (required)
   - Create a **Viewer password** (optional - leave blank for open viewer access)
4. Click **Save Passwords** - you're now logged in as Admin

### Regular Usage
1. **Select Your Role**:
   - **Admin**: Full control + manage passwords (requires password)
   - **Editor**: Full edit access (requires password)
   - **Viewer**: Read-only access (requires password if set by admin)
2. **Enter the password** for your selected role (if required)
3. **Navigate Available Sections**:
   - **All roles**: Standings, Player Profiles
   - **Viewers**: Game History (dedicated button in navigation)
   - **Admin/Editor**: Input Stats, Settings
4. **Configure Point Values** in Settings (Admin/Editor only - optional, defaults provided)
5. **Add Players** through Player Profiles section (Admin/Editor only)
6. **Input Game Stats** (Admin/Editor only):
   - Select the game date (defaults to today)
   - Enter stats for each player
   - Submit (game is automatically tagged with the year from the date)
7. **View Standings** to see current year's rankings (All roles)
8. **View Player Profiles**: Browse the visual player list and click any player card to see their full profile in a popup (All roles)
9. **View Game History**: 
   - **Viewers**: Click "Game History" button in navigation
   - **Admin/Editor**: Click "Input Stats" → "Game History" tab
   - See all recorded games with full details, dates, and player stats
   - Edit/Delete buttons only visible to Admin/Editor
10. **Filter by Year**: Use year dropdown in any section to view historical data from past seasons (All roles)
11. **Change Role**: Click "Change Role" button in header to switch roles with password verification
12. **Admin Settings**: (Admin only) Access via Settings section to change access passwords anytime

## Point Calculation Example

If configured as:
- Win = 3 points
- Loss = -1 point

A player with 5 wins and 1 loss would have:
- Points = (5 × 3) + (1 × -1) = 15 - 1 = **14 points**

## Data Storage

All data is stored in browser localStorage and persists between sessions.

**Note on Video Highlights**: MP4 video files are stored as base64 in localStorage. Browser localStorage has a size limit (typically 5-10MB). For best results:
- Keep videos short (under 30 seconds recommended)
- Use compressed/optimized MP4 files
- Limit the number of videos per player
- If you hit storage limits, delete older videos to make space for new ones

## Features Summary

✅ **Password-protected admin system** - Control who can access what  
✅ **3-tier role-based permissions** - Admin, Editor, and Viewer access levels  
✅ Unlimited players  
✅ Track detailed statistics per game  
✅ **Year filtering system** - view current or historical data  
✅ Customizable point system  
✅ Automatic calculations (age, win %, W:L ratio, rankings)  
✅ Edit/delete players and games (Admin/Editor only)  
✅ Player profile pictures  
✅ **Video highlights** - Upload and play MP4 videos for each player  
✅ Previous season titles tracking  
✅ Titles and hobbies on compact player cards  
✅ Responsive design for mobile/tablet  
✅ No server required - runs entirely in browser  
✅ Persistent role selection with password protection  

## Permission Roles Explained

### Admin Access 🛡️
- ✅ **All Editor privileges** (see below)
- ✅ **Manage Access Passwords** via Admin Settings
- ✅ Set/change admin password
- ✅ Set/change editor password
- ✅ Set/change viewer password (or disable it)
- ✅ Full control over database access

### Editor Access 🔓
- ✅ View all sections (Standings, Input Stats, Player Profiles, Settings)
- ✅ Add new players
- ✅ Edit player information
- ✅ Delete players
- ✅ Input game statistics
- ✅ Edit game history
- ✅ Delete games
- ✅ Configure point values
- ✅ Full read/write access
- ❌ Cannot access Admin Settings

### Viewer Access 👁️
- ✅ View Standings (read-only)
- ✅ View Player Profiles (read-only)
- ✅ **View Game History** (read-only) - dedicated navigation button
- ✅ Filter data by year
- ✅ See complete game details and dates
- ❌ Cannot add, edit, or delete any data
- ❌ Cannot input new game stats
- ❌ Cannot access Settings section
- ❌ No Edit/Delete buttons visible in any section

## Security Notes

- **Passwords are stored locally** in your browser's localStorage
- **Not for high-security use** - This is a browser-based system without server-side authentication
- **Best for**: Sharing database on a local network or with trusted users
- **Admin tip**: Choose strong, unique passwords for each role
- **Password recovery**: If you forget the admin password, you'll need to clear browser data for this site

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge)

