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
        blurb: 'Captain wins',
        statKey: 'captainWins',
        higher: true,
        requirePositive: true,
        format: (n) => `${n} captain win${n === 1 ? '' : 's'}`
    },
    {
        id: 'mostConsistent',
        title: 'Most Consistent',
        blurb: 'Games played',
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
    { id: 'bestMidfielder', title: 'Best Midfielder', blurb: 'Voted by the squad' },
    { id: 'bestLeftWinger', title: 'Best Left Winger', blurb: 'Voted by the squad' },
    { id: 'bestRightWinger', title: 'Best Right Winger', blurb: 'Voted by the squad' },
    { id: 'bestStriker', title: 'Best Striker', blurb: 'Voted by the squad' },
    { id: 'mostImproved', title: 'Most Improved Player', blurb: 'Voted by the squad' },
    { id: 'youngPlayer', title: 'Young Player Award', blurb: 'Voted by the squad' }
];

export const VOTE_AWARD_IDS = VOTE_AWARDS.map((award) => award.id);

const METALS = {
    gold: ['#FFF4C8', '#E2B340', '#8D6410'],
    silver: ['#FFFFFF', '#C5CED6', '#66727F'],
    wood: ['#F3D7B0', '#B47A45', '#6B4423'],
    tin: ['#F4F7F8', '#AEBCC4', '#5E727E'],
    green: ['#E5F8EC', '#3CAA6E', '#14643A'],
    blue: ['#E5F0FF', '#4C86D9', '#1C3F86'],
    navy: ['#E4E9F6', '#5168A6', '#1A2754'],
    purple: ['#F3E9FF', '#8B5CF6', '#4C1D95'],
    orange: ['#FFF0E0', '#F0A04B', '#B45309'],
    teal: ['#E5F8F6', '#2AA89A', '#0F5C56']
};

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

function defs(uid, metal) {
    const [light, mid, dark] = METALS[metal] || METALS.gold;
    return `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${light}"/><stop offset="55%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/></linearGradient></defs>`;
}

function star() {
    return '<path fill="#3b2a10" d="M0-11.2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L0 3.6l-5.9 3.3 1.2-6.5-4.8-4.6 6.6-.9z"/>';
}

function check() {
    return '<path d="M-8 .5-2.5 6.5 9-7" fill="none" stroke="#145C38" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';
}

function arrowUp() {
    return '<path fill="#145C38" d="M0-11l7 7h-4v9h-6v-9h-4z"/>';
}

function arrowRight() {
    return '<path fill="#0F5C56" d="M-10-3h7v-5l8 8-8 8v-5h-7z"/>';
}

function shield() {
    return '<path fill="#1A2754" d="M0-12 11-8.5V1.5C11 7.5 6.5 11.5 0 14-6.5 11.5-11 7.5-11 1.5V-8.5z"/>';
}

function diamond() {
    return '<path fill="#4C1D95" d="M0-11 8 0 0 11-8 0z"/>';
}

function swoosh() {
    return '<path fill="#B45309" d="M-12 5c4-9 12-12 22-11-7 1-12 3-15 7 5-1 9 0 13 2-8 1-14 1-20 2z"/>';
}

function ball() {
    return '<g><circle cx="0" cy="1" r="8" fill="#1A2754"/><circle cx="0" cy="1" r="2.3" fill="#F8F1DC"/></g>';
}

function engrave(text, size) {
    return `<text x="0" y="${Math.round(size * 0.35)}" text-anchor="middle" font-size="${size}" font-weight="700" fill="#1A2754" font-family="Georgia, 'Times New Roman', serif">${text}</text>`;
}

function medal(metal, emblem, uid) {
    return `<svg viewBox="0 0 88 100" class="hof-art" aria-hidden="true">${defs(uid, metal)}<path d="M31 4h11l7 44H24z" fill="#b4232a"/><path d="M46 4h11l-5 44H40z" fill="#1d4e89"/><circle cx="44" cy="64" r="26" fill="url(#${uid})"/><circle cx="44" cy="64" r="19.5" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2"/><g transform="translate(44 64)">${emblem}</g></svg>`;
}

function trophy(metal, emblem, uid) {
    return `<svg viewBox="0 0 88 100" class="hof-art" aria-hidden="true">${defs(uid, metal)}<path d="M20 28c-12 1-16 12-12 20 3 7 11 8 16 4" fill="none" stroke="url(#${uid})" stroke-width="4" stroke-linecap="round"/><path d="M68 28c12 1 16 12 12 20-3 7-11 8-16 4" fill="none" stroke="url(#${uid})" stroke-width="4" stroke-linecap="round"/><path d="M26 16h36v30c0 14-8 24-18 24S26 60 26 46V16z" fill="url(#${uid})"/><path d="M40 70h8v10h-8z" fill="url(#${uid})"/><path d="M30 80h28v6H30z" fill="url(#${uid})"/><path d="M24 86h40v6H24z" fill="url(#${uid})"/><g transform="translate(44 40)">${emblem}</g></svg>`;
}

function boot(uid) {
    return `<svg viewBox="0 0 88 100" class="hof-art" aria-hidden="true">${defs(uid, 'gold')}<path fill="url(#${uid})" d="M33 12h16c2 0 4 2 4 4v24l14 4c9 2 13 8 13 15v7H28c-8 0-14-6-14-14v-8l8-4V16c0-2 2-4 11-4z"/><path fill="#6B4A12" d="M14 70h66v8H14z"/><path fill="rgba(255,255,255,.35)" d="M38 18h8v18h-8z"/></svg>`;
}

function spoon(uid) {
    return `<svg viewBox="0 0 88 100" class="hof-art" aria-hidden="true">${defs(uid, 'wood')}<ellipse cx="44" cy="28" rx="18" ry="22" fill="url(#${uid})"/><ellipse cx="44" cy="29" rx="10" ry="13" fill="rgba(255,255,255,.28)"/><rect x="40" y="46" width="8" height="40" rx="4" fill="url(#${uid})"/></svg>`;
}

export function awardArt(awardId, uid) {
    const id = safeId(uid);
    switch (awardId) {
        case 'mvp': return trophy('gold', star(), id);
        case 'mostGoals': return boot(id);
        case 'mostWins': return medal('gold', engrave('W', 18), id);
        case 'bestCaptain': return trophy('purple', engrave('C', 18), id);
        case 'mostConsistent': return medal('green', check(), id);
        case 'mostLosses': return spoon(id);
        case 'lvp': return medal('tin', engrave('LVP', 11), id);
        case 'bestKeeper': return medal('blue', engrave('GK', 13), id);
        case 'bestCenterBack': return medal('navy', shield(), id);
        case 'bestRightBack': return medal('teal', arrowRight(), id);
        case 'bestLeftBack': return medal('teal', `<g transform="scale(-1 1)">${arrowRight()}</g>`, id);
        case 'bestMidfielder': return medal('purple', diamond(), id);
        case 'bestLeftWinger': return medal('orange', `<g transform="scale(-1 1)">${swoosh()}</g>`, id);
        case 'bestRightWinger': return medal('orange', swoosh(), id);
        case 'bestStriker': return trophy('gold', ball(), id);
        case 'mostImproved': return medal('green', arrowUp(), id);
        case 'youngPlayer': return medal('gold', star(), id);
        default: return medal('gold', star(), id);
    }
}
