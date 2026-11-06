export const DEFAULT_POINT_VALUES = {
    win: 3,
    draw: 1,
    loss: -1,
    cleanSheet: 3,
    goal: 1,
    captainWin: 5,
    captainDraw: 2.5,
    captainLoss: -2
};

export const STAT_AWARDS = [
    {
        id: 'mvp',
        title: 'MVP',
        blurb: 'Most Valuable Player',
        statKey: 'points',
        higher: true,
        requirePositive: false,
        format: (n) => `${formatNumber(n)} pts`
    },
    {
        id: 'mostGoals',
        title: 'Most Goals',
        blurb: '',
        statKey: 'goals',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} goal${n === 1 ? '' : 's'}`
    },
    {
        id: 'mostWins',
        title: 'Most Wins',
        blurb: '',
        statKey: 'wins',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} win${n === 1 ? '' : 's'}`
    },
    {
        id: 'bestCaptain',
        title: 'Best Captain',
        blurb: '',
        statKey: 'captainWins',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} captain win${n === 1 ? '' : 's'}`
    },
    {
        id: 'mostConsistent',
        title: 'Most Consistent',
        blurb: '',
        statKey: 'games',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} game${n === 1 ? '' : 's'} played`
    },
    {
        id: 'mostLosses',
        title: 'Most Losses',
        blurb: 'Not counting games lost as captain',
        statKey: 'squadLosses',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} loss${n === 1 ? '' : 'es'}`
    },
    {
        id: 'lvp',
        title: 'LVP',
        blurb: 'Least Valuable Player',
        statKey: 'points',
        higher: false,
        requirePositive: false,
        format: (n) => `${formatNumber(n)} pts`
    }
];

export const VOTE_AWARDS = [
    { id: 'bestKeeper', title: 'Best Keeper', blurb: 'Voted by the squad' },
    { id: 'bestCenterBack', title: 'Best Center Back', blurb: 'Voted by the squad' },
    { id: 'bestRightBack', title: 'Best Right Back', blurb: 'Voted by the squad' },
    { id: 'bestLeftBack', title: 'Best Left Back', blurb: 'Voted by the squad' },
    { id: 'bestAttackingMidfielder', title: 'Best Attacking Midfielder', blurb: 'Voted by the squad' },
    { id: 'bestDefensiveMidfielder', title: 'Best Defensive Midfielder', blurb: 'Voted by the squad' },
    { id: 'bestLeftWinger', title: 'Best Left Winger', blurb: 'Voted by the squad' },
    { id: 'bestRightWinger', title: 'Best Right Winger', blurb: 'Voted by the squad' },
    { id: 'bestStriker', title: 'Best Striker', blurb: 'Voted by the squad' },
    { id: 'mostImproved', title: 'Most Improved', blurb: 'Voted by the squad' }
];

export const VOTE_AWARD_IDS = VOTE_AWARDS.map((award) => award.id);
export const NOMINEE_COUNT = 4;


export function formatNumber(n) {
    const x = Math.round(Number(n) * 10) / 10;
    if (!Number.isFinite(x)) return '0';
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

export function normalizePoints(data) {
    const points = { ...DEFAULT_POINT_VALUES };
    if (!data) return points;
    Object.keys(points).forEach((key) => {
        const value = Number(data[key]);
        if (Number.isFinite(value)) points[key] = value;
    });
    return points;
}

export function calculateSeasonStats(playerId, games, pointValues) {
    const points = normalizePoints(pointValues);
    const stats = {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        cleanSheets: 0,
        goals: 0,
        ownGoals: 0,
        captainWins: 0,
        captainDraws: 0,
        captainLosses: 0,
        points: 0,
        squadLosses: 0
    };

    games.forEach((game) => {
        const playerStats = game.playerStats?.[playerId];
        if (!playerStats) return;

        stats.games += 1;
        stats.wins += playerStats.win || 0;
        stats.draws += playerStats.draw || 0;
        stats.losses += playerStats.loss || 0;
        stats.cleanSheets += playerStats.cleanSheet ? 1 : 0;
        stats.goals += playerStats.goals || 0;
        stats.ownGoals += playerStats.ownGoals || 0;
        stats.captainWins += playerStats.captainWin || 0;
        stats.captainDraws += playerStats.captainDraw || 0;
        stats.captainLosses += playerStats.captainLoss || 0;

        stats.points += (playerStats.win || 0) * points.win;
        stats.points += (playerStats.draw || 0) * points.draw;
        stats.points += (playerStats.loss || 0) * points.loss;
        stats.points += playerStats.cleanSheet ? points.cleanSheet : 0;
        stats.points += (playerStats.goals || 0) * points.goal;
        stats.points += (playerStats.captainWin || 0) * points.captainWin;
        stats.points += (playerStats.captainDraw || 0) * points.captainDraw;
        stats.points += (playerStats.captainLoss || 0) * points.captainLoss;
    });

    stats.points = parseFloat(stats.points.toFixed(1));
    stats.squadLosses = Math.max(0, stats.losses - stats.captainLosses);
    return stats;
}

export function pickStatWinners(players, award) {
    const pool = players.filter((player) => (player.games || 0) > 0);
    if (!pool.length) return [];

    const values = pool.map((player) => Number(player[award.statKey]) || 0);
    const target = award.higher ? Math.max(...values) : Math.min(...values);
    if (award.requirePositive && target <= 0) return [];

    return pool
        .filter((player) => (Number(player[award.statKey]) || 0) === target)
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

export function personName(person) {
    if (!person) return '';
    if (person.name) return String(person.name);
    return `${person.firstName || ''} ${person.lastName || ''}`.trim();
}

export function initials(person) {
    const parts = personName(person).split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '?';
    const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + second).toUpperCase();
}

export function convertToDirectLink(url) {
    if (!url) return '';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) return url;

    if (url.includes('drive.google.com')) {
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }

    return url;
}

export function photoHtml(person, extraClass = '') {
    const letters = esc(initials(person));
    const wrapClass = `hof-photo-wrap${extraClass ? ` ${extraClass}` : ''}`;
    const url = convertToDirectLink(person?.headshotLink || person?.headshot || '');
    if (!url) {
        return `<span class="${wrapClass}"><span class="hof-photo-fallback">${letters}</span></span>`;
    }
    return `<span class="${wrapClass}"><img class="hof-photo" src="${esc(url)}" alt="" decoding="async" onerror="var f=this.parentElement&amp;&amp;this.parentElement.querySelector('.hof-photo-fallback');if(f)f.style.display='flex';this.remove();"><span class="hof-photo-fallback" style="display:none">${letters}</span></span>`;
}

function safeId(uid) {
    return String(uid || 'hof').replace(/[^a-zA-Z0-9]/g, '') || 'hof';
}

function artSvg(inner) {
    return `<svg viewBox="0 0 80 104" class="hof-art" aria-hidden="true">${inner}</svg>`;
}

function gold(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6B4E12"/><stop offset="16%" stop-color="#FFF4C8"/><stop offset="34%" stop-color="#E2B34A"/><stop offset="50%" stop-color="#FFF1C4"/><stop offset="68%" stop-color="#B8882C"/><stop offset="100%" stop-color="#5C430C"/></linearGradient>`;
}

