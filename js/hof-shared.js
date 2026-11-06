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
    { id: 'bestAttackingMidfielder', title: 'Best Attacking Midfielder', blurb: 'Voted by the squad' },
    { id: 'bestDefensiveMidfielder', title: 'Best Defensive Midfielder', blurb: 'Voted by the squad' },
    { id: 'bestLeftWinger', title: 'Best Left Winger', blurb: 'Voted by the squad' },
    { id: 'bestRightWinger', title: 'Best Right Winger', blurb: 'Voted by the squad' },
    { id: 'bestStriker', title: 'Best Striker', blurb: 'Voted by the squad' },
    { id: 'mostImproved', title: 'Most Improved', blurb: 'Voted by the squad' },
    { id: 'youngPlayer', title: 'Young Player', blurb: 'Voted by the squad' }
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
    return `<svg viewBox="0 0 80 104" class="hof-art" aria-hidden="true">${inner}</svg>`;
}

function gold(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6B4E12"/><stop offset="16%" stop-color="#FFF4C8"/><stop offset="34%" stop-color="#E2B34A"/><stop offset="50%" stop-color="#FFF1C4"/><stop offset="68%" stop-color="#B8882C"/><stop offset="100%" stop-color="#5C430C"/></linearGradient>`;
}

function silver(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5A656E"/><stop offset="18%" stop-color="#FFFFFF"/><stop offset="38%" stop-color="#C5CED6"/><stop offset="55%" stop-color="#F7FAFC"/><stop offset="76%" stop-color="#8D9AA6"/><stop offset="100%" stop-color="#3E4850"/></linearGradient>`;
}

function steel(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2A3138"/><stop offset="20%" stop-color="#D5DDE4"/><stop offset="42%" stop-color="#7E8C99"/><stop offset="62%" stop-color="#F2F5F8"/><stop offset="100%" stop-color="#1C232A"/></linearGradient>`;
}

