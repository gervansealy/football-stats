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
    { id: 'bestKeeper', title: 'Best Keeper', blurb: '' },
    { id: 'bestCenterBack', title: 'Best Center Back', blurb: '' },
    { id: 'bestRightBack', title: 'Best Right Back', blurb: '' },
    { id: 'bestLeftBack', title: 'Best Left Back', blurb: '' },
    { id: 'bestMidfielder', title: 'Best Midfielder', blurb: '' },
    { id: 'bestLeftWinger', title: 'Best Left Winger', blurb: '' },
    { id: 'bestRightWinger', title: 'Best Right Winger', blurb: '' },
    { id: 'bestStriker', title: 'Best Striker', blurb: '' },
    { id: 'mostImproved', title: 'Most Improved', blurb: '' },
    { id: 'youngPlayer', title: 'Young Player', blurb: '' }
];

export const VOTE_AWARD_IDS = VOTE_AWARDS.map((award) => award.id);


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
    return `<svg viewBox="0 0 80 100" class="hof-art" aria-hidden="true">${inner}</svg>`;
}

function gold(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.15"><stop offset="0%" stop-color="#6E5010"/><stop offset="18%" stop-color="#F8E7A4"/><stop offset="42%" stop-color="#C8962A"/><stop offset="68%" stop-color="#F4DC8C"/><stop offset="100%" stop-color="#5C430C"/></linearGradient>`;
}

function silver(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#66707A"/><stop offset="22%" stop-color="#F7F9FB"/><stop offset="48%" stop-color="#B4BEC8"/><stop offset="74%" stop-color="#F4F7F8"/><stop offset="100%" stop-color="#55606A"/></linearGradient>`;
}

function shadow() {
    return '<ellipse cx="40" cy="94" rx="18" ry="2.6" fill="#000" opacity="0.16"/>';
}

function ballonDor(uid, scale = 1) {
    const r = 18 * scale;
    const cy = 34;
    return artSvg(`<defs>${gold(uid)}<radialGradient id="${uid}b" cx="36%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="42%" stop-color="#E2B84A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient><linearGradient id="${uid}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3A3A3A"/><stop offset="100%" stop-color="#121212"/></linearGradient></defs>
        ${shadow()}
        <rect x="24" y="70" width="32" height="16" rx="1.5" fill="url(#${uid}p)"/>
        <rect x="27" y="66" width="26" height="5" fill="url(#${uid})"/>
        <rect x="31" y="62" width="18" height="5" fill="#1A1A1A"/>
        <circle cx="40" cy="${cy}" r="${r}" fill="url(#${uid}b)"/>
        <path d="M40 ${cy - r + 1}c3.2 5 5 9 5 14s-1.8 9-5 14c-3.2-5-5-9-5-14s1.8-9 5-14z" fill="none" stroke="#7A5510" stroke-width="0.7" opacity="0.55"/>
        <path d="M${40 - r + 1} ${cy - 2}c7 2 12 2 ${r - 1} 0s10-2 ${r - 1} 0" fill="none" stroke="#7A5510" stroke-width="0.55" opacity="0.4"/>
        <path d="M${40 - r + 3} ${cy + 8}c6-1.5 11-1.5 ${r - 3} 0s9 1.5 ${r - 3} 0" fill="none" stroke="#fff" stroke-width="0.45" opacity="0.28"/>
        <ellipse cx="${40 - 7}" cy="${cy - 7}" rx="5" ry="3" fill="#fff" opacity="0.32"/>`);
}