function silver(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5A656E"/><stop offset="18%" stop-color="#FFFFFF"/><stop offset="38%" stop-color="#C5CED6"/><stop offset="55%" stop-color="#F7FAFC"/><stop offset="76%" stop-color="#8D9AA6"/><stop offset="100%" stop-color="#3E4850"/></linearGradient>`;
}

function shadow() {
    return '<ellipse cx="40" cy="100" rx="20" ry="2.3" fill="#000" opacity="0.22"/>';
}

function plinth(metal = 'dark') {
    const top = metal === 'gold' ? '#E7C56A' : metal === 'silver' ? '#E4EAF0' : '#2A2A2A';
    const mid = metal === 'gold' ? '#8A6420' : metal === 'silver' ? '#8E9BA6' : '#111';
    return `<rect x="18" y="90" width="44" height="6" rx="1" fill="${mid}"/>
        <rect x="22" y="86" width="36" height="5" fill="${top}"/>
        <path d="M24 86h8l-1 5h-6z" fill="#fff" opacity="0.28"/>`;
}

function mvpTrophy() {
    return '<img class="hof-art hof-mvp-trophy" src="images/mvp-ballon-dor.png" alt="" decoding="async">';
}

function goalsBoot() {
    return '<img class="hof-art hof-goals-boot" src="images/most-goals-boot.png" alt="" decoding="async">';
}

function winsTrophy() {
    return '<img class="hof-art hof-wins-trophy" src="images/most-wins-world-cup.png" alt="" decoding="async">';
}

function captainTrophy() {
    return '<img class="hof-art hof-captain-trophy" src="images/best-captain-armband.png" alt="" decoding="async">';
}

