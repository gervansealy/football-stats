let currentUser = null;
let userRole = null;
let currentGameId = null;
let editingGameId = null;
let playersData = {};
let gamesData = {};
let settingsData = {};

// Firebase Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('🔐 User authenticated:', user.email, 'UID:', user.uid);
        
        // Force token refresh to ensure permissions are ready
        user.getIdToken(true).then(() => {
            console.log('✅ Auth token refreshed');
            
            database.ref('users/' + user.uid + '/role').once('value', (snapshot) => {
                userRole = snapshot.val() || 'viewer';
                console.log('👤 User role:', userRole);
                showMainApp();
            }).catch((error) => {
                console.error('❌ Error reading role:', error);
                userRole = 'viewer';
                showMainApp();
            });
        });
    } else {
        currentUser = null;
        userRole = null;
        console.log('🚪 User logged out');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function initializeApp() {
    console.log('🚀 Initializing app...');
    initializeDefaultSettings();
    
    console.log('📡 Setting up database listeners...');
    
    database.ref('settings').on('value', (snapshot) => {
        console.log('⚙️ Settings data:', snapshot.val());
        settingsData = snapshot.val() || getDefaultSettings();
        loadSettingsForm();
    }, (error) => {
        console.error('❌ Settings read error:', error);
    });
    
    database.ref('players').on('value', (snapshot) => {
        console.log('👥 Players data:', snapshot.val());
        playersData = snapshot.val() || {};
        refreshCurrentView();
    }, (error) => {
        console.error('❌ Players read error:', error);
    });
    
    database.ref('games').on('value', (snapshot) => {
        console.log('🎮 Games data:', snapshot.val());
        gamesData = snapshot.val() || {};
        refreshCurrentView();
    }, (error) => {
        console.error('❌ Games read error:', error);
    });
}

function getDefaultSettings() {
    return {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: -1,
        cleanSheetPoints: 3,
        goalPoints: 1,
        captainWinPoints: 5,
        captainDrawPoints: 2.5,
        captainLossPoints: -2
    };
}

function initializeDefaultSettings() {
    database.ref('settings').once('value', (snapshot) => {
        if (!snapshot.exists()) {
            database.ref('settings').set(getDefaultSettings());
        }
    });
}

function login() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!email || !password) {
        errorDiv.textContent = 'Please enter email and password';
        return;
    }
    
    errorDiv.textContent = 'Logging in...';
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            errorDiv.textContent = '';
        })
        .catch((error) => {
            errorDiv.textContent = 'Invalid email or password';
            console.error('Login error:', error);
        });
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    const roleBadge = document.getElementById('roleBadge');
    if (userRole === 'admin') {
        roleBadge.textContent = '🛡️ Admin';
        roleBadge.className = 'role-badge admin';
        enableAdminFeatures();
    } else {
        roleBadge.textContent = '👁️ Viewer';
        roleBadge.className = 'role-badge viewer';
        disableAdminFeatures();
    }
    
    // Wait 500ms for auth token to fully propagate to database
    setTimeout(() => {
        initializeApp();
        showTab('standings');
    }, 500);
}

