class FootballDatabase {
    constructor() {
        this.players = [];
        this.games = [];
        this.pointValues = {
            win: 3,
            draw: 1,
            loss: 0,
            cleanSheet: 1,
            goal: 1,
            captainWin: 2,
            captainLoss: -1
        };
        this.currentYear = new Date().getFullYear();
        this.selectedYear = this.currentYear;
        this.previousYearTitles = {};
        this.userPermission = null;
        this.isEditor = false;
        this.accessPasswords = {
            admin: 'F49%rpt#QyT5Rn',
            editor: '74%tg41M'
        };
        this.selectedRole = null;
        this.dataLoaded = false;
        this.init();
    }

    async init() {
        await this.loadAllData();
        this.setupEventListeners();
        this.setupRealtimeListeners();
        this.loadSettings();
        this.setTodaysDate();
        this.populateYearFilters();
        this.updateStandings();
        this.updatePlayerSelects();
        
        if (this.userPermission) {
            this.applyPermissions();
            document.getElementById('permission-modal').classList.remove('active');
        } else {
            this.checkFirstTimeSetup();
        }
        
        this.dataLoaded = true;
    }

    async loadAllData() {
        try {
            this.players = await this.loadData('players') || [];
            this.games = await this.loadData('games') || [];
            
            const loadedPointValues = await this.loadData('pointValues');
            if (loadedPointValues) {
                this.pointValues = loadedPointValues;
            }
            
            this.previousYearTitles = await this.loadData('previousYearTitles') || {};
            this.userPermission = await this.loadData('userPermission') || null;
            this.isEditor = this.userPermission === 'editor' || this.userPermission === 'admin';
            
            const loadedPasswords = await this.loadData('accessPasswords');
            if (loadedPasswords) {
                this.accessPasswords = loadedPasswords;
            } else {
                await this.saveData('accessPasswords', this.accessPasswords);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    setupRealtimeListeners() {
        if (!window.firebaseDb) return;

        const { doc, onSnapshot } = window.firebaseModules;

        onSnapshot(doc(window.firebaseDb, 'footballStats', 'players'), (docSnap) => {
            if (docSnap.exists() && this.dataLoaded) {
                this.players = docSnap.data().value;
                this.updateStandings();
                this.updatePlayerSelects();
                this.renderPlayerProfiles();
            }
        });

        onSnapshot(doc(window.firebaseDb, 'footballStats', 'games'), (docSnap) => {
            if (docSnap.exists() && this.dataLoaded) {
                this.games = docSnap.data().value;
                this.recalculateAllStats();
                this.updateStandings();
                this.renderGameHistory();
            }
        });

        onSnapshot(doc(window.firebaseDb, 'footballStats', 'pointValues'), (docSnap) => {
            if (docSnap.exists() && this.dataLoaded) {
                this.pointValues = docSnap.data().value;
                this.loadSettings();
                this.updateStandings();
            }
        });
    }
    
    checkFirstTimeSetup() {
        if (!this.accessPasswords.admin) {
            alert('Welcome! As a first-time admin, you need to set up access passwords. Click Admin button to continue.');
        }
    }

    setTodaysDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('game-date').value = today;
    }

    async loadData(key) {
        if (!window.firebaseDb) {
            console.warn('Firebase not initialized yet, using localStorage fallback');
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }

        try {
            const { doc, getDoc } = window.firebaseModules;
            const docRef = doc(window.firebaseDb, 'footballStats', key);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data().value;
            }
            return null;
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return null;
        }
    }

    async saveData(key, data) {
        if (!window.firebaseDb) {
            console.warn('Firebase not initialized yet, using localStorage fallback');
            localStorage.setItem(key, JSON.stringify(data));
            return;
        }

        try {
            const { doc, setDoc } = window.firebaseModules;
            const docRef = doc(window.firebaseDb, 'footballStats', key);
            await setDoc(docRef, { value: data });
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.section).classList.add('active');
                
                if (e.target.dataset.section === 'input' && this.userPermission === 'viewer') {
                    this.setupViewerInputSection();
                }
            });
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.closest('.section');
                parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                parent.querySelector(`#${e.target.dataset.tab}`).classList.add('active');
                