function wood(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#3E2410"/><stop offset="20%" stop-color="#C48A4E"/><stop offset="42%" stop-color="#7A4E28"/><stop offset="60%" stop-color="#E6C394"/><stop offset="80%" stop-color="#8D5A32"/><stop offset="100%" stop-color="#3A2010"/></linearGradient>`;
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

function ballonDor(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="34%" cy="32%" r="68%"><stop offset="0%" stop-color="#FFF8DC"/><stop offset="42%" stop-color="#E0B44C"/><stop offset="100%" stop-color="#7A5410"/></radialGradient></defs>
        ${shadow()}
        <rect x="24" y="78" width="32" height="14" rx="1.2" fill="#141414"/>
        <rect x="27" y="74" width="26" height="5" fill="#2A2A2A"/>
        <rect x="30" y="70" width="20" height="5" fill="url(#${uid})"/>
        <path d="M32 71.2h6" stroke="#fff" stroke-width="0.6" opacity="0.45"/>
        <circle cx="40" cy="40" r="22" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="0.6"/>
        <path d="M40 19l5.2 3.6 1.6 6.4-4 5.2h-5.6l-4-5.2 1.6-6.4z" fill="none" stroke="#5C430C" stroke-width="1.15"/>
        <path d="M28 34c4 3 8 3 12 0M40 34c4 3 8 3 12 0M24 46c6 2 10 1 16-2M40 44c6 3 10 4 16 2M30 58c4-3 8-4 14-2M44 56c3 2 7 2 12-1" fill="none" stroke="#5C430C" stroke-width="0.9" opacity="0.8"/>
        <ellipse cx="32" cy="32" rx="6" ry="3.4" fill="#fff" opacity="0.38"/>`);
}

function playmakerBall(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="36%" cy="30%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="48%" stop-color="#E2B84A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient></defs>
        ${shadow()}
        ${plinth('gold')}
        <path d="M30 78h20l-3 8H33z" fill="url(#${uid})"/>
        <path d="M26 70c2 6 6 10 14 10s12-4 14-10c-8 2-20 2-28 0z" fill="url(#${uid})"/>
        <ellipse cx="40" cy="70" rx="14" ry="3" fill="#FFF1C4"/>
        <path d="M34 72h2.2c.3 6 0 10-1.4 14" fill="#fff" opacity="0.35"/>
        <circle cx="40" cy="42" r="18" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="0.55"/>
        <path d="M40 25l4.4 3.2 1.4 5.4-3.4 4.4h-4.8l-3.4-4.4 1.4-5.4z" fill="none" stroke="#5C430C" stroke-width="1"/>
        <path d="M27 40c5 2 8 2 13 0M40 40c5 2 8 2 13 0M30 52c4-2 8-2 12 0" fill="none" stroke="#5C430C" stroke-width="0.85"/>
        <path d="M18 36c4-8 10-10 14-8M62 36c-4-8-10-10-14-8" fill="none" stroke="url(#${uid})" stroke-width="1.6" stroke-linecap="round"/>
        <ellipse cx="33" cy="35" rx="5" ry="2.8" fill="#fff" opacity="0.4"/>`);
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

function steelShieldCup(uid) {
    return artSvg(`<defs>${steel(uid)}</defs>
        ${shadow()}
        <path d="M24 92h32v6H24z" fill="#1C232A"/>
        <path d="M30 84h20v8H30z" fill="url(#${uid})"/>
        <path d="M36 72h8v12h-8z" fill="url(#${uid})"/>
        <path d="M28 40c-8 1-9 9-3 12" fill="none" stroke="url(#${uid})" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M52 40c8 1 9 9 3 12" fill="none" stroke="url(#${uid})" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M26 32h28c1 12 0 26-6 38H32C26 58 25 44 26 32z" fill="url(#${uid})"/>
        <path d="M40 42l7 2.6v7c0 5-3 8-7 11-4-3-7-6-7-11v-7z" fill="#10161C" opacity="0.45"/>
        <path d="M40 44l5 1.8v5.2c0 3.4-2 5.6-5 7.6-3-2-5-4.2-5-7.6v-5.2z" fill="#E8EEF3" opacity="0.85"/>
        <ellipse cx="40" cy="32" rx="14" ry="2.6" fill="#F2F5F8"/>
        <path d="M30 36h2.4c.3 16 0 28-2 36" fill="#fff" opacity="0.28"/>`);
}

function starCup(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        ${plinth('gold')}
        <path d="M36 76h8v10h-8z" fill="url(#${uid})"/>
        <path d="M28 36c-7 1-8 8-3 11" fill="none" stroke="url(#${uid})" stroke-width="2" stroke-linecap="round"/>
        <path d="M52 36c7 1 8 8 3 11" fill="none" stroke="url(#${uid})" stroke-width="2" stroke-linecap="round"/>
        <path d="M28 30h24c.8 10 0 24-5 34H33C28 54 27 40 28 30z" fill="url(#${uid})"/>
        <path d="M32 32h2.4c.3 14-.2 24-2 32" fill="#fff" opacity="0.32"/>
        <ellipse cx="40" cy="30" rx="12" ry="2.4" fill="#FFF1C4"/>
        <path d="M40 8l2.4 6.6H50l-5.6 4.2 2 6.6L40 21.6 33.6 25.4l2-6.6L30 14.6h7.6z" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>`);
}

function youngGlobe(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="35%" cy="32%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="50%" stop-color="#E2B84A"/><stop offset="100%" stop-color="#8A5E12"/></radialGradient>
        <linearGradient id="${uid}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E4F86"/><stop offset="100%" stop-color="#0C2344"/></linearGradient></defs>
        ${shadow()}
        <path d="M20 94h40v6H20z" fill="#0C2344"/>
        <path d="M26 84h28v10H26z" fill="url(#${uid}n)"/>
        <path d="M36 70h8v14h-8z" fill="url(#${uid})"/>
        <circle cx="40" cy="44" r="18" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="0.6"/>
        <ellipse cx="40" cy="44" rx="8" ry="18" fill="none" stroke="#6E5010" stroke-width="0.8"/>
        <path d="M23 44h34M26 36c8 3 18 3 28 0M26 52c8-3 18-3 28 0" fill="none" stroke="#6E5010" stroke-width="0.75"/>
        <ellipse cx="33" cy="37" rx="5" ry="2.6" fill="#fff" opacity="0.4"/>`);
}