function logout() {
    auth.signOut().then(() => {
        document.getElementById('emailInput').value = '';
        document.getElementById('passwordInput').value = '';
        document.getElementById('loginError').textContent = '';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

function enableAdminFeatures() {
    document.getElementById('inputStatsTab').style.display = 'block';
    document.getElementById('settingsTab').style.display = 'block';
    document.getElementById('addPlayerBtn').style.display = 'block';
    document.getElementById('adminSection').style.display = 'block';
}

function disableAdminFeatures() {
    document.getElementById('inputStatsTab').style.display = 'none';
    document.getElementById('settingsTab').style.display = 'none';
    document.getElementById('addPlayerBtn').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
}

function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    document.getElementById(`${tabName}Tab`).classList.add('active');
    document.getElementById(`${tabName}Content`).classList.add('active');
    
    if (tabName === 'standings') {
        loadStandings();
    } else if (tabName === 'gameHistory') {
        loadAllGamesHistory();
    } else if (tabName === 'inputStats') {
        loadInputStatsForm();
    } else if (tabName === 'playerProfiles') {
        loadPlayerProfiles();
    }
}

function showStatsTab(tabName) {
    const tabs = document.querySelectorAll('.stats-tab-btn');
    const contents = document.querySelectorAll('.stats-tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    if (tabName === 'input') {
        tabs[0].classList.add('active');
        document.getElementById('inputStatsForm').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('gameHistoryContent').classList.add('active');
        loadGameHistory();
    }
}

function loadStandings() {
    const tbody = document.getElementById('standingsTableBody');
    
    if (Object.keys(playersData).length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="no-data">No players added yet</td></tr>';
        return;
    }
    
    const standings = calculateStandings();
    
    if (standings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="no-data">No games played yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = standings.map((player, index) => {
        const playerData = playersData[player.id];
        const imageUrl = getDisplayImageUrl(playerData.headshot);
        const fallbackUrl = playerData.headshot ? getFallbackImageUrl(playerData.headshot) : '';
        const initials = `${playerData.firstName.charAt(0)}${playerData.lastName.charAt(0)}`;
        
        return `
        <tr onclick="showPlayerProfile('${player.id}')">
            <td>${index + 1}</td>
            <td class="player-name-cell">
                <div class="standings-player-info">
                    ${imageUrl ? `
                        <img class="standings-player-img" src="${imageUrl}" alt="${player.name}" onerror="if(this.src !== '${fallbackUrl}' && '${fallbackUrl}') { this.src='${fallbackUrl}'; } else { this.parentElement.innerHTML='<div class=\\'standings-player-initials\\'>${initials}</div>'; }" />
                    ` : `
                        <div class="standings-player-initials">${initials}</div>
                    `}
                    <span>${player.name}</span>
                </div>
            </td>
            <td>${player.games}</td>
            <td>${player.wins}</td>
            <td>${player.draws}</td>
            <td>${player.losses}</td>
            <td>${player.cleanSheets}</td>
            <td>${player.goals}</td>
            <td>${player.captainWins}</td>
            <td>${player.captainDraws}</td>
            <td>${player.captainLosses}</td>
            <td>${player.wlRatio}</td>
            <td>${player.winPercentage}%</td>
            <td>${player.points}</td>
        </tr>
    `;
    }).join('');
}

function calculateStandings() {
    const standings = [];
    
    for (const playerId in playersData) {
        const player = playersData[playerId];
        const stats = {
            id: playerId,
            name: `${player.firstName} ${player.lastName}`,
            games: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            cleanSheets: 0,
            goals: 0,
            captainWins: 0,
            captainDraws: 0,
            captainLosses: 0,
            points: 0
        };
        
        for (const gameId in gamesData) {
            const game = gamesData[gameId];
            if (game.playerStats && game.playerStats[playerId]) {
                const playerGame = game.playerStats[playerId];
                stats.games++;
                
                if (playerGame.result === 'win') stats.wins++;
                else if (playerGame.result === 'draw') stats.draws++;
                else if (playerGame.result === 'loss') stats.losses++;
                
                if (playerGame.cleanSheet) stats.cleanSheets++;
                stats.goals += playerGame.goals || 0;
                
                if (playerGame.captain) {
                    if (playerGame.result === 'win') stats.captainWins++;
                    else if (playerGame.result === 'draw') stats.captainDraws++;
                    else if (playerGame.result === 'loss') stats.captainLosses++;
                }
                
                stats.points += calculatePlayerGamePoints(playerGame);
            }
        }
        
        stats.wlRatio = stats.losses === 0 ? stats.wins.toFixed(1) : (stats.wins / stats.losses).toFixed(2);
        stats.winPercentage = stats.games === 0 ? 0 : ((stats.wins / stats.games) * 100).toFixed(1);
        
        if (stats.games > 0) {
            standings.push(stats);
        }
    }
    
    standings.sort((a, b) => b.points - a.points);
    
    return standings;
}

function calculatePlayerGamePoints(playerGame) {
    let points = 0;
    
    if (playerGame.result === 'win') {
        points += settingsData.winPoints || 3;
        if (playerGame.captain) {
            points += settingsData.captainWinPoints || 5;
        }
    } else if (playerGame.result === 'draw') {
        points += settingsData.drawPoints || 1;
        if (playerGame.captain) {
            points += settingsData.captainDrawPoints || 2.5;
        }
    } else if (playerGame.result === 'loss') {
        points += settingsData.lossPoints || -1;
        if (playerGame.captain) {
            points += settingsData.captainLossPoints || -2;
        }
    }
    
    if (playerGame.cleanSheet) {
        points += settingsData.cleanSheetPoints || 3;
    }
    
    points += (playerGame.goals || 0) * (settingsData.goalPoints || 1);
    
    return points;
}

function loadInputStatsForm(gameId = null) {
    const container = document.getElementById('playerStatsInputs');
    const submitBtn = document.getElementById('submitStatsBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const actionsDiv = document.getElementById('gameFormActions');
    
    if (Object.keys(playersData).length === 0) {
        container.innerHTML = '<p class="no-data">No players added yet. Add players in the Player Profiles section.</p>';
        actionsDiv.style.display = 'none';
        return;
    }
    
    if (!gameId && editingGameId) {
        gameId = editingGameId;
    }
    
    let gameData = null;
    let isEditing = false;
    
    if (gameId && gamesData[gameId]) {
        gameData = gamesData[gameId];
        isEditing = true;
        editingGameId = gameId;
        console.log('Loading game data for edit:', gameId, gameData);
        document.getElementById('gameDate').value = gameData.date;
        submitBtn.textContent = 'Update Game Stats';
        submitBtn.className = 'btn-warning';
        cancelBtn.style.display = 'block';
    } else {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('gameDate').value = today;
        submitBtn.textContent = 'Submit All Stats';
        submitBtn.className = 'btn-primary';
        cancelBtn.style.display = 'none';
        if (!gameId) {
            editingGameId = null;
        }
    }
    
    let html = isEditing ? '<div class="edit-mode-banner">📝 Editing Game - Make changes below</div>' : '';
    html += '<div class="player-stats-grid">';
    
    for (const playerId in playersData) {
        const player = playersData[playerId];
        const playerStats = gameData && gameData.playerStats && gameData.playerStats[playerId] ? gameData.playerStats[playerId] : null;
        
        if (isEditing && playerStats) {
            console.log(`Player ${player.firstName} ${player.lastName}:`, playerStats);
        }
        
        const winChecked = playerStats && playerStats.result === 'win' ? 'checked' : '';
        const drawChecked = playerStats && playerStats.result === 'draw' ? 'checked' : '';
        const lossChecked = playerStats && playerStats.result === 'loss' ? 'checked' : '';
        const captainChecked = playerStats && playerStats.captain === true ? 'checked' : '';
        const cleanSheetChecked = playerStats && playerStats.cleanSheet === true ? 'checked' : '';
        const goalsValue = playerStats && typeof playerStats.goals === 'number' ? playerStats.goals : 0;
        
        html += `
            <div class="player-stat-card">
                <h3>${player.firstName} ${player.lastName}</h3>
                <div class="stat-form">
                    <div class="form-section">
                        <strong>Game Result:</strong>
                        <label>
                            <input type="radio" name="result_${playerId}" value="win" ${winChecked} /> Win
                        </label>
                        <label>
                            <input type="radio" name="result_${playerId}" value="draw" ${drawChecked} /> Draw
                        </label>
                        <label>
                            <input type="radio" name="result_${playerId}" value="loss" ${lossChecked} /> Loss
                        </label>
                    </div>
                    <div class="form-section">
                        <strong>Additional Stats:</strong>
                        <label>
                            <input type="checkbox" id="captain_${playerId}" ${captainChecked} /> Was Captain
                        </label>
                        <label>
                            <input type="checkbox" id="cleanSheet_${playerId}" ${cleanSheetChecked} /> Clean Sheet
                        </label>
                        <label>
                            Goals: <input type="number" id="goals_${playerId}" value="${goalsValue}" min="0" style="width: 60px;" />
                        </label>
                    </div>
                    <div class="form-note">
                        <small>💡 Checking "Was Captain" + selecting a result will count as Captain Win/Draw/Loss</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    actionsDiv.style.display = 'flex';
}

function submitGameStats() {
    const gameDate = document.getElementById('gameDate').value;
    
    if (!gameDate) {
        alert('Please select a game date');
        return;
    }
    
    const dateParts = gameDate.split('-');
    const timestamp = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0).getTime();
    
    const gameStats = {
        date: gameDate,
        timestamp: timestamp,
        playerStats: {}
    };
    
    let hasAnyStats = false;
    
    for (const playerId in playersData) {
        const resultRadios = document.getElementsByName(`result_${playerId}`);
        let result = null;
        
        for (const radio of resultRadios) {
            if (radio.checked) {
                result = radio.value;
                break;
            }
        }
        
        if (result) {
            hasAnyStats = true;
            gameStats.playerStats[playerId] = {
                result: result,
                captain: document.getElementById(`captain_${playerId}`).checked,
                cleanSheet: document.getElementById(`cleanSheet_${playerId}`).checked,
                goals: parseInt(document.getElementById(`goals_${playerId}`).value) || 0
            };
        }
    }
    
    if (!hasAnyStats) {
        alert('Please enter stats for at least one player');
        return;
    }
    
    console.log('Editing game ID:', editingGameId);
    console.log('Game stats to save:', gameStats);
    
    if (editingGameId) {
        console.log('Updating existing game:', editingGameId);
        database.ref(`games/${editingGameId}`).set(gameStats).then(() => {
            alert('Game stats updated successfully!');
            editingGameId = null;
            loadInputStatsForm();
            showTab('gameHistory');
        }).catch((error) => {
            alert('Error updating game stats: ' + error.message);
        });
    } else {
        console.log('Creating new game');
        const newGameRef = database.ref('games').push();
        newGameRef.set(gameStats).then(() => {
            alert('Game stats saved successfully!');
            loadInputStatsForm();
            showTab('gameHistory');
        }).catch((error) => {
            alert('Error saving game stats: ' + error.message);
        });
    }
}

function loadGameHistory() {
    const container = document.getElementById('gameHistoryList');
    
    if (Object.keys(gamesData).length === 0) {
        container.innerHTML = '<p class="no-data">No games recorded yet</p>';
        return;
    }
    
    const games = Object.entries(gamesData)
        .map(([id, game]) => ({ id, ...game }))
        .sort((a, b) => b.timestamp - a.timestamp);
    
    container.innerHTML = games.map(game => {
        const dateParts = game.date.split('-');
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const playerCount = Object.keys(game.playerStats || {}).length;
        
        return `
            <div class="game-card" onclick="showGameDetails('${game.id}')">
                <div class="game-date">${dateStr}</div>
                <div class="game-info">${playerCount} players</div>
            </div>
        `;
    }).join('');
}

function loadAllGamesHistory() {
    const container = document.getElementById('allGamesHistoryList');
    
    if (Object.keys(gamesData).length === 0) {
        container.innerHTML = '<p class="no-data">No games recorded yet</p>';
        return;
    }
    
    const games = Object.entries(gamesData)
        .map(([id, game]) => ({ id, ...game }))
        .sort((a, b) => b.timestamp - a.timestamp);
    
    container.innerHTML = games.map(game => {
        const dateParts = game.date.split('-');
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const playerCount = Object.keys(game.playerStats || {}).length;
        
        return `
            <div class="game-card" onclick="showGameDetails('${game.id}')">
                <div class="game-date">${dateStr}</div>
                <div class="game-info">${playerCount} players</div>
            </div>
        `;
    }).join('');
}

function showGameDetails(gameId) {
    currentGameId = gameId;
    const game = gamesData[gameId];
    const dateParts = game.date.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('gameDetailsTitle').textContent = `Game Details - ${dateStr}`;
    
    if (currentUser === 'admin') {
        document.getElementById('gameDetailsActions').style.display = 'block';
    } else {
        document.getElementById('gameDetailsActions').style.display = 'none';
    }
    
    loadGamePlayerStats(game);
    loadGameStandingsSnapshot(gameId);
    
    document.getElementById('gameDetailsModal').style.display = 'flex';
}

function loadGamePlayerStats(game) {
    const container = document.getElementById('gamePlayerStatsContent');
    
    let html = '<div class="game-player-stats-list">';
    
    for (const playerId in game.playerStats) {
        if (playersData[playerId]) {
            const player = playersData[playerId];
            const stats = game.playerStats[playerId];
            const points = calculatePlayerGamePoints(stats);
            
            html += `
                <div class="game-player-stat-item">
                    <div class="player-name">${player.firstName} ${player.lastName}</div>
                    <div class="stat-badges">
                        <span class="badge result-${stats.result}">${stats.result}</span>
                        ${stats.captain ? '<span class="badge captain">Captain</span>' : ''}
                        ${stats.cleanSheet ? '<span class="badge clean-sheet">Clean Sheet</span>' : ''}
                        ${stats.goals > 0 ? `<span class="badge goals">${stats.goals} Goal${stats.goals > 1 ? 's' : ''}</span>` : ''}
                        <span class="badge points">${points} pts</span>
                    </div>
                </div>
            `;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function loadGameStandingsSnapshot(gameId) {
    const standings = calculateStandingsUpToGame(gameId);
    const tbody = document.getElementById('gameStandingsTableBody');
    
    tbody.innerHTML = standings.map((player, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${player.games}</td>
            <td>${player.wins}</td>
            <td>${player.draws}</td>
            <td>${player.losses}</td>
            <td>${player.points}</td>
        </tr>
    `).join('');
}

function calculateStandingsUpToGame(targetGameId) {
    const standings = [];
    const targetGame = gamesData[targetGameId];
    
    for (const playerId in playersData) {
        const player = playersData[playerId];
        const stats = {
            id: playerId,
            name: `${player.firstName} ${player.lastName}`,
            games: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0
        };
        
        for (const gameId in gamesData) {
            const game = gamesData[gameId];
            if (game.timestamp <= targetGame.timestamp && game.playerStats && game.playerStats[playerId]) {
                const playerGame = game.playerStats[playerId];
                stats.games++;
                
                if (playerGame.result === 'win') stats.wins++;
                else if (playerGame.result === 'draw') stats.draws++;
                else if (playerGame.result === 'loss') stats.losses++;
                
                stats.points += calculatePlayerGamePoints(playerGame);
            }
        }
        
        if (stats.games > 0) {
            standings.push(stats);
        }
    }
    
    standings.sort((a, b) => b.points - a.points);
    
    return standings;
}

function showGameTab(tabName) {
    const tabs = document.querySelectorAll('.game-tab-btn');
    const contents = document.querySelectorAll('.game-tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    if (tabName === 'stats') {
        tabs[0].classList.add('active');
        document.getElementById('gamePlayerStats').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('gameStandingsSnapshot').classList.add('active');
    }
}

function editGame() {
    if (!currentGameId || !gamesData[currentGameId]) {
        alert('Error: Game data not found');
        return;
    }
    
    editingGameId = currentGameId;
    const gameToEdit = currentGameId;
    closeGameDetailsModal();
    showTab('inputStats');
    
    setTimeout(() => {
        loadInputStatsForm(gameToEdit);
    }, 100);
}

function cancelEditGame() {
    editingGameId = null;
    loadInputStatsForm();
}

function deleteGame() {
    if (confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
        database.ref(`games/${currentGameId}`).remove().then(() => {
            alert('Game deleted successfully');
            closeGameDetailsModal();
        }).catch((error) => {
            alert('Error deleting game: ' + error.message);
        });
    }
}

function closeGameDetailsModal() {
    document.getElementById('gameDetailsModal').style.display = 'none';
    currentGameId = null;
}

function loadPlayerProfiles() {
    const container = document.getElementById('playerProfilesList');
    
    if (Object.keys(playersData).length === 0) {
        container.innerHTML = '<p class="no-data">No players added yet.<br>Click "Add New Player" to get started.</p>';
        return;
    }
    
    // Convert players to array with stats and sort by points
    const playersArray = Object.entries(playersData).map(([id, player]) => {
        const stats = calculatePlayerStats(id);
        return { id, player, stats };
    });
    
    // Sort by points (descending), then by wins if points are equal
    playersArray.sort((a, b) => {
        if (b.stats.points !== a.stats.points) {
            return b.stats.points - a.stats.points;
        }
        return b.stats.wins - a.stats.wins;
    });
    
    container.innerHTML = '<div class="player-grid">' + playersArray.map(({ id, player, stats }) => {
        const imageUrl = getDisplayImageUrl(player.headshot);
        const fallbackUrl = player.headshot ? getFallbackImageUrl(player.headshot) : '';
        const age = player.birthday ? calculateAge(player.birthday) : 'N/A';
        
        return `
        <div class="player-card" onclick="showPlayerProfile('${id}')">
            <div class="player-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${player.firstName} ${player.lastName}" onerror="if(this.src !== '${fallbackUrl}' && '${fallbackUrl}') { this.src='${fallbackUrl}'; } else { this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2240%22 text-anchor=%22middle%22 dy=%22.3em%22%3E${player.firstName.charAt(0)}${player.lastName.charAt(0)}%3C/text%3E%3C/svg%3E'; }" />` : 
                `<div class="player-initials">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`}
            </div>
            <div class="player-info">
                <h3>${player.firstName} ${player.lastName}</h3>
                <div class="player-position">${player.position || 'No Position'} ${age !== 'N/A' ? '• Age ' + age : ''}</div>
                
                <div class="player-quick-stats">
                    <div class="player-quick-stat">
                        <div class="value">${stats.games}</div>
                        <div class="label">Games</div>
                    </div>
                    <div class="player-quick-stat">
                        <div class="value">${stats.wins}</div>
                        <div class="label">Wins</div>
                    </div>
                    <div class="player-quick-stat">
                        <div class="value">${stats.points}</div>
                        <div class="label">Points</div>
                    </div>
                </div>
                
                ${player.hobbies || player.height || player.weight ? `
                <div class="player-meta">
                    ${player.height ? `<div class="player-meta-item">📏 ${player.height}</div>` : ''}
                    ${player.weight ? `<div class="player-meta-item">⚖️ ${player.weight} lbs</div>` : ''}
                    ${player.hobbies ? `<div class="player-meta-item">🎯 ${player.hobbies.split(',')[0].trim()}${player.hobbies.split(',').length > 1 ? '...' : ''}</div>` : ''}
                </div>
                ` : ''}
            </div>
            ${currentUser === 'admin' ? `
                <div class="player-actions">
                    <button onclick="event.stopPropagation(); editPlayer('${id}')" class="btn-small">Edit</button>
                    <button onclick="event.stopPropagation(); deletePlayer('${id}')" class="btn-small btn-danger">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
    }).join('') + '</div>';
}

function getFallbackImageUrl(url) {
    if (!url) return '';
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
}

function addVideoLink() {
    const container = document.getElementById('videoLinksContainer');
    const newItem = document.createElement('div');
    newItem.className = 'video-link-item';
    newItem.innerHTML = `
        <input type="text" class="video-link-input" placeholder="Paste video link (YouTube or Google Drive)" />
        <button type="button" class="btn-small btn-danger" onclick="removeVideoLink(this)">Remove</button>
    `;
    container.appendChild(newItem);
}

function removeVideoLink(button) {
    button.parentElement.remove();
}

function showAddPlayerModal() {
    document.getElementById('modalTitle').textContent = 'Add New Player';
    document.getElementById('editPlayerId').value = '';
    document.getElementById('playerFirstName').value = '';
    document.getElementById('playerLastName').value = '';
    document.getElementById('playerPosition').value = '';
    document.getElementById('playerHeight').value = '';
    document.getElementById('playerWeight').value = '';
    document.getElementById('playerBirthday').value = '';
    document.getElementById('playerHobbies').value = '';
    document.getElementById('playerHeadshot').value = '';
    
    const videoContainer = document.getElementById('videoLinksContainer');
    videoContainer.innerHTML = `
        <div class="video-link-item">
            <input type="text" class="video-link-input" placeholder="Paste video link (YouTube or Google Drive)" />
            <button type="button" class="btn-small btn-danger" onclick="removeVideoLink(this)" style="display:none;">Remove</button>
        </div>
    `;
    
    document.getElementById('savePlayerBtn').textContent = 'Add Player';
    
    document.getElementById('addPlayerModal').style.display = 'flex';
}

function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').style.display = 'none';
}

function convertGoogleDriveLink(url) {
    if (!url) return url;
    
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(driveRegex);
    
    if (match && match[1]) {
        const fileId = match[1];
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    return url;
}

function getDisplayImageUrl(url) {
    if (!url) return '';
    const converted = convertGoogleDriveLink(url);
    console.log('Original URL:', url);
    console.log('Converted URL:', converted);
    return converted;
}

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
            preview.classList.add('show');
        };
        
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '';
        preview.classList.remove('show');
    }
}

function previewVideo(input, previewId) {
    const preview = document.getElementById(previewId);
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        
        const videoURL = URL.createObjectURL(file);
        preview.innerHTML = `
            <video controls style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                <source src="${videoURL}" type="${file.type}">
            </video>
            <p style="margin-top: 0.5rem; color: #7f8c8d; font-size: 13px;">File size: ${fileSizeMB} MB</p>
        `;
        preview.classList.add('show');
    } else {
        preview.innerHTML = '';
        preview.classList.remove('show');
    }
}

async function uploadImageToFirebase(file, path) {
    if (!file) return null;
    
    if (!storage) {
        alert('Error: Firebase Storage is not initialized. Please enable Storage in Firebase Console.');
        throw new Error('Firebase Storage not initialized');
    }
    
    try {
        console.log('Uploading file:', file.name, 'Size:', (file.size / 1024).toFixed(2) + ' KB');
        const timestamp = Date.now();
        const fileName = `${path}/${timestamp}_${file.name}`;
        const storageRef = storage.ref(fileName);
        
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        console.log('Upload successful! URL:', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        alert('Upload failed: ' + error.message + '\n\nPlease ensure Firebase Storage is enabled in your Firebase Console.');
        throw error;
    }
}

async function uploadVideoToFirebase(file, path, progressCallback) {
    if (!file) return null;
    
    if (!storage) {
        alert('Error: Firebase Storage is not initialized. Please enable Storage in Firebase Console.');
        throw new Error('Firebase Storage not initialized');
    }
    
    try {
        console.log('Uploading video:', file.name, 'Size:', (file.size / (1024 * 1024)).toFixed(2) + ' MB');
        const timestamp = Date.now();
        const fileName = `${path}/${timestamp}_${file.name}`;
        const storageRef = storage.ref(fileName);
        
        const uploadTask = storageRef.put(file);
        
        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload progress:', progress.toFixed(2) + '%');
                    if (progressCallback) {
                        progressCallback(progress);
                    }
                },
                (error) => {
                    console.error('Error uploading video:', error);
                    alert('Video upload failed: ' + error.message + '\n\nPlease ensure Firebase Storage is enabled.');
                    reject(error);
                },
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log('Video upload successful! URL:', downloadURL);
                    resolve(downloadURL);
                }
            );
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        alert('Video upload failed: ' + error.message);
        throw error;
    }
}

function savePlayer() {
    const playerId = document.getElementById('editPlayerId').value;
    const firstName = document.getElementById('playerFirstName').value.trim();
    const lastName = document.getElementById('playerLastName').value.trim();
    
    if (!firstName || !lastName) {
        alert('First name and last name are required');
        return;
    }
    
    let headshotUrl = document.getElementById('playerHeadshot').value.trim();
    headshotUrl = convertGoogleDriveLink(headshotUrl);
    
    const videoInputs = document.querySelectorAll('.video-link-input');
    const videos = [];
    videoInputs.forEach(input => {
        const url = input.value.trim();
        if (url) {
            videos.push(url);
        }
    });
    
    const playerData = {
        firstName,
        lastName,
        position: document.getElementById('playerPosition').value.trim(),
        height: document.getElementById('playerHeight').value.trim(),
        weight: document.getElementById('playerWeight').value.trim(),
        birthday: document.getElementById('playerBirthday').value,
        hobbies: document.getElementById('playerHobbies').value.trim(),
        headshot: headshotUrl,
        videos: videos
    };
    
    if (playerId) {
        database.ref(`players/${playerId}`).update(playerData).then(() => {
            alert('Player updated successfully!');
            closeAddPlayerModal();
        }).catch((error) => {
            alert('Error updating player: ' + error.message);
        });
    } else {
        database.ref('players').push(playerData).then(() => {
            alert('Player added successfully!');
            closeAddPlayerModal();
        }).catch((error) => {
            alert('Error adding player: ' + error.message);
        });
    }
}

function editPlayer(playerId) {
    const player = playersData[playerId];
    
    document.getElementById('modalTitle').textContent = 'Edit Player';
    document.getElementById('editPlayerId').value = playerId;
    document.getElementById('playerFirstName').value = player.firstName;
    document.getElementById('playerLastName').value = player.lastName;
    document.getElementById('playerPosition').value = player.position || '';
    document.getElementById('playerHeight').value = player.height || '';
    document.getElementById('playerWeight').value = player.weight || '';
    document.getElementById('playerBirthday').value = player.birthday || '';
    document.getElementById('playerHobbies').value = player.hobbies || '';
    document.getElementById('playerHeadshot').value = player.headshot || '';
    
    const videoContainer = document.getElementById('videoLinksContainer');
    const videos = player.videos || (player.video ? [player.video] : []);
    
    if (videos.length === 0) {
        videoContainer.innerHTML = `
            <div class="video-link-item">
                <input type="text" class="video-link-input" placeholder="Paste video link (YouTube or Google Drive)" />
                <button type="button" class="btn-small btn-danger" onclick="removeVideoLink(this)" style="display:none;">Remove</button>
            </div>
        `;
    } else {
        videoContainer.innerHTML = videos.map((video, index) => `
            <div class="video-link-item">
                <input type="text" class="video-link-input" value="${video}" placeholder="Paste video link (YouTube or Google Drive)" />
                <button type="button" class="btn-small btn-danger" onclick="removeVideoLink(this)" ${videos.length === 1 && index === 0 ? 'style="display:none;"' : ''}>Remove</button>
            </div>
        `).join('');
    }
    
    document.getElementById('savePlayerBtn').textContent = 'Update Player';
    
    document.getElementById('addPlayerModal').style.display = 'flex';
}

function deletePlayer(playerId) {
    const player = playersData[playerId];
    
    if (confirm(`Are you sure you want to delete ${player.firstName} ${player.lastName}? This will also remove all their game statistics.`)) {
        const updates = {};
        updates[`players/${playerId}`] = null;
        
        for (const gameId in gamesData) {
            if (gamesData[gameId].playerStats && gamesData[gameId].playerStats[playerId]) {
                updates[`games/${gameId}/playerStats/${playerId}`] = null;
            }
        }
        
        database.ref().update(updates).then(() => {
            alert('Player deleted successfully');
        }).catch((error) => {
            alert('Error deleting player: ' + error.message);
        });
    }
}

function showPlayerProfile(playerId) {
    const player = playersData[playerId];
    const playerStats = calculatePlayerStats(playerId);
    
    const age = player.birthday ? calculateAge(player.birthday) : 'N/A';
    const imageUrl = getDisplayImageUrl(player.headshot);
    const fallbackUrl = getFallbackImageUrl(player.headshot);
    const videos = player.videos || (player.video ? [player.video] : []);
    
    const content = `
        <div class="player-profile-details">
            <div class="profile-header">
                <div class="profile-image">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${player.firstName} ${player.lastName}" onerror="if(this.src !== '${fallbackUrl}' && '${fallbackUrl}') { this.src='${fallbackUrl}'; } else { this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23ddd%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2280%22 text-anchor=%22middle%22 dy=%22.3em%22%3E${player.firstName.charAt(0)}${player.lastName.charAt(0)}%3C/text%3E%3C/svg%3E'; }" />` : 
                    `<div class="profile-initials">${player.firstName.charAt(0)}${player.lastName.charAt(0)}</div>`}
                </div>
                <div class="profile-info">
                    <h2>${player.firstName} ${player.lastName}</h2>
                    <p><strong>Position:</strong> ${player.position || 'N/A'}</p>
                    <p><strong>Height:</strong> ${player.height || 'N/A'}</p>
                    <p><strong>Weight:</strong> ${player.weight || 'N/A'} lbs</p>
                    <p><strong>Age:</strong> ${age}</p>
                    ${player.hobbies ? `<p><strong>Hobbies:</strong> ${player.hobbies}</p>` : ''}
                </div>
            </div>
            
            ${videos && videos.length > 0 ? `
                <div class="profile-video">
                    <h3>Highlight Videos</h3>
                    <div class="video-links-display">
                        ${videos.map((video, index) => `
                            <button onclick="playVideo('${video}', '${player.firstName} ${player.lastName}', ${index + 1})" class="video-link-badge">
                                ▶️ Video ${index + 1}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="profile-stats">
                <h3>Career Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.games}</div>
                        <div class="stat-label">Games</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.wins}</div>
                        <div class="stat-label">Wins</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.draws}</div>
                        <div class="stat-label">Draws</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.losses}</div>
                        <div class="stat-label">Losses</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.goals}</div>
                        <div class="stat-label">Goals</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.cleanSheets}</div>
                        <div class="stat-label">Clean Sheets</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.captainWins}</div>
                        <div class="stat-label">Captain Wins</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.captainDraws}</div>
                        <div class="stat-label">Captain Draws</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.captainLosses}</div>
                        <div class="stat-label">Captain Losses</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.points}</div>
                        <div class="stat-label">Total Points</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${playerStats.winPercentage}%</div>
                        <div class="stat-label">Win %</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('playerProfileTitle').textContent = `${player.firstName} ${player.lastName}`;
    document.getElementById('playerProfileContent').innerHTML = content;
    document.getElementById('playerProfileModal').style.display = 'flex';
}