function consistentTrophy() {
    return '<img class="hof-art hof-consistent-trophy" src="images/most-consistent-trophy.png" alt="" decoding="async">';
}

function lossesSpoon() {
    return '<img class="hof-art hof-losses-spoon" src="images/most-losses-spoon.png" alt="" decoding="async">';
}

function lvpBoot() {
    return '<img class="hof-art hof-lvp-boot" src="images/lvp-baby-boot.png" alt="" decoding="async">';
}

function keeperGlove() {
    return '<img class="hof-art hof-keeper-glove" src="images/best-keeper-glove.png" alt="" decoding="async">';
}

function worldCup(uid) {
    return artSvg(`<defs>${gold(uid)}
        <linearGradient id="${uid}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2F8A62"/><stop offset="100%" stop-color="#0C3A28"/></linearGradient>
        <radialGradient id="${uid}gl" cx="36%" cy="32%" r="72%"><stop offset="0%" stop-color="#FFF6D2"/><stop offset="55%" stop-color="#E2B44A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient></defs>
        ${shadow()}
        <path d="M14 96h52l-5-8H19z" fill="url(#${uid}m)"/>
        <path d="M18 88h44l-2-6H20z" fill="url(#${uid})"/>
        <path d="M22 78h36v6H22z" fill="url(#${uid}m)"/>
        <path d="M35 64h10l2 14H33z" fill="url(#${uid})"/>
        <path d="M20 46c2 10 6 18 12 22h4c-1-9-2-16-1-22-5 1-10 1-15 0z" fill="url(#${uid})"/>
        <path d="M60 46c-2 10-6 18-12 22h-4c1-9 2-16 1-22 5 1 10 1 15 0z" fill="url(#${uid})"/>
        <circle cx="26" cy="46" r="3.4" fill="url(#${uid})"/>
        <circle cx="54" cy="46" r="3.4" fill="url(#${uid})"/>
        <path d="M25 49c2-9 8-16 15-17" fill="none" stroke="url(#${uid})" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M55 49c-2-9-8-16-15-17" fill="none" stroke="url(#${uid})" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="40" cy="26" r="13" fill="url(#${uid}gl)" stroke="#6E5010" stroke-width="0.7"/>
        <ellipse cx="40" cy="26" rx="6.2" ry="13" fill="none" stroke="#6E5010" stroke-width="0.7"/>
        <path d="M27 26h26M30 20c6 2.2 14 2.2 20 0M30 32c6-2.2 14-2.2 20 0" fill="none" stroke="#6E5010" stroke-width="0.7"/>
        <ellipse cx="34" cy="21" rx="4" ry="2" fill="#fff" opacity="0.4"/>`);
}