function goldenBoot(uid, metal = 'gold', flip = false) {
    const fill = metal === 'silver' ? silver(uid) : gold(uid);
    const edge = metal === 'silver' ? '#44505A' : '#5C430C';
    const base = metal === 'silver' ? 'silver' : 'gold';
    return artSvg(`<defs>${fill}</defs>
        ${shadow()}
        ${plinth(base)}
        <g transform="${flip ? 'translate(80 0) scale(-1 1)' : ''}">
        <path d="M12 72h60c2 0 4 3 3 6l-2 4H14l-2-4c-1-3 0-6 2-6z" fill="#141414"/>
        <path d="M20 72V56c0-10 8-16 18-16h2V28c1-10 12-14 22-8 8 5 12 14 10 24l-2 28H20z" fill="url(#${uid})"/>
        <path d="M40 26c8-2 16 2 18 10" fill="#fff" opacity="0.3"/>
        <path d="M42 30v16M38 36h10M38 42h10M38 48h8" fill="none" stroke="${edge}" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>
        <circle cx="22" cy="78" r="1.7" fill="#111"/>
        <circle cx="34" cy="79" r="1.7" fill="#111"/>
        <circle cx="48" cy="79" r="1.7" fill="#111"/>
        <circle cx="62" cy="77" r="1.7" fill="#111"/>
        </g>`);
}

function captainBand(uid) {
    return artSvg(`<defs>${gold(uid)}
        <linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#D5DEE8"/></linearGradient></defs>
        ${shadow()}
        <ellipse cx="40" cy="62" rx="34" ry="16" fill="#A9B6C6"/>
        <ellipse cx="40" cy="50" rx="34" ry="17" fill="url(#${uid}f)"/>
        <ellipse cx="40" cy="50" rx="34" ry="17" fill="none" stroke="#0C2340" stroke-width="8"/>
        <ellipse cx="40" cy="50" rx="34" ry="17" fill="none" stroke="url(#${uid})" stroke-width="1.6"/>
        <ellipse cx="40" cy="50" rx="22" ry="10" fill="#F8FBFF"/>
        <path d="M14 42c10-8 20-10 26-8" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.75"/>
        <text x="40" y="58" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="28" font-weight="700" fill="#0C2340">C</text>`);
}

function realMedal(uid) {
    return artSvg(`<defs>${gold(uid)}
        <radialGradient id="${uid}b" cx="36%" cy="34%" r="70%"><stop offset="0%" stop-color="#FFF6D0"/><stop offset="45%" stop-color="#E2B44A"/><stop offset="100%" stop-color="#8A5A12"/></radialGradient></defs>
        <path d="M28 4h10l6 30H34z" fill="#0C2340"/>
        <path d="M42 4h10l-4 30H36z" fill="#C9A24A"/>
        <path d="M32 8h4l2 12h-6z" fill="#fff" opacity="0.18"/>
        <circle cx="40" cy="62" r="24" fill="url(#${uid}b)" stroke="#6E5010" stroke-width="1"/>
        <circle cx="40" cy="62" r="18" fill="none" stroke="#FFF1C4" stroke-width="1.5"/>
        <circle cx="40" cy="62" r="15.5" fill="none" stroke="#6E5010" stroke-width="0.6" opacity="0.5"/>
        <circle cx="40" cy="62" r="6" fill="none" stroke="#5C430C" stroke-width="1"/>
        <path d="M34 62h12M37 57c2 1.4 4 1.4 6 0M37 67c2-1.4 4-1.4 6 0" fill="none" stroke="#5C430C" stroke-width="0.7"/>
        <ellipse cx="32" cy="52" rx="6" ry="3" fill="#fff" opacity="0.4"/>`);
}