function calculateAge(birthday) {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

function calculatePlayerStats(playerId) {
    const stats = {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals: 0,
        cleanSheets: 0,
        captainWins: 0,
        captainDraws: 0,
        captainLosses: 0,
        points: 0,
        winPercentage: 0
    };
    
    for (const gameId in gamesData) {
        const game = gamesData[gameId];
        if (game.playerStats && game.playerStats[playerId]) {
            const playerGame = game.playerStats[playerId];
            stats.games++;
            
            if (playerGame.result === 'win') {
                stats.wins++;
                if (playerGame.captain) stats.captainWins++;
            }
            else if (playerGame.result === 'draw') {
                stats.draws++;
                if (playerGame.captain) stats.captainDraws++;
            }
            else if (playerGame.result === 'loss') {
                stats.losses++;
                if (playerGame.captain) stats.captainLosses++;
            }
            
            stats.goals += playerGame.goals || 0;
            if (playerGame.cleanSheet) stats.cleanSheets++;
            stats.points += calculatePlayerGamePoints(playerGame);
        }
    }
    
    stats.winPercentage = stats.games === 0 ? 0 : ((stats.wins / stats.games) * 100).toFixed(1);
    
    return stats;
}

function closePlayerProfileModal() {
    document.getElementById('playerProfileModal').style.display = 'none';
}

function loadSettingsForm() {
    document.getElementById('winPoints').value = settingsData.winPoints || 3;
    document.getElementById('drawPoints').value = settingsData.drawPoints || 1;
    document.getElementById('lossPoints').value = settingsData.lossPoints || -1;
    document.getElementById('cleanSheetPoints').value = settingsData.cleanSheetPoints || 3;
    document.getElementById('goalPoints').value = settingsData.goalPoints || 1;
    document.getElementById('captainWinPoints').value = settingsData.captainWinPoints || 5;
    document.getElementById('captainDrawPoints').value = settingsData.captainDrawPoints || 2.5;
    document.getElementById('captainLossPoints').value = settingsData.captainLossPoints || -2;
}

function saveSettings() {
    const updates = {
        winPoints: parseFloat(document.getElementById('winPoints').value),
        drawPoints: parseFloat(document.getElementById('drawPoints').value),
        lossPoints: parseFloat(document.getElementById('lossPoints').value),
        cleanSheetPoints: parseFloat(document.getElementById('cleanSheetPoints').value),
        goalPoints: parseFloat(document.getElementById('goalPoints').value),
        captainWinPoints: parseFloat(document.getElementById('captainWinPoints').value),
        captainDrawPoints: parseFloat(document.getElementById('captainDrawPoints').value),
        captainLossPoints: parseFloat(document.getElementById('captainLossPoints').value)
    };
    
    database.ref('settings').update(updates).then(() => {
        alert('Settings saved successfully!');
    }).catch((error) => {
        alert('Error saving settings: ' + error.message);
    });
}


function refreshCurrentView() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabName = activeTab.id.replace('Tab', '');
        if (tabName === 'standings') {
            loadStandings();
        } else if (tabName === 'gameHistory') {
            loadAllGamesHistory();
        } else if (tabName === 'inputStats') {
            loadInputStatsForm();
        } else if (tabName === 'playerProfiles') {
            loadPlayerProfiles();
        }
    }
}