function championsLeague(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        ${shadow()}
        <path d="M22 92h36l-2 6H24z" fill="#C5CED6"/>
        <path d="M28 82h24v10H28z" fill="url(#${uid})"/>
        <path d="M36 68h8v14h-8z" fill="url(#${uid})"/>
        <path d="M24 30c-16 2-18 20-4 28 4-10 6-18 10-20" fill="url(#${uid})"/>
        <path d="M56 30c16 2 18 20 4 28-4-10-6-18-10-20" fill="url(#${uid})"/>
        <path d="M24 22h32c1 16-1 32-7 44H31C25 54 23 38 24 22z" fill="url(#${uid})"/>
        <path d="M29 24h3.4c.5 18-.4 32-3.2 42" fill="#fff" opacity="0.42"/>
        <ellipse cx="40" cy="22" rx="16" ry="3.1" fill="#F7FAFC"/>
        <ellipse cx="40" cy="22" rx="16" ry="3.1" fill="none" stroke="#7E8B96" stroke-width="0.7"/>`);
}

function majorCup(uid) {
    return artSvg(`<defs>${silver(uid)}${gold(uid + 'g')}</defs>
        ${shadow()}
        <path d="M16 40h8l3 36h-8z" fill="#1A4E86"/>
        <path d="M56 40h8l-3 36h-8z" fill="#163E6C"/>
        <path d="M18 42h5l1 8H19z" fill="#8FB4DE" opacity="0.7"/>
        <path d="M22 90h36v6H22z" fill="url(#${uid})"/>
        <path d="M28 82h24v8H28z" fill="url(#${uid}g)"/>
        <path d="M36 66h8v16h-8z" fill="url(#${uid})"/>
        <path d="M27 36c-8 1-10 10-4 14" fill="none" stroke="url(#${uid})" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M53 36c8 1 10 10 4 14" fill="none" stroke="url(#${uid})" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M26 28h28c1 12 0 26-6 36H32C26 54 25 40 26 28z" fill="url(#${uid})"/>
        <path d="M30 30h3c.3 14-.2 26-2.4 34" fill="#fff" opacity="0.4"/>
        <ellipse cx="40" cy="28" rx="14" ry="2.6" fill="#F4F7FA"/>
        <path d="M30 16l3.2 7 6.8-5 6.8 5L50 16v8H30z" fill="url(#${uid}g)"/>
        <circle cx="40" cy="14" r="1.6" fill="#FFF1C4"/>`);
}

function goldRimCup(uid) {
    return artSvg(`<defs>${silver(uid)}${gold(uid + 'g')}</defs>
        ${shadow()}
        ${plinth('silver')}
        <path d="M36 78h8v8h-8z" fill="url(#${uid})"/>
        <path d="M29 34c-7 1-8 8-3 11" fill="none" stroke="url(#${uid})" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M51 34c7 1 8 8 3 11" fill="none" stroke="url(#${uid})" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M27 28h26c1 12 0 28-5 40H32C27 56 26 40 27 28z" fill="url(#${uid})"/>
        <path d="M31 30h2.6c.4 16-.2 30-2.2 38" fill="#fff" opacity="0.38"/>
        <ellipse cx="40" cy="28" rx="13" ry="2.8" fill="url(#${uid}g)"/>
        <ellipse cx="40" cy="27" rx="11" ry="1.6" fill="#FFF6D4"/>`);
}

function goldenBoot(uid, metal = 'gold', flip = false) {
    const fill = metal === 'silver' ? silver(uid) : gold(uid);
    const edge = metal === 'silver' ? '#44505A' : '#5C430C';
    const sole = metal === 'silver' ? '#2C343C' : '#1A140C';
    return artSvg(`<defs>${fill}</defs>
        ${shadow()}
        <g transform="${flip ? 'translate(80 0) scale(-1 1)' : ''}">
        <path d="M10 76c2-4 10-7 22-7h34c8 0 12 3 11 7l-2 6H14z" fill="${sole}"/>
        <circle cx="20" cy="84" r="1.8" fill="#111"/>
        <circle cx="32" cy="85" r="1.8" fill="#111"/>
        <circle cx="46" cy="85" r="1.8" fill="#111"/>
        <circle cx="60" cy="83" r="1.8" fill="#111"/>
        <path d="M16 74c-1-16 4-26 14-30l2-16c2-8 12-12 20-6 7 5 10 14 8 22l-1 8c10 2 16 10 14 20l-1 16H16z" fill="url(#${uid})" stroke="${edge}" stroke-width="0.6"/>
        <path d="M32 30c8-3 16 1 18 8" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.45" stroke-linecap="round"/>
        <path d="M36 40v8M34 44h10M34 50h12M34 56h10M36 62h8" fill="none" stroke="${edge}" stroke-width="1.15" stroke-linecap="round"/>
        <path d="M18 62c6 2 14 2 24 0" fill="#fff" opacity="0.22"/>
        </g>`);
}

function bronze(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5C3218"/><stop offset="16%" stop-color="#F6D2B0"/><stop offset="34%" stop-color="#C4844C"/><stop offset="52%" stop-color="#F8E0C8"/><stop offset="74%" stop-color="#8A5430"/><stop offset="100%" stop-color="#3E2412"/></linearGradient>`;
}

function captainBand(uid) {
    return artSvg(`<defs>${gold(uid)}
        <linearGradient id="${uid}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2A5A9A"/><stop offset="40%" stop-color="#0C2348"/><stop offset="100%" stop-color="#071428"/></linearGradient></defs>
        ${shadow()}
        <path d="M8 60c3 16 16 26 32 26s29-10 32-26c-3 10-15 16-32 16S11 70 8 60z" fill="#071428"/>
        <path d="M8 50c0-17 14-28 32-28s32 11 32 28c-2 13-15 22-32 22S10 63 8 50z" fill="url(#${uid}n)" stroke="url(#${uid})" stroke-width="2.8"/>
        <path d="M17 50c1-11 11-18 23-18s22 7 23 18c-2 9-11 15-23 15S19 59 17 50z" fill="none" stroke="#F3D78A" stroke-width="1.5"/>
        <path d="M16 40c12-9 20-11 26-8" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.28" stroke-linecap="round"/>
        <text x="40" y="58" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="28" font-weight="700" fill="#FFFFFF">C</text>`);
}

function realMedal(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="36%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="42%" stop-color="#E2B44A"/><stop offset="100%" stop-color="#8A5A12"/></radialGradient>
        <linearGradient id="${uid}bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4E86D0"/><stop offset="100%" stop-color="#0C2348"/></linearGradient></defs>
        <path d="M27 2h11l8 36H34z" fill="url(#${uid}bl)"/>
        <path d="M42 2h11l-7 36H35z" fill="url(#${uid})"/>
        <path d="M31 6h4l2 14h-7z" fill="#fff" opacity="0.28"/>
        <circle cx="40" cy="66" r="24" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="1.1"/>
        <circle cx="40" cy="66" r="18.5" fill="none" stroke="#FFF1C4" stroke-width="1.5"/>
        <path d="M40 52.5l3.4 7.4 8 .7-6 5.4 1.8 7.8L40 69.6l-7.2 4.2 1.8-7.8-6-5.4 8-.7z" fill="#FFF8DC" stroke="#8A5A12" stroke-width="0.35"/>
        <ellipse cx="31" cy="56" rx="6" ry="3" fill="#fff" opacity="0.42"/>`);
}

function silverMedal(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        <path d="M27 2h11l8 36H34z" fill="#C4202C"/>
        <path d="M42 2h11l-7 36H35z" fill="#F7F8FA"/>
        <path d="M31 6h4l2 14h-7z" fill="#fff" opacity="0.35"/>
        <circle cx="40" cy="66" r="24" fill="url(#${uid})" stroke="#5A656E" stroke-width="1.1"/>
        <circle cx="40" cy="66" r="18" fill="none" stroke="#FFFFFF" stroke-width="1.7"/>
        <circle cx="40" cy="66" r="14.5" fill="none" stroke="#66707A" stroke-width="0.7"/>
        <circle cx="40" cy="66" r="5.2" fill="none" stroke="#3E4850" stroke-width="1.3"/>
        <ellipse cx="31" cy="56" rx="6.5" ry="3.4" fill="#fff" opacity="0.6"/>`);
}

function bronzeCup(uid) {
    return artSvg(`<defs>${bronze(uid)}</defs>
        ${shadow()}
        <path d="M20 94h40l-3 6H23z" fill="#6A3E22"/>
        <path d="M27 84h26v10H27z" fill="url(#${uid})"/>
        <path d="M35 68h10v16H35z" fill="url(#${uid})"/>
        <path d="M23 36c-11 2-13 14-4 20" fill="none" stroke="url(#${uid})" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M57 36c11 2 13 14 4 20" fill="none" stroke="url(#${uid})" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M23 26h34c1 14 0 28-8 42H31C23 54 22 40 23 26z" fill="url(#${uid})"/>
        <path d="M29 28h3.2c.4 16-.2 30-2.4 38" fill="#fff" opacity="0.32"/>
        <ellipse cx="40" cy="26" rx="17" ry="3.2" fill="#F8E0C8"/>
        <ellipse cx="33" cy="38" rx="4" ry="7" fill="#fff" opacity="0.18"/>`);
}

function glovePaths(uid) {
    return `<path d="M26 62c-9 1-13 9-9 15 5 6 14 4 18-2l2-7z" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.45"/>
        <rect x="31" y="36" width="7" height="28" rx="3.2" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="39" y="24" width="7.2" height="40" rx="3.2" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="47.2" y="30" width="7" height="34" rx="3.2" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="54.5" y="40" width="6.2" height="24" rx="3" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <path d="M28 62h34c7 0 11 6 9 13-2 9-11 15-22 15H34c-9 0-13-6-11-14 1-5 2-10 5-14z" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.45"/>
        <path d="M34 66c4-6 9-8 13-3" fill="#fff" opacity="0.28"/>`;
}

function goldenGlove(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        <g transform="translate(-4 10) scale(0.78) rotate(-14 40 70)">${glovePaths(uid)}</g>
        <g transform="translate(14 0) scale(0.78) rotate(12 40 70)">${glovePaths(uid)}</g>`);
}

function goldenBall(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="34%" cy="30%" r="70%"><stop offset="0%" stop-color="#FFF8DC"/><stop offset="42%" stop-color="#E8C15A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient></defs>
        ${shadow()}
        <path d="M24 90h32l-3 6H27z" fill="#1A1408"/>
        <path d="M30 82h20l-2 8H32z" fill="url(#${uid})"/>
        <circle cx="40" cy="46" r="24" fill="url(#${uid}b)" stroke="#6A4C10" stroke-width="0.7"/>
        <path d="M40 23l6 4.2 1.8 7.2-4.6 5.8h-6.4l-4.6-5.8 1.8-7.2z" fill="none" stroke="#5C430C" stroke-width="1.15"/>
        <path d="M22 40c6 3.2 10 3.2 16 0M40 40c6 3.2 10 3.2 18 0" fill="none" stroke="#5C430C" stroke-width="1"/>
        <path d="M24 54c7 2 12 1 16-2M40 52c7 3 12 3 18 0" fill="none" stroke="#5C430C" stroke-width="1"/>
        <path d="M30 66c5-3 10-4 16-1" fill="none" stroke="#5C430C" stroke-width="0.9"/>
        <ellipse cx="32" cy="36" rx="7" ry="4" fill="#fff" opacity="0.4"/>`);
}