                if (e.target.dataset.tab === 'game-history') {
                    document.getElementById('input-year-filter-container').style.display = 'flex';
                    this.renderGameHistory();
                } else {
                    document.getElementById('input-year-filter-container').style.display = 'none';
                }
            });
        });

        document.getElementById('add-player-btn').addEventListener('click', () => {
            document.getElementById('add-player-form').classList.add('active');
        });

        document.getElementById('close-add-player').addEventListener('click', () => {
            document.getElementById('add-player-form').classList.remove('active');
            document.getElementById('player-form').reset();
            delete document.getElementById('player-form').dataset.editingId;
            document.querySelector('#add-player-form h3').textContent = 'Add New Player';
            document.querySelector('#player-form button[type="submit"]').textContent = 'Add Player';
        });

        document.getElementById('player-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPlayer();
        });

        document.getElementById('submit-all-stats').addEventListener('click', () => {
            this.submitAllStats();
        });

        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('player-profile-modal').addEventListener('click', (e) => {
            if (e.target.id === 'player-profile-modal') {
                this.closeProfileModal();
            }
        });

        const closeVideoBtn = document.getElementById('close-video-player');
        if (closeVideoBtn) {
            closeVideoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeVideoModal();
            });
        }

        document.getElementById('video-player-modal').addEventListener('click', (e) => {
            if (e.target.id === 'video-player-modal') {
                this.closeVideoModal();
            }
        });

        document.getElementById('add-player-form').addEventListener('click', (e) => {
            if (e.target.id === 'add-player-form') {
                document.getElementById('add-player-form').classList.remove('active');
                document.getElementById('player-form').reset();
                delete document.getElementById('player-form').dataset.editingId;
                document.querySelector('#add-player-form h3').textContent = 'Add New Player';
                document.querySelector('#player-form button[type="submit"]').textContent = 'Add Player';
            }
        });

        document.getElementById('year-filter').addEventListener('change', (e) => {
            this.selectedYear = parseInt(e.target.value);
            this.updateStandings();
        });

        document.getElementById('year-filter-profiles').addEventListener('change', (e) => {
            this.selectedYear = parseInt(e.target.value);
            this.updatePlayerSelects();
        });

        document.getElementById('year-filter-input').addEventListener('change', (e) => {
            this.selectedYear = parseInt(e.target.value);
            this.renderGameHistory();
        });

        document.getElementById('role-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyPassword();
            }
        });
    }

    addPlayer() {
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const position = document.getElementById('position').value;
        const height = document.getElementById('height').value;
        const weight = document.getElementById('weight').value;
        const birthday = document.getElementById('birthday').value;
        const hobbies = document.getElementById('hobbies').value;
        const headshotInput = document.getElementById('headshot');
        const editingId = document.getElementById('player-form').dataset.editingId;
        
        if (editingId) {
            const player = this.players.find(p => p.id === editingId);
            if (player) {
                player.firstName = firstName;
                player.lastName = lastName;
                player.position = position;
                player.height = height;
                player.weight = weight;
                player.birthday = birthday;
                player.hobbies = hobbies;

                if (headshotInput.files && headshotInput.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        player.headshot = e.target.result;
                        this.saveData('players', this.players);
                        this.updateStandings();
                        this.updatePlayerSelects();
                        document.getElementById('add-player-form').classList.remove('active');
                        document.getElementById('player-form').reset();
                        delete document.getElementById('player-form').dataset.editingId;
                        this.displayPlayerProfile(editingId);
                    };
                    reader.readAsDataURL(headshotInput.files[0]);
                } else {
                    this.saveData('players', this.players);
                    this.updateStandings();
                    this.updatePlayerSelects();
                    document.getElementById('add-player-form').classList.remove('active');
                    document.getElementById('player-form').reset();
                    delete document.getElementById('player-form').dataset.editingId;
                    this.displayPlayerProfile(editingId);
                }
            }
        } else {
            const playerId = Date.now().toString();
            
            const player = {
                id: playerId,
                firstName,
                lastName,
                position,
                height,
                weight,
                birthday,
                hobbies,
                headshot: null,
                highlights: [],
                stats: {
                    gamesPlayed: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    cleanSheets: 0,
                    goalsScored: 0,
                    captainWins: 0,
                    captainLosses: 0
                }
            };

            if (headshotInput.files && headshotInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    player.headshot = e.target.result;
                    this.players.push(player);
                    this.saveData('players', this.players);
                    this.updateStandings();
                    this.updatePlayerSelects();
                    document.getElementById('add-player-form').classList.remove('active');
                    document.getElementById('player-form').reset();
                };
                reader.readAsDataURL(headshotInput.files[0]);
            } else {
                this.players.push(player);
                this.saveData('players', this.players);
                this.updateStandings();
                this.updatePlayerSelects();
                document.getElementById('add-player-form').classList.remove('active');
                document.getElementById('player-form').reset();
            }
        }
    }

    editPlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        document.getElementById('first-name').value = player.firstName;
        document.getElementById('last-name').value = player.lastName;
        document.getElementById('position').value = player.position || '';
        document.getElementById('height').value = player.height || '';
        document.getElementById('weight').value = player.weight || '';
        document.getElementById('birthday').value = player.birthday || '';
        document.getElementById('hobbies').value = player.hobbies || '';
        
        document.getElementById('player-form').dataset.editingId = playerId;
        document.querySelector('#add-player-form h3').textContent = 'Edit Player';
        document.querySelector('#player-form button[type="submit"]').textContent = 'Update Player';
        this.closeProfileModal();
        document.getElementById('add-player-form').classList.add('active');
    }

    deletePlayer(playerId) {
        if (!confirm('Are you sure you want to delete this player? This will also delete all their game stats.')) {
            return;
        }

        this.games.forEach(game => {
            game.playerStats = game.playerStats.filter(stat => stat.playerId !== playerId);
        });
        this.games = this.games.filter(game => game.playerStats.length > 0);

        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);
        }

        this.saveData('players', this.players);
        this.saveData('games', this.games);
        this.updateStandings();
        this.updatePlayerSelects();
        this.closeProfileModal();
        
        alert('Player deleted successfully!');
    }

    renderBulkStatsForm() {
        const container = document.getElementById('bulk-stats-form');
        
        if (this.players.length === 0) {
            container.innerHTML = '<p class="empty-state">No players added yet. Add players in the Player Profiles section.</p>';
            return;
        }

        container.innerHTML = this.players.map(player => `
            <div class="player-stat-card">
                <h3>${player.firstName} ${player.lastName}</h3>
                <div class="stat-inputs">
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-win" data-player="${player.id}">
                            Win
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-draw" data-player="${player.id}">
                            Draw
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-loss" data-player="${player.id}">
                            Loss
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-clean-sheet" data-player="${player.id}">
                            Clean Sheet
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            Goals:
                            <input type="number" class="stat-goals" data-player="${player.id}" min="0" value="0">
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-captain-win" data-player="${player.id}">
                            Captain Win
                        </label>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" class="stat-captain-loss" data-player="${player.id}">
                            Captain Loss
                        </label>
                    </div>
                </div>
            </div>
        `).join('');

        this.players.forEach(player => {
            const winCheckbox = container.querySelector(`.stat-win[data-player="${player.id}"]`);
            const drawCheckbox = container.querySelector(`.stat-draw[data-player="${player.id}"]`);
            const lossCheckbox = container.querySelector(`.stat-loss[data-player="${player.id}"]`);

            [winCheckbox, drawCheckbox, lossCheckbox].forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        [winCheckbox, drawCheckbox, lossCheckbox].forEach(cb => {
                            if (cb !== e.target) cb.checked = false;
                        });
                    }
                });
            });
        });
    }

    submitAllStats() {
        const gameDateInput = document.getElementById('game-date');
        if (!gameDateInput.value) {
            alert('Please select a game date.');
            return;
        }

        const gameDate = new Date(gameDateInput.value + 'T12:00:00');
        const gameYear = gameDate.getFullYear();

        const container = document.getElementById('bulk-stats-form');
        const gameData = {
            id: Date.now().toString(),
            date: gameDate.toISOString(),
            year: gameYear,
            playerStats: []
        };

        this.players.forEach(player => {
            const win = container.querySelector(`.stat-win[data-player="${player.id}"]`).checked;
            const draw = container.querySelector(`.stat-draw[data-player="${player.id}"]`).checked;
            const loss = container.querySelector(`.stat-loss[data-player="${player.id}"]`).checked;
            const cleanSheet = container.querySelector(`.stat-clean-sheet[data-player="${player.id}"]`).checked;
            const goals = parseInt(container.querySelector(`.stat-goals[data-player="${player.id}"]`).value) || 0;
            const captainWin = container.querySelector(`.stat-captain-win[data-player="${player.id}"]`).checked;
            const captainLoss = container.querySelector(`.stat-captain-loss[data-player="${player.id}"]`).checked;

            if (win || draw || loss || cleanSheet || goals > 0 || captainWin || captainLoss) {
                gameData.playerStats.push({
                    playerId: player.id,
                    win,
                    draw,
                    loss,
                    cleanSheet,
                    goals,
                    captainWin,
                    captainLoss
                });
            }
        });

        if (gameData.playerStats.length === 0) {
            alert('No stats were entered. Please enter at least one stat for any player.');
            return;
        }

        this.games.push(gameData);
        this.saveData('games', this.games);
        this.populateYearFilters();
        this.recalculateAllStats();
        this.updateStandings();
        this.renderBulkStatsForm();
        this.setTodaysDate();
        
        alert(`Stats submitted successfully for ${gameData.playerStats.length} player(s)!`);
    }

    getGamesByYear(year) {
        return this.games.filter(game => game.year === year);
    }

    getAvailableYears() {
        const years = new Set(this.games.map(game => game.year || this.currentYear));
        years.add(this.currentYear);
        return Array.from(years).sort((a, b) => b - a);
    }

    populateYearFilters() {
        const years = this.getAvailableYears();
        const standingsFilter = document.getElementById('year-filter');
        const profilesFilter = document.getElementById('year-filter-profiles');
        const inputFilter = document.getElementById('year-filter-input');

        [standingsFilter, profilesFilter, inputFilter].forEach(filter => {
            filter.innerHTML = years.map(year => 
                `<option value="${year}" ${year === this.selectedYear ? 'selected' : ''}>${year}</option>`
            ).join('');
        });
    }

    recalculateAllStats() {
        this.players.forEach(player => {
            player.stats = {
                gamesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                cleanSheets: 0,
                goalsScored: 0,
                captainWins: 0,
                captainLosses: 0
            };
        });

        const yearGames = this.getGamesByYear(this.selectedYear);
        yearGames.forEach(game => {
            game.playerStats.forEach(stat => {
                const player = this.players.find(p => p.id === stat.playerId);
                if (player) {
                    player.stats.gamesPlayed++;
                    if (stat.win) player.stats.wins++;
                    if (stat.draw) player.stats.draws++;
                    if (stat.loss) player.stats.losses++;
                    if (stat.cleanSheet) player.stats.cleanSheets++;
                    if (stat.captainWin) player.stats.captainWins++;
                    if (stat.captainLoss) player.stats.captainLosses++;
                    player.stats.goalsScored += stat.goals;
                }
            });
        });

        this.saveData('players', this.players);
    }

    calculateStats(player) {
        const stats = player.stats;
        const wlRatio = stats.wins - stats.losses;
        const winPercent = stats.gamesPlayed > 0 ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) : 0;
        
        const points = 
            (stats.wins * this.pointValues.win) +
            (stats.draws * this.pointValues.draw) +
            (stats.losses * this.pointValues.loss) +
            (stats.cleanSheets * this.pointValues.cleanSheet) +
            (stats.goalsScored * this.pointValues.goal) +
            (stats.captainWins * this.pointValues.captainWin) +
            (stats.captainLosses * this.pointValues.captainLoss);

        return {
            wlRatio,
            winPercent,
            points: parseFloat(points.toFixed(2))
        };
    }

    updateStandings() {
        this.recalculateAllStats();
        const tbody = document.getElementById('standings-body');
        tbody.innerHTML = '';

        const sortedPlayers = [...this.players].sort((a, b) => {
            const aCalc = this.calculateStats(a);
            const bCalc = this.calculateStats(b);
            return bCalc.points - aCalc.points;
        });

        sortedPlayers.forEach((player, index) => {
            const calc = this.calculateStats(player);
            const row = document.createElement('tr');
            row.classList.add('player-row');
            row.dataset.playerId = player.id;
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${player.firstName} ${player.lastName}</td>
                <td>${player.stats.gamesPlayed}</td>
                <td>${player.stats.wins}</td>
                <td>${player.stats.draws}</td>
                <td>${player.stats.losses}</td>
                <td>${player.stats.cleanSheets}</td>
                <td>${player.stats.goalsScored}</td>
                <td>${player.stats.captainWins}</td>
                <td>${player.stats.captainLosses}</td>
                <td>${calc.wlRatio}</td>
                <td>${calc.winPercent}%</td>
                <td>${calc.points}</td>
            `;
            row.addEventListener('click', () => {
                document.querySelector('.nav-btn[data-section="profiles"]').click();
                document.getElementById('profile-player-select').value = player.id;
                this.displayPlayerProfile(player.id);
            });
            tbody.appendChild(row);
        });

        if (this.players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="empty-state">No players added yet</td></tr>';
        }
    }

    updatePlayerSelects() {
        this.renderBulkStatsForm();
        this.renderPlayersList();
    }

    renderPlayersList() {
        const container = document.getElementById('players-list');
        
        if (this.players.length === 0) {
            container.innerHTML = '<p class="empty-state">No players added yet. Click "Add New Player" to get started.</p>';
            return;
        }

        this.recalculateAllStats();
        const sortedPlayers = [...this.players].sort((a, b) => {
            const aCalc = this.calculateStats(a);
            const bCalc = this.calculateStats(b);
            return bCalc.points - aCalc.points;
        });

        container.innerHTML = sortedPlayers.map((player, index) => {
            const calc = this.calculateStats(player);
            const rank = index + 1;
            const titles = this.getTitlesForPlayer(player.id);
            const titlesText = Object.keys(titles).length > 0 
                ? Object.values(titles).slice(0, 1).join(', ')
                : 'None';
            const hobbiesText = player.hobbies 
                ? (player.hobbies.length > 40 ? player.hobbies.substring(0, 40) + '...' : player.hobbies)
                : 'N/A';
            
            return `
                <div class="player-card" onclick="database.displayPlayerProfile('${player.id}')">
                    ${player.headshot ? 
                        `<img src="${player.headshot}" alt="${player.firstName} ${player.lastName}" class="player-card-image">` :
                        `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle fill='%23ddd' cx='30' cy='30' r='30'/%3E%3Ctext fill='%23999' font-size='12' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E" alt="No image" class="player-card-image">`
                    }
                    <div class="player-card-info">
                        <h3>${player.firstName} ${player.lastName}</h3>
                        <p><strong>Rank:</strong> ${rank} | <strong>Points:</strong> ${calc.points} | <strong>Pos:</strong> ${player.position || 'N/A'}</p>
                        <p><strong>Titles:</strong> ${titlesText} | <strong>Hobbies:</strong> ${hobbiesText}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    calculateAge(birthday) {
        if (!birthday) return 'N/A';
        const today = new Date();
        const birthDate = new Date(birthday);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    getTitlesForPlayer(playerId) {
        const titles = this.previousYearTitles[playerId] || {};
        return titles;
    }

    getPlayerRank(playerId) {
        const sortedPlayers = [...this.players].sort((a, b) => {
            const aCalc = this.calculateStats(a);
            const bCalc = this.calculateStats(b);
            return bCalc.points - aCalc.points;
        });
        
        const index = sortedPlayers.findIndex(p => p.id === playerId);
        return index + 1;
    }

    displayPlayerProfile(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        const calc = this.calculateStats(player);
        const age = this.calculateAge(player.birthday);
        const titles = this.getTitlesForPlayer(playerId);
        const rank = this.getPlayerRank(playerId);

        const profileView = document.getElementById('profile-modal-body');
        const modal = document.getElementById('player-profile-modal');
        
        const editDeleteButtons = this.isEditor ? `
            <div class="profile-actions-top">
                <button class="btn-edit" onclick="database.editPlayer('${playerId}')">Edit Player</button>
                <button class="btn-delete" onclick="database.deletePlayer('${playerId}')">Delete Player</button>
            </div>
        ` : '';
        
        profileView.innerHTML = `
            ${editDeleteButtons}
            
            <div class="profile-main-grid">
                <div class="profile-left">
                    <div class="profile-image">
                        ${player.headshot ? 
                            `<img src="${player.headshot}" alt="${player.firstName} ${player.lastName}">` :
                            `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext fill='%23999' font-size='16' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E" alt="No image">`
                        }
                    </div>
                    <div class="profile-info">
                        <h3>${player.firstName} ${player.lastName}</h3>
                        <p><strong>Position:</strong> ${player.position || 'N/A'}</p>
                        <p><strong>Height:</strong> ${player.height || 'N/A'}</p>
                        <p><strong>Weight:</strong> ${player.weight ? player.weight + ' lbs' : 'N/A'}</p>
                        <p><strong>Birthday:</strong> ${player.birthday || 'N/A'}</p>
                        <p><strong>Age:</strong> ${age}</p>
                        <p><strong>Hobbies:</strong> ${player.hobbies || 'N/A'}</p>
                    </div>
                </div>

                <div class="profile-right">
                    <h4>Season Statistics</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Rank</span>
                            <span class="stat-value">${rank}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Games</span>
                            <span class="stat-value">${player.stats.gamesPlayed}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wins</span>
                            <span class="stat-value">${player.stats.wins}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Draws</span>
                            <span class="stat-value">${player.stats.draws}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Losses</span>
                            <span class="stat-value">${player.stats.losses}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Clean Sheets</span>
                            <span class="stat-value">${player.stats.cleanSheets}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Goals</span>
                            <span class="stat-value">${player.stats.goalsScored}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Captain Wins</span>
                            <span class="stat-value">${player.stats.captainWins}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Captain Losses</span>
                            <span class="stat-value">${player.stats.captainLosses}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">W:L Ratio</span>
                            <span class="stat-value">${calc.wlRatio}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Win %</span>
                            <span class="stat-value">${calc.winPercent}%</span>
                        </div>
                        <div class="stat-item highlight">
                            <span class="stat-label">Points</span>
                            <span class="stat-value">${calc.points}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-section">
                <h4>Titles Held</h4>
                <div class="titles-grid">
                    ${Object.keys(titles).length > 0 ? Object.entries(titles).map(([key, value]) => `
                        <div class="title-card">
                            <h5>${key}</h5>
                            <p>${value}</p>
                        </div>
                    `).join('') : '<p class="empty-state">No titles from previous season</p>'}
                </div>
            </div>

            <div class="profile-section">
                <h4>Video Highlights</h4>
                ${this.isEditor ? `
                    <div class="video-upload-section">
                        <input type="text" id="video-url-${playerId}" placeholder="Paste YouTube, Drive, Dropbox, or direct video link" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                        <input type="text" id="video-title-${playerId}" placeholder="Video title (optional)" style="flex: 0.5; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-left: 10px;">
                        <button class="btn-secondary" onclick="database.addVideoLink('${playerId}')" style="margin-left: 10px;">➕ Add Video</button>
                    </div>
                ` : ''}
                <div class="highlights-grid" id="highlights-grid-${playerId}">
                    ${player.highlights && player.highlights.length > 0 ? player.highlights.map((video, index) => {
                        const videoTitle = typeof video === 'string' ? `Video ${index + 1}` : (video.title || `Video ${index + 1}`);
                        return `
                        <div class="highlight-item">
                            <div class="highlight-thumbnail" onclick="database.playVideo('${playerId}', ${index})">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                                <span>${videoTitle}</span>
                            </div>
                            ${this.isEditor ? `
                                <button class="btn-delete-small" onclick="database.deleteHighlight('${playerId}', ${index})">Delete</button>
                            ` : ''}
                        </div>
                    `}).join('') : '<p class="empty-state">No video highlights added yet</p>'}
                </div>
            </div>
        `;
        
        modal.classList.add('active');
    }

    closeProfileModal() {
        const modal = document.getElementById('player-profile-modal');
        modal.classList.remove('active');
    }

    async addVideoLink(playerId) {
        const urlInput = document.getElementById(`video-url-${playerId}`);
        const titleInput = document.getElementById(`video-title-${playerId}`);
        
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please paste a video link.');
            return;
        }

        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        // Get title from input or generate default
        let title = titleInput.value.trim();
        if (!title) {
            title = `Video ${(player.highlights?.length || 0) + 1}`;
        }

        // Detect video type and format URL
        const videoData = this.formatVideoUrl(url, title);

        // Add to player highlights
        if (!player.highlights) {
            player.highlights = [];
        }

        player.highlights.push(videoData);
        await this.saveData('players', this.players);
        this.displayPlayerProfile(playerId);

        // Clear inputs
        urlInput.value = '';
        titleInput.value = '';
    }

    formatVideoUrl(url, title) {
        // YouTube detection and conversion
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        
        if (youtubeMatch) {
            return {
                title: title,
                url: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
                originalUrl: url,
                type: 'youtube'
            };
        }

        // Google Drive detection
        if (url.includes('drive.google.com')) {
            const fileIdMatch = url.match(/[-\w]{25,}/);
            if (fileIdMatch) {
                return {
                    title: title,
                    url: `https://drive.google.com/file/d/${fileIdMatch[0]}/preview`,
                    originalUrl: url,
                    type: 'drive'
                };
            }
        }

        // Dropbox detection
        if (url.includes('dropbox.com')) {
            const modifiedUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
            return {
                title: title,
                url: modifiedUrl,
                originalUrl: url,
                type: 'dropbox'
            };
        }

        // Default: treat as direct video URL
        return {
            title: title,
            url: url,
            originalUrl: url,
            type: 'direct'
        };
    }

    playVideo(playerId, videoIndex) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.highlights || !player.highlights[videoIndex]) return;

        const modal = document.getElementById('video-player-modal');
        const videoContainer = document.getElementById('video-player-container');
        
        const highlight = player.highlights[videoIndex];
        
        // Handle both old format (string) and new format (object with url)
        const videoUrl = typeof highlight === 'string' ? highlight : highlight.url;
        const videoType = typeof highlight === 'object' ? highlight.type : 'direct';

        // Clear previous content
        videoContainer.innerHTML = '';

        // YouTube or embedded videos
        if (videoType === 'youtube' || videoType === 'drive') {
            const iframe = document.createElement('iframe');
            iframe.src = videoUrl;
            iframe.width = '100%';
            iframe.height = '400';
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            videoContainer.appendChild(iframe);
        } else {
            // Direct video or Dropbox
            const video = document.createElement('video');
            video.id = 'video-player';
            video.src = videoUrl;
            video.controls = true;
            video.autoplay = true;
            videoContainer.appendChild(video);
        }

        modal.classList.add('active');
    }

    closeVideoModal() {
        const modal = document.getElementById('video-player-modal');
        const videoContainer = document.getElementById('video-player-container');
        
        // Stop any playing video/iframe
        videoContainer.innerHTML = '';
        modal.classList.remove('active');
    }

    async deleteHighlight(playerId, videoIndex) {
        if (!confirm('Are you sure you want to delete this video highlight?')) return;

        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.highlights) return;

        // Remove from player's highlights array
        player.highlights.splice(videoIndex, 1);
        await this.saveData('players', this.players);
        this.displayPlayerProfile(playerId);
    }

    loadSettings() {
        document.getElementById('points-win').value = this.pointValues.win;
        document.getElementById('points-draw').value = this.pointValues.draw;
        document.getElementById('points-loss').value = this.pointValues.loss;
        document.getElementById('points-clean-sheet').value = this.pointValues.cleanSheet;
        document.getElementById('points-goal').value = this.pointValues.goal;
        document.getElementById('points-captain-win').value = this.pointValues.captainWin;
        document.getElementById('points-captain-loss').value = this.pointValues.captainLoss;
    }

    saveSettings() {
        this.pointValues = {
            win: parseFloat(document.getElementById('points-win').value),
            draw: parseFloat(document.getElementById('points-draw').value),
            loss: parseFloat(document.getElementById('points-loss').value),
            cleanSheet: parseFloat(document.getElementById('points-clean-sheet').value),
            goal: parseFloat(document.getElementById('points-goal').value),
            captainWin: parseFloat(document.getElementById('points-captain-win').value),
            captainLoss: parseFloat(document.getElementById('points-captain-loss').value)
        };
        this.saveData('pointValues', this.pointValues);
        this.updateStandings();
        alert('Settings saved successfully!');
    }

    renderGameHistory() {
        const container = document.getElementById('games-list');
        
        const yearGames = this.getGamesByYear(this.selectedYear);
        
        if (yearGames.length === 0) {
            container.innerHTML = `<p class="empty-state">No games recorded for ${this.selectedYear}.</p>`;
            return;
        }

        const sortedGames = [...yearGames].sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = sortedGames.map(game => {
            const gameDate = new Date(game.date);
            const dateString = gameDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            return `
                <div class="game-card">
                    <h4>Game - ${dateString}</h4>
                    <div class="game-players">
                        ${game.playerStats.map(stat => {
                            const player = this.players.find(p => p.id === stat.playerId);
                            if (!player) return '';
                            
                            const stats = [];
                            if (stat.win) stats.push('Win');
                            if (stat.draw) stats.push('Draw');
                            if (stat.loss) stats.push('Loss');
                            if (stat.cleanSheet) stats.push('Clean Sheet');
                            if (stat.goals > 0) stats.push(`${stat.goals} Goal(s)`);
                            if (stat.captainWin) stats.push('Captain Win');
                            if (stat.captainLoss) stats.push('Captain Loss');
                            
                            return `
                                <div class="game-player-item">
                                    <h5>${player.firstName} ${player.lastName}</h5>
                                    <p>${stats.join(', ')}</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${this.isEditor ? `
                        <div class="game-actions">
                            <button class="btn-edit" onclick="database.editGame('${game.id}')">Edit</button>
                            <button class="btn-delete" onclick="database.deleteGame('${game.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    editGame(gameId) {
        const game = this.games.find(g => g.id === gameId);
        if (!game) return;

        this.currentYear = game.year || this.currentYear;

        document.querySelector('.nav-btn[data-section="input"]').click();
        document.querySelector('.tab-btn[data-tab="input-stats"]').click();

        setTimeout(() => {
            const gameDate = new Date(game.date);
            const dateString = gameDate.toISOString().split('T')[0];
            document.getElementById('game-date').value = dateString;

            const container = document.getElementById('bulk-stats-form');
            
            game.playerStats.forEach(stat => {
                const winCheckbox = container.querySelector(`.stat-win[data-player="${stat.playerId}"]`);
                const drawCheckbox = container.querySelector(`.stat-draw[data-player="${stat.playerId}"]`);
                const lossCheckbox = container.querySelector(`.stat-loss[data-player="${stat.playerId}"]`);
                const cleanSheetCheckbox = container.querySelector(`.stat-clean-sheet[data-player="${stat.playerId}"]`);
                const goalsInput = container.querySelector(`.stat-goals[data-player="${stat.playerId}"]`);
                const captainWinCheckbox = container.querySelector(`.stat-captain-win[data-player="${stat.playerId}"]`);
                const captainLossCheckbox = container.querySelector(`.stat-captain-loss[data-player="${stat.playerId}"]`);

                if (winCheckbox) winCheckbox.checked = stat.win;
                if (drawCheckbox) drawCheckbox.checked = stat.draw;
                if (lossCheckbox) lossCheckbox.checked = stat.loss;
                if (cleanSheetCheckbox) cleanSheetCheckbox.checked = stat.cleanSheet;
                if (goalsInput) goalsInput.value = stat.goals;
                if (captainWinCheckbox) captainWinCheckbox.checked = stat.captainWin;
                if (captainLossCheckbox) captainLossCheckbox.checked = stat.captainLoss;
            });

            this.deleteGame(gameId, true);
            alert('Game loaded for editing. Make your changes and submit.');
        }, 100);
    }

    deleteGame(gameId, silent = false) {
        const index = this.games.findIndex(g => g.id === gameId);
        if (index === -1) return;

        if (!silent && !confirm('Are you sure you want to delete this game?')) return;

        this.games.splice(index, 1);
        this.saveData('games', this.games);
        this.populateYearFilters();
        this.recalculateAllStats();
        this.updateStandings();
        this.renderGameHistory();
        
        if (!silent) {
            alert('Game deleted successfully!');
        }
    }

    selectRole(role) {
        this.selectedRole = role;
        const passwordContainer = document.getElementById('password-input-container');
        const rolePasswordInput = document.getElementById('role-password');
        
        if (role === 'viewer') {
            this.setPermission('viewer');
            return;
        }
        
        passwordContainer.style.display = 'block';
        rolePasswordInput.value = '';
        rolePasswordInput.focus();
    }

    verifyPassword() {
        const passwordInput = document.getElementById('role-password');
        const enteredPassword = passwordInput.value;
        const role = this.selectedRole;
        
        if (!role) {
            alert('Please select a role first.');
            return;
        }
        
        if (enteredPassword === this.accessPasswords[role]) {
            this.setPermission(role);
        } else {
            alert('Incorrect password. Please try again.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    cancelPasswordInput() {
        document.getElementById('password-input-container').style.display = 'none';
        document.getElementById('role-password').value = '';
        this.selectedRole = null;
    }

    setPermission(role) {
        this.userPermission = role;
        this.isEditor = role === 'editor' || role === 'admin';
        this.saveData('userPermission', role);
        this.applyPermissions();
        document.getElementById('permission-modal').classList.remove('active');
        this.cancelPasswordInput();
    }

    changePermission() {
        if (confirm('Are you sure you want to change your role?')) {
            this.userPermission = null;
            this.saveData('userPermission', null);
            this.cancelPasswordInput();
            document.getElementById('permission-modal').classList.add('active');
        }
    }

    openAdminSettings() {
        if (this.userPermission !== 'admin') {
            alert('Only admins can change passwords!');
            return;
        }
        
        const modal = document.getElementById('admin-settings-modal');
        const adminPass = document.getElementById('admin-password');
        const editorPass = document.getElementById('editor-password');
        
        adminPass.value = this.accessPasswords.admin || '';
        editorPass.value = this.accessPasswords.editor || '';
        
        modal.classList.add('active');
    }

    closeAdminSettings() {
        document.getElementById('admin-settings-modal').classList.remove('active');
    }

    saveAccessPasswords() {
        const adminPass = document.getElementById('admin-password').value.trim();
        const editorPass = document.getElementById('editor-password').value.trim();
        
        if (!adminPass) {
            alert('Admin password is required!');
            return;
        }
        
        if (!editorPass) {
            alert('Editor password is required!');
            return;
        }
        
        this.accessPasswords = {
            admin: adminPass,
            editor: editorPass
        };
        
        this.saveData('accessPasswords', this.accessPasswords);
        alert('Passwords updated successfully!');
        this.closeAdminSettings();
    }

    applyPermissions() {
        const isEditor = this.userPermission === 'editor' || this.userPermission === 'admin';
        const isAdmin = this.userPermission === 'admin';
        const isViewer = this.userPermission === 'viewer';
        const roleDisplay = document.getElementById('current-role');
        
        if (isAdmin) {
            roleDisplay.textContent = '🛡️ Admin';
            roleDisplay.style.color = '#e74c3c';
        } else if (isEditor) {
            roleDisplay.textContent = '🔓 Editor';
            roleDisplay.style.color = '#3498db';
        } else {
            roleDisplay.textContent = '👁️ Viewer';
            roleDisplay.style.color = '#95a5a6';
        }

        const inputBtn = document.getElementById('nav-input');
        const settingsBtn = document.getElementById('nav-settings');
        
        inputBtn.classList.remove('hidden');
        
        if (isViewer) {
            inputBtn.textContent = 'Game History';
            settingsBtn.classList.add('hidden');
            this.setupViewerInputSection();
        } else {
            inputBtn.textContent = 'Input Stats';
            settingsBtn.classList.remove('hidden');
            this.setupEditorInputSection();
        }

        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) {
            if (isEditor) {
                addPlayerBtn.classList.remove('hidden');
            } else {
                addPlayerBtn.classList.add('hidden');
            }
        }

        const adminSettingsBtn = document.getElementById('admin-settings-btn');
        if (adminSettingsBtn) {
            if (isAdmin) {
                adminSettingsBtn.classList.remove('hidden');
            } else {
                adminSettingsBtn.classList.add('hidden');
            }
        }

        this.isEditor = isEditor;
    }

    setupViewerInputSection() {
        const inputStatsTab = document.querySelector('[data-tab="input-stats"]');
        const gameHistoryTab = document.querySelector('[data-tab="game-history"]');
        const inputStatsContent = document.getElementById('input-stats');
        const gameHistoryContent = document.getElementById('game-history');
        
        if (inputStatsTab) inputStatsTab.classList.add('hidden');
        if (inputStatsContent) inputStatsContent.classList.add('hidden');
        
        if (gameHistoryTab) {
            gameHistoryTab.classList.remove('hidden');
            gameHistoryTab.classList.add('active');
        }
        
        if (gameHistoryContent) {
            gameHistoryContent.classList.add('active');
            document.getElementById('input-year-filter-container').style.display = 'flex';
            this.renderGameHistory();
        }
    }

    setupEditorInputSection() {
        const inputStatsTab = document.querySelector('[data-tab="input-stats"]');
        const gameHistoryTab = document.querySelector('[data-tab="game-history"]');
        const inputStatsContent = document.getElementById('input-stats');
        
        if (inputStatsTab) {
            inputStatsTab.classList.remove('hidden');
            inputStatsTab.classList.add('active');
        }
        
        if (gameHistoryTab) {
            gameHistoryTab.classList.remove('hidden');
            gameHistoryTab.classList.remove('active');
        }
        
        if (inputStatsContent) {
            inputStatsContent.classList.remove('hidden');
            inputStatsContent.classList.add('active');
        }
        
        const gameHistoryContent = document.getElementById('game-history');
        if (gameHistoryContent) {
            gameHistoryContent.classList.remove('active');
        }
        
        document.getElementById('input-year-filter-container').style.display = 'none';
    }
}

let database;

function initDatabase() {
    database = new FootballDatabase();
}

if (window.firebaseReady) {
    initDatabase();
} else {
    window.addEventListener('firebaseReady', initDatabase);
}