function playVideo(videoUrl, playerName, videoNumber) {
    const videoModal = document.getElementById('videoModal');
    const videoModalTitle = document.getElementById('videoModalTitle');
    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = document.getElementById('videoSource');
    
    const title = videoNumber ? `${playerName} - Video ${videoNumber}` : `${playerName} - Highlight Video`;
    videoModalTitle.textContent = title;
    
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let videoId;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            videoId = videoUrl.split('v=')[1]?.split('&')[0];
        } else if (videoUrl.includes('youtu.be/')) {
            videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        }
        
        if (videoId) {
            videoPlayer.style.display = 'none';
            videoPlayer.nextElementSibling.innerHTML = `<iframe width="100%" height="480" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }
    } else if (videoUrl.includes('drive.google.com')) {
        const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
        const match = videoUrl.match(driveRegex);
        
        if (match && match[1]) {
            const embedUrl = `https://drive.google.com/file/d/${match[1]}/preview?autoplay=1`;
            videoPlayer.style.display = 'none';
            videoPlayer.nextElementSibling.innerHTML = `<iframe width="100%" height="480" src="${embedUrl}" frameborder="0" allow="autoplay" allowfullscreen></iframe>`;
        } else {
            videoPlayer.style.display = 'block';
            videoPlayer.nextElementSibling.innerHTML = '';
            videoSource.src = videoUrl;
            videoPlayer.load();
            videoPlayer.play().catch(error => {
                console.log('Autoplay prevented:', error);
            });
        }
    } else {
        videoPlayer.style.display = 'block';
        videoPlayer.nextElementSibling.innerHTML = '';
        videoSource.src = videoUrl;
        videoPlayer.load();
        videoPlayer.play().catch(error => {
            console.log('Autoplay prevented:', error);
        });
    }
    
    videoModal.style.display = 'flex';
}

function closeVideoModal() {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoModal = document.getElementById('videoModal');
    
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    videoPlayer.nextElementSibling.innerHTML = '';
    videoPlayer.style.display = 'block';
    videoModal.style.display = 'none';
}