function ballTrophy(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="35%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="48%" stop-color="#E2B44A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient></defs>
        ${shadow()}
        <path d="M18 96h44l-4-7H22z" fill="url(#${uid})"/>
        <path d="M26 84h28v6H26z" fill="url(#${uid})"/>
        <path d="M36 70h8v14h-8z" fill="url(#${uid})"/>
        <path d="M22 58c1 8 4 14 10 16h16c6-2 9-8 10-16-8 2-28 2-36 0z" fill="url(#${uid})"/>
        <circle cx="40" cy="34" r="16" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="0.7"/>
        <ellipse cx="40" cy="34" rx="7" ry="16" fill="none" stroke="#6E5010" stroke-width="0.7"/>
        <path d="M25 34h30M28 27c7 2 14 2 22 0M28 41c7-2 14-2 22 0" fill="none" stroke="#6E5010" stroke-width="0.7"/>
        <ellipse cx="33" cy="28" rx="4" ry="2" fill="#fff" opacity="0.45"/>`);
}

function risingTrophy(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        <path d="M40 4l9 16h-6v12h-6V20h-6z" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.35"/>
        <path d="M22 94h36v6H22z" fill="#8A6420"/>
        <path d="M28 84h24v10H28z" fill="url(#${uid})"/>
        <path d="M36 70h8v14h-8z" fill="url(#${uid})"/>
        <path d="M26 50c-8 1-9 10-3 13" fill="none" stroke="url(#${uid})" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M54 50c8 1 9 10 3 13" fill="none" stroke="url(#${uid})" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M26 42h28c.8 10 0 20-6 28H32c-6-8-7-18-6-28z" fill="url(#${uid})"/>
        <path d="M31 44h2.4c.3 12-.1 20-1.8 26" fill="#fff" opacity="0.35"/>
        <ellipse cx="40" cy="42" rx="14" ry="2.6" fill="#FFF1C4"/>`);
}