function worldCup(uid) {
    return artSvg(`<defs>${gold(uid)}<linearGradient id="${uid}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2F8A62"/><stop offset="100%" stop-color="#0C3A28"/></linearGradient><radialGradient id="${uid}gl" cx="38%" cy="34%" r="72%"><stop offset="0%" stop-color="#FFF3C8"/><stop offset="100%" stop-color="#A97816"/></radialGradient></defs>
        ${shadow()}
        <path d="M16 90h48l-4-7H20z" fill="url(#${uid}m)"/>
        <path d="M20 83h40l-2-5H22z" fill="url(#${uid})"/>
        <path d="M24 74h32v5H24z" fill="url(#${uid}m)"/>
        <path d="M36 62h8l2 12H34z" fill="url(#${uid})"/>
        <path d="M22 46c1 9 4 16 9 20h5c-1-8-2-14-1-20-4 1-9 1-13 0z" fill="url(#${uid})"/>
        <path d="M58 46c-1 9-4 16-9 20h-5c1-8 2-14 1-20 4 1 9 1 13 0z" fill="url(#${uid})"/>
        <circle cx="28" cy="45" r="3.1" fill="url(#${uid})"/>
        <circle cx="52" cy="45" r="3.1" fill="url(#${uid})"/>
        <path d="M27 48c1-8 7-14 13-15" fill="none" stroke="url(#${uid})" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M53 48c-1-8-7-14-13-15" fill="none" stroke="url(#${uid})" stroke-width="2.3" stroke-linecap="round"/>
        <circle cx="40" cy="26" r="12" fill="url(#${uid}gl)" stroke="#7A5510" stroke-width="0.6"/>
        <ellipse cx="40" cy="26" rx="6" ry="12" fill="none" stroke="#7A5510" stroke-width="0.55" opacity="0.55"/>
        <path d="M28 26h24M31 20.5c6 2 12 2 18 0M31 31.5c6-2 12-2 18 0" fill="none" stroke="#7A5510" stroke-width="0.5" opacity="0.5"/>`);
}

function championsLeague(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        ${shadow()}
        <path d="M22 86h36l-2 6H24z" fill="#C5CED6"/>
        <path d="M26 78h28v8H26z" fill="url(#${uid})"/>
        <path d="M36 64h8v14h-8z" fill="url(#${uid})"/>
        <path d="M26 24c-14 1-16 18-5 26 3-8 5-16 9-18" fill="url(#${uid})"/>
        <path d="M54 24c14 1 16 18 5 26-3-8-5-16-9-18" fill="url(#${uid})"/>
        <path d="M26 18h28c1 14-1 28-6 38H32C27 46 25 32 26 18z" fill="url(#${uid})"/>
        <path d="M31 20h3.2c.4 16-.4 28-3.2 36" fill="#fff" opacity="0.38"/>
        <ellipse cx="40" cy="18" rx="14" ry="2.8" fill="#F4F7F9"/>
        <ellipse cx="40" cy="18" rx="14" ry="2.8" fill="none" stroke="#8B97A3" stroke-width="0.6"/>`);
}

function classicCup(uid, { metal = 'gold', ears = false, lid = false, ball = false, tall = false } = {}) {
    const fill = metal === 'silver' ? silver(uid) : gold(uid);
    const top = tall ? 12 : 22;
    const bowl = tall ? 34 : 30;
    return artSvg(`<defs>${fill}</defs>
        ${shadow()}
        <path d="M24 86h32l-2 5H26z" fill="${metal === 'silver' ? '#C5CED6' : '#C9A24A'}"/>
        <path d="M28 78h24v8H28z" fill="url(#${uid})"/>
        <path d="M36 ${top + bowl + 6}h8v${78 - (top + bowl + 6)}h-8z" fill="url(#${uid})"/>
        ${ears
            ? `<path d="M27 ${top + 4}c-12 1-14 14-4 20" fill="none" stroke="url(#${uid})" stroke-width="2.6" stroke-linecap="round"/>
               <path d="M53 ${top + 4}c12 1 14 14 4 20" fill="none" stroke="url(#${uid})" stroke-width="2.6" stroke-linecap="round"/>`
            : `<path d="M28 ${top + 4}c-7 1-9 8-4 12" fill="none" stroke="url(#${uid})" stroke-width="2" stroke-linecap="round"/>
               <path d="M52 ${top + 4}c7 1 9 8 4 12" fill="none" stroke="url(#${uid})" stroke-width="2" stroke-linecap="round"/>`}
        <path d="M27 ${top}h26c1 12 0 ${bowl - 8}-5 ${bowl}H32C27 ${top + bowl - 8} 26 ${top + 12} 27 ${top}z" fill="url(#${uid})"/>
        <path d="M31 ${top + 2}h3c.3 12-.2 ${bowl - 10}-2.6 ${bowl - 4}" fill="#fff" opacity="0.32"/>
        <ellipse cx="40" cy="${top}" rx="13" ry="2.5" fill="${metal === 'silver' ? '#F7F9FB' : '#F8E7A4'}"/>
        ${lid ? `<path d="M30 ${top - 6}h20v5H30z" fill="url(#${uid})"/><ellipse cx="40" cy="${top - 6}" rx="10" ry="2" fill="${metal === 'silver' ? '#F7F9FB' : '#F8E7A4'}"/>` : ''}
        ${ball ? `<circle cx="40" cy="${top - (lid ? 12 : 8)}" r="4.2" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>` : (lid ? `<circle cx="40" cy="${top - 11}" r="2.4" fill="url(#${uid})"/>` : '')}`);
}

function henriDelaunay(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        ${shadow()}
        <ellipse cx="40" cy="88" rx="14" ry="3" fill="url(#${uid})"/>
        <path d="M37 70h6v16h-6z" fill="url(#${uid})"/>
        <path d="M30 58c-2 8 2 14 10 16 8-2 12-8 10-16-6 2-14 2-20 0z" fill="url(#${uid})"/>
        <path d="M34 28c-1 10 1 22 6 30 5-8 7-20 6-30-4 1-8 1-12 0z" fill="url(#${uid})"/>
        <path d="M32 24c-6 2-7 8-3 10" fill="none" stroke="url(#${uid})" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M48 24c6 2 7 8 3 10" fill="none" stroke="url(#${uid})" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M33 16h14v10c0 2-3 4-7 4s-7-2-7-4z" fill="url(#${uid})"/>
        <ellipse cx="40" cy="16" rx="7" ry="2" fill="#F7F9FB"/>
        <path d="M36 20h2c.2 16 0 28-1.5 40" fill="#fff" opacity="0.35"/>`);
}