function silverMedal(uid) {
    return artSvg(`<defs>${silver(uid)}</defs>
        <path d="M29 4h9l5 28H33z" fill="#8E1D24"/>
        <path d="M42 4h9l-4 28H34z" fill="#D9DDE2"/>
        <circle cx="40" cy="62" r="24" fill="url(#${uid})" stroke="#5A656E" stroke-width="1"/>
        <circle cx="40" cy="62" r="17.5" fill="none" stroke="#F7FAFC" stroke-width="1.6"/>
        <circle cx="40" cy="62" r="14.5" fill="none" stroke="#66707A" stroke-width="0.7"/>
        <circle cx="40" cy="62" r="5.5" fill="none" stroke="#3E4850" stroke-width="1.1"/>
        <path d="M34.5 62h11M37 58c2 1.2 4 1.2 6 0M37 66c2-1.2 4-1.2 6 0" fill="none" stroke="#3E4850" stroke-width="0.7"/>
        <ellipse cx="32" cy="52" rx="6" ry="3.2" fill="#fff" opacity="0.55"/>`);
}

function woodenSpoon(uid) {
    return artSvg(`<defs>${wood(uid)}</defs>
        ${shadow()}
        <rect x="26" y="90" width="28" height="6" rx="1" fill="#2A2118"/>
        <ellipse cx="40" cy="34" rx="16" ry="20" fill="url(#${uid})" stroke="#3E2410" stroke-width="0.6"/>
        <ellipse cx="40" cy="35" rx="10" ry="13" fill="#4A2C16" opacity="0.35"/>
        <ellipse cx="34" cy="26" rx="5" ry="3" fill="#fff" opacity="0.28"/>
        <path d="M36.5 52h7c.8 12 .6 24 0 40h-7c-.6-16-.8-28 0-40z" fill="url(#${uid})"/>
        <path d="M39 54h1.4c.2 12 0 26-.2 36H39z" fill="#fff" opacity="0.25"/>
        <path d="M30 28c6 8 8 14 8 20M48 24c-2 8-2 14 0 22" fill="none" stroke="#3E2410" stroke-width="0.6" opacity="0.35"/>`);
}

function goldenGlove(uid) {
    return artSvg(`<defs>${gold(uid)}</defs>
        ${shadow()}
        <path d="M16 88h48v8H16z" fill="#161616"/>
        <path d="M20 82h40v7H20z" fill="#2A2A2A"/>
        <rect x="30" y="30" width="8" height="28" rx="3.5" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="39" y="18" width="8" height="40" rx="3.5" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="48" y="24" width="8" height="34" rx="3.5" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <rect x="56" y="34" width="7" height="24" rx="3.5" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <path d="M28 58c-12 1-16 10-12 16 5 5 14 3 18-2l2-8z" fill="url(#${uid})" stroke="#6E5010" stroke-width="0.4"/>
        <path d="M26 56h36c8 0 12 7 10 14-2 10-12 16-24 16H34c-10 0-14-6-12-14 1-6 2-12 4-16z" fill="url(#${uid})"/>
        <path d="M32 62c4-8 10-10 14-4" fill="#fff" opacity="0.28"/>
        <path d="M36 64v16M44 62v18M52 64v16" stroke="#5C430C" stroke-width="0.7" opacity="0.35"/>`);
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
        case 'mvp': return ballonDor(id);
        case 'mostGoals': return goldenBoot(id, 'gold');
        case 'mostWins': return majorCup(id);
        case 'bestCaptain': return captainBand(id);
        case 'mostConsistent': return realMedal(id);
        case 'mostLosses': return woodenSpoon(id);
        case 'lvp': return silverMedal(id);
        case 'bestKeeper': return goldenGlove(id);
        case 'bestCenterBack': return shieldPlaque(id);
        case 'bestRightBack': return goldenBoot(id + 'r', 'gold', true);
        case 'bestLeftBack': return goldenBoot(id + 'l', 'silver', false);
        case 'bestAttackingMidfielder': return playmakerBall(id);
        case 'bestDefensiveMidfielder': return steelShieldCup(id);
        case 'bestLeftWinger': return championsLeague(id);
        case 'bestRightWinger': return goldRimCup(id);
        case 'bestStriker': return worldCup(id);
        case 'mostImproved': return starCup(id);
        case 'youngPlayer': return youngGlobe(id);
        default: return majorCup(id);
    }
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
    if (left) left.innerHTML = `${worldCup('banWcL')}${ballonDor('banBdL')}`;
    if (right) right.innerHTML = `${championsLeague('banUclR')}${worldCup('banWcR')}`;
}