function jersey(uid, side) {
    const crest = side === 'right' ? 48 : 32;
    return artSvg(`<defs>${silver(uid)}${gold(uid + 'g')}</defs>
        ${shadow()}
        <path d="M24 32 L11 48 L22 59 L30 46 V90 H50 V46 L58 59 L69 48 L56 32 C49 42 31 42 24 32Z" fill="url(#${uid})" stroke="#7E8C99" stroke-width="0.8"/>
        <path d="M32 32 Q40 44 48 32 Q40 38 32 32Z" fill="#0E2347"/>
        <path d="M40 44 V88" stroke="url(#${uid}g)" stroke-width="1.4"/>
        <path d="M13 48 L22 57" stroke="url(#${uid}g)" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M67 48 L58 57" stroke="url(#${uid}g)" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="${crest}" cy="58" r="4.2" fill="url(#${uid}g)"/>
        <path d="M30 50c2 12 2 24 0 36" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.4"/>`);
}

function shieldPlaque(uid) {
    return artSvg(`<defs>${silver(uid)}${gold(uid + 'g')}</defs>
        ${shadow()}
        <path d="M24 90h32v7H24z" fill="#5C4636"/>
        <path d="M32 82h16v8H32z" fill="#7A5A40"/>
        <path d="M40 16l18 7v18c0 16-8 26-18 32-10-6-18-16-18-32V23z" fill="url(#${uid})" stroke="url(#${uid}g)" stroke-width="2"/>
        <path d="M40 24l11 4.2v12c0 9-4.4 15-11 20-6.6-5-11-11-11-20v-12z" fill="#fff" opacity="0.2"/>
        <path d="M40 36l5 1.6v5.2c0 3.6-2 6-5 8-3-2-5-4.4-5-8v-5.2z" fill="url(#${uid}g)"/>
        <ellipse cx="33" cy="28" rx="4" ry="2" fill="#fff" opacity="0.35"/>`);
}