function goldenBoot(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        <path d="M16 78h52v5H16z" fill="#1C1C1C"/>
        <path d="M18 73h48v5H18z" fill="#2C2C2C"/>
        <path d="M18 64
            L18 50
            C18 44 24 40 30 40
            L34 40 L34 24
            C34 18 40 16 46 16
            L52 16 L52 32
            L58 34
            C68 38 72 48 72 56
            L72 64 Z" fill="url(#${uid})"/>
        <path d="M38 20h6v16h-6z" fill="#fff" opacity="0.3"/>
        <path d="M24 48h10M24 52h9M24 56h8" stroke="#6E5010" stroke-width="0.9" opacity="0.45"/>
        <path d="M18 64h54v5H18z" fill="#5C430C"/>
        <rect x="26" y="70" width="3.2" height="3.2" rx="0.4" fill="#111"/>
        <rect x="36" y="70" width="3.2" height="3.2" rx="0.4" fill="#111"/>
        <rect x="48" y="70" width="3.2" height="3.2" rx="0.4" fill="#111"/>
        <rect x="58" y="70" width="3.2" height="3.2" rx="0.4" fill="#111"/>`);
}

function realMedal(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        <path d="M32 4h7l5 28h-16z" fill="#8E1D24"/>
        <path d="M41 4h7l-4 28H36z" fill="#1E3A5F"/>
        <circle cx="40" cy="58" r="24" fill="url(#${uid})"/>
        <circle cx="40" cy="58" r="18" fill="none" stroke="#F8E7A4" stroke-width="1.4" opacity="0.85"/>
        <circle cx="40" cy="58" r="16.2" fill="none" stroke="#6E5010" stroke-width="0.6" opacity="0.45"/>
        <path d="M30 52c2-4 6-6 10-6s8 2 10 6c-3 1-7 2-10 2s-7-1-10-2zM29 62c3 3 7 5 11 5s8-2 11-5c-3 1-7 2-11 2s-8-1-11-2z" fill="none" stroke="#6E5010" stroke-width="0.7" opacity="0.4"/>
        <ellipse cx="33" cy="48" rx="6" ry="3" fill="#fff" opacity="0.28"/>`);
}

function woodenSpoon(uid) {
    return artSvg(`<defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6B4423"/><stop offset="35%" stop-color="#E7C49A"/><stop offset="70%" stop-color="#A56B3C"/><stop offset="100%" stop-color="#5C3718"/></linearGradient></defs>
        <ellipse cx="40" cy="30" rx="16" ry="20" fill="url(#${uid})"/>
        <ellipse cx="40" cy="31" rx="10" ry="13" fill="#6B4423" opacity="0.28"/>
        <ellipse cx="36" cy="24" rx="5" ry="3" fill="#fff" opacity="0.22"/>
        <path d="M37 48h6c1 14 1 24 0 40h-6c-1-16-1-26 0-40z" fill="url(#${uid})"/>
        <path d="M39 50h1.2v36H39z" fill="#fff" opacity="0.2"/>`);
}