export function awardArt(awardId, uid) {
    const id = safeId(uid);
    switch (awardId) {
        case 'mvp': return mvpTrophy();
        case 'mostGoals': return goalsBoot();
        case 'mostWins': return winsTrophy();
        case 'bestCaptain': return captainTrophy();
        case 'mostConsistent': return consistentTrophy();
        case 'mostLosses': return lossesSpoon();
        case 'lvp': return lvpBoot();
        case 'bestKeeper': return keeperGlove();
        case 'bestCenterBack': return shieldPlaque(id);
        case 'bestRightBack': return goldenBoot(id + 'r', 'gold', true);
        case 'bestLeftBack': return goldenBoot(id + 'l', 'silver', false);
        case 'bestAttackingMidfielder': return goldenBall(id);
        case 'bestDefensiveMidfielder': return goldRimCup(id);
        case 'bestLeftWinger': return jersey(id, 'left');
        case 'bestRightWinger': return jersey(id, 'right');
        case 'bestStriker': return ballTrophy(id);
        case 'mostImproved': return risingTrophy(id);
        default: return majorCup(id);
    }
}

export function laurelMark(uid) {
    const id = safeId(uid) + 'L';
    const leaf = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0C7-5 16-3 20 1C14 4 7 4 0 0Z" fill="url(#${id})"/><path d="M0 1C6 5 14 4 18 1C12-1 6-1 0 1Z" fill="url(#${id})" opacity="0.88"/><path d="M2 0.4H15" stroke="#FFF6D4" stroke-width="0.45" opacity="0.5"/></g>`;
    const spots = [[62, 116, -8], [50, 102, -24], [40, 88, -42], [32, 74, -58], [28, 58, -76], [32, 44, -94], [40, 30, -112], [52, 18, -128]];
    const branch = (flip) => `<g transform="${flip ? 'translate(160 0) scale(-1 1)' : ''}"><path d="M70 122C28 98 22 58 64 12" fill="none" stroke="url(#${id})" stroke-width="2" stroke-linecap="round"/>${spots.map(([x, y, rot]) => leaf(x, y, rot)).join('')}</g>`;
    return `<svg viewBox="0 0 160 130" class="hof-laurel" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#A67C22"/><stop offset="42%" stop-color="#F0D078"/><stop offset="70%" stop-color="#FFF3C4"/><stop offset="100%" stop-color="#C4922E"/></linearGradient></defs>${branch(false)}${branch(true)}</svg>`;
}

export function sectionMark(kind, uid) {
    const id = safeId(uid || kind);
    if (kind === 'voted') {
        return `<svg viewBox="0 0 24 24" class="hof-mark" aria-hidden="true"><defs>${gold(id)}</defs>
            <path d="M7.5 2h3.2l1.4 7H8.6z" fill="#8E1D24"/>
            <path d="M13.2 2h3.3l-1.5 7h-3z" fill="#1E3A5F"/>
            <circle cx="12" cy="15.2" r="6.2" fill="url(#${id})" stroke="#6E5010" stroke-width="0.4"/>
            <circle cx="12" cy="15.2" r="4.3" fill="none" stroke="#FFF1C4" stroke-width="0.7"/>
            <ellipse cx="10" cy="13.2" rx="1.6" ry="0.8" fill="#fff" opacity="0.5"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" class="hof-mark" aria-hidden="true"><defs>${gold(id)}</defs>
        <path d="M6 19.5h12v2H6z" fill="#8A6420"/>
        <path d="M11 14h2v5.5h-2z" fill="url(#${id})"/>
        <path d="M5.5 5h13c.4 4.2 0 8.2-2.4 10.5H7.9C5.5 13.2 5.1 9.2 5.5 5z" fill="url(#${id})"/>
        <path d="M5.5 6.2C2.8 6.6 2.4 9.4 4.2 10.6" fill="none" stroke="url(#${id})" stroke-width="1.35" stroke-linecap="round"/>
        <path d="M18.5 6.2c2.7.4 3.1 3.2 1.3 4.4" fill="none" stroke="url(#${id})" stroke-width="1.35" stroke-linecap="round"/>
        <ellipse cx="12" cy="5" rx="6.5" ry="1.25" fill="#FFF1C4"/></svg>`;
}

export function mountHofBanner() {
    const left = document.getElementById('hofBannerLeft');
    const right = document.getElementById('hofBannerRight');
    if (left) left.innerHTML = `${worldCup('banWcL')}${mvpTrophy()}`;
    if (right) right.innerHTML = `${championsLeague('banUclR')}${worldCup('banWcR')}`;
    mountHofCelebration();
}

function mountHofCelebration() {
    if (document.getElementById('hofSparkle')) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'hofSparkle';
    canvas.className = 'hof-sparkle';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sparks = [];
    const flakes = [];
    const colors = ['#e2b340', '#f6e3a4', '#fff8e4', '#1a3d78', '#c6a03a', '#f3d78a'];

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function edgePoint() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const band = Math.max(48, Math.min(160, w * 0.14));
        const roll = Math.random();
        if (roll < 0.4) return { x: 16 + Math.random() * band, y: 90 + Math.random() * Math.max(80, h - 180) };
        if (roll < 0.8) return { x: w - 16 - Math.random() * band, y: 90 + Math.random() * Math.max(80, h - 180) };
        if (roll < 0.9) return { x: band + Math.random() * Math.max(40, w - band * 2), y: 64 + Math.random() * 36 };
        return { x: band + Math.random() * Math.max(40, w - band * 2), y: h - 28 - Math.random() * 48 };
    }

    function burst() {
        const origin = edgePoint();
        const color = colors[Math.floor(Math.random() * colors.length)];
        const count = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i += 1) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
            const speed = (0.55 + Math.random() * 1.35) * 1.3;
            sparks.push({
                x: origin.x,
                y: origin.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.455,
                life: 1,
                decay: 0.01 + Math.random() * 0.012,
                size: 1.3 + Math.random() * 1.6,
                color
            });
        }
    }

    function makeFlake(anywhere) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const band = Math.max(36, Math.min(180, w * 0.16));
        const left = Math.random() < 0.5;
        return {
            x: left ? Math.random() * band : w - Math.random() * band,
            y: anywhere ? Math.random() * h : -12,
            vy: (0.28 + Math.random() * 0.45) * 1.3,
            vx: (Math.random() - 0.5) * 0.364,
            w: 4 + Math.random() * 3.5,
            h: 6 + Math.random() * 4,
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.039,
            color: colors[Math.floor(Math.random() * colors.length)]
        };
    }

    function seedFlakes() {
        flakes.length = 0;
        const count = 48;
        for (let i = 0; i < count; i += 1) flakes.push(makeFlake(true));
    }

    resize();
    seedFlakes();
    window.addEventListener('resize', () => {
        resize();
        seedFlakes();
    });

    let lastBurst = 0;
    let wait = 538;
    function frame(time) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);
        if (motion.matches) return;

        if (time - lastBurst > wait) {
            burst();
            burst();
            burst();
            lastBurst = time;
            wait = 846 + Math.random() * 1000;
        }

        sparks.forEach((spark) => {
            spark.x += spark.vx;
            spark.y += spark.vy;
            spark.vy += 0.018;
            spark.life -= spark.decay;
        });
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
            if (sparks[i].life <= 0) sparks.splice(i, 1);
        }
        sparks.forEach((spark) => {
            ctx.globalAlpha = Math.max(0, spark.life) * 0.85;
            ctx.fillStyle = spark.color;
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
            ctx.fill();
        });

        const band = Math.max(36, Math.min(180, width * 0.16));
        flakes.forEach((flake) => {
            flake.y += flake.vy;
            flake.x += flake.vx + Math.sin(flake.y / 28) * 0.156;
            flake.rot += flake.spin;
            if (flake.y > height + 14) {
                const next = makeFlake(false);
                flake.x = next.x;
                flake.y = next.y;
                flake.vy = next.vy;
                flake.color = next.color;
            }
            if (flake.x < -12) flake.x = band;
            if (flake.x > width + 12) flake.x = width - band;
            ctx.save();
            ctx.globalAlpha = 0.72;
            ctx.translate(flake.x, flake.y);
            ctx.rotate(flake.rot);
            ctx.fillStyle = flake.color;
            ctx.fillRect(-flake.w / 2, -flake.h / 2, flake.w, flake.h);
            ctx.restore();
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    if (motion.addEventListener) {
        motion.addEventListener('change', () => {
            if (motion.matches) {
                sparks.length = 0;
                flakes.length = 0;
                ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            } else if (!flakes.length) {
                seedFlakes();
            }
        });
    }
}