function pewterCup(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        ${shadow()}
        <path d="M26 82h28v6H26z" fill="#8B97A3"/>
        <path d="M30 28h20c1 16-1 36-4 48H34C31 64 29 44 30 28z" fill="url(#${uid})"/>
        <ellipse cx="40" cy="28" rx="10" ry="2.4" fill="#EEF2F5"/>
        <path d="M50 34c8 1 10 8 6 12-3 3-6 1-7-2" fill="none" stroke="url(#${uid})" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M33 32h2c.4 20-.2 36-2 44" fill="#fff" opacity="0.28"/>`);
}

function goldenGlove(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        <path d="M18 80h44v6H18z" fill="#1C1C1C"/>
        <path d="M22 74h36v6H22z" fill="#3A3A3A"/>
        <path d="M24 58c0-6 4-8 8-8h6l2-16c1-4 6-5 8-1l1 8 3-10c1-4 6-4 7 0l1 12 2-8c1-3 5-3 6 0v14c6 2 10 8 8 14-2 8-10 14-20 14H32c-6 0-8-4-8-9z" fill="url(#${uid})"/>
        <path d="M30 52h4v16h-4z" fill="#fff" opacity="0.2"/>
        <path d="M36 36v14M42 30v18M48 34v16" stroke="#6E5010" stroke-width="0.6" opacity="0.35"/>`);
}

function shieldPlaque(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        ${shadow()}
        <path d="M28 82h24v6H28z" fill="#6B5344"/>
        <path d="M34 76h12v6H34z" fill="#8B6A4A"/>
        <path d="M40 18l16 6v16c0 14-7 22-16 28-9-6-16-14-16-28V24z" fill="url(#${uid})" stroke="#66707A" stroke-width="0.8"/>
        <path d="M40 22l12 4.5v13c0 10-5 17-12 22-1-6-2-14-2-22V26z" fill="#fff" opacity="0.22"/>`);
}

function laurelCup(uid) {
    const cup = classicCup(uid, { metal: 'gold' });
    return cup.replace('</svg>', `<path d="M30 40c2 3 4 4 6 4M50 40c-2 3-4 4-6 4M32 46c2 2 4 3 6 2M48 46c-2 2-4 3-6 2" fill="none" stroke="#6E5010" stroke-width="0.8" opacity="0.45"/></svg>`);
}

export function awardArt(awardId, uid) {
    const id = safeId(uid);
    switch (awardId) {
        case 'mvp': return ballonDor(id);
        case 'mostGoals': return goldenBoot(id);
        case 'mostWins': return worldCup(id);
        case 'bestCaptain': return championsLeague(id);
        case 'mostConsistent': return realMedal(id);
        case 'mostLosses': return woodenSpoon(id);
        case 'lvp': return pewterCup(id);
        case 'bestKeeper': return goldenGlove(id);
        case 'bestCenterBack': return shieldPlaque(id);
        case 'bestRightBack': return classicCup(id, { metal: 'silver' });
        case 'bestLeftBack': return classicCup(id, { metal: 'silver', ears: true });
        case 'bestMidfielder': return henriDelaunay(id);
        case 'bestLeftWinger': return classicCup(id, { metal: 'gold' });
        case 'bestRightWinger': return classicCup(id, { metal: 'gold', lid: true });
        case 'bestStriker': return classicCup(id, { metal: 'gold', lid: true, ball: true });
        case 'mostImproved': return laurelCup(id);
        case 'youngPlayer': return ballonDor(id + 'y', 0.82);
        default: return classicCup(id);
    }
}

export function mountHofBanner() {
    const left = document.getElementById('hofBannerLeft');
    const right = document.getElementById('hofBannerRight');
    if (left) left.innerHTML = `${worldCup('banWcL')}${ballonDor('banBdL')}`;
    if (right) right.innerHTML = `${championsLeague('banUclR')}${worldCup('banWcR')}`;
}
