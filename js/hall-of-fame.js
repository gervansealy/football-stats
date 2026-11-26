import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, doc, onSnapshot, getDocs, query, where, writeBatch, serverTimestamp, deleteField, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
    STAT_AWARDS, VOTE_AWARDS, VOTE_AWARD_IDS, NOMINEE_COUNT, CREATIVE_LIMIT, normalizePoints, calculateSeasonStats,
    pickStatWinners, esc, awardArt, photoHtml, mountHofBanner, sectionMark, laurelMark
} from './hof-shared.js';

mountHofBanner();

const CURRENT_YEAR = new Date().getFullYear();
const MIN_VOTER_GAMES = 9;
const NOMINEE_SLOTS = Array.from({ length: NOMINEE_COUNT }, (_, slot) => slot);

let role = 'viewer';
let players = [];
let games = [];
let seasons = {};
let admins = {};
let tokens = [];
let pointValues = normalizePoints(null);
let selectedYear = CURRENT_YEAR;
let yearOpen = true;
const localDrafts = {};
const seededDrafts = new Set();
const ready = { players: false, games: false, seasons: false, admins: true, points: false, tokens: true };
let lastHtml = '';
let busy = false;
let savedNoteYear = null;
let savedTimer = 0;
let savedVideoYear = null;
let savedVideoTimer = 0;
const videoDrafts = {};
let revealOpen = null;
let revealTimer = 0;
let revealAudio = null;

const root = () => document.getElementById('hofRoot');

document.addEventListener('DOMContentLoaded', async () => {
    const authState = await checkAuth();
    role = authState.role;
    if (role === 'admin') {
        ready.admins = false;
        ready.tokens = false;
        onSnapshot(collection(db, 'hofAdmin'), (snap) => {
            admins = {};
            snap.docs.forEach((item) => { admins[item.id] = item.data(); });
            ready.admins = true;
            render();
        }, (error) => {
            console.error(error);
            ready.admins = true;
            render();
        });
        onSnapshot(collection(db, 'hofTokens'), (snap) => {
            tokens = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
            ready.tokens = true;
            render();
        }, (error) => {
            console.error(error);
            ready.tokens = true;
            render();
        });
    }

    onSnapshot(collection(db, 'players'), (snap) => {
        players = snap.docs.map((item) => {
            const data = item.data();
            return {
                id: item.id,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                headshotLink: data.headshotLink || ''
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
        ready.players = true;
        render();
    }, (error) => {
        console.error(error);
        ready.players = true;
        render();
    });

    onSnapshot(collection(db, 'games'), (snap) => {
        games = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        ready.games = true;
        render();
    }, (error) => {
        console.error(error);
        ready.games = true;
        render();
    });

    onSnapshot(collection(db, 'hofSeasons'), (snap) => {
        seasons = {};
        snap.docs.forEach((item) => { seasons[item.id] = item.data(); });
        ready.seasons = true;
        render();
    }, (error) => {
        console.error(error);
        ready.seasons = true;
        render();
    });

    onSnapshot(doc(db, 'config', 'points'), (snap) => {
        pointValues = normalizePoints(snap.exists() ? snap.data() : null);
        ready.points = true;
        render();
    }, () => {
        ready.points = true;
        render();
    });

    const hofRoot = root();
    hofRoot.addEventListener('click', onClick);
    hofRoot.addEventListener('change', onDraftChange);
    hofRoot.addEventListener('input', onVideoInput);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !revealOpen) return;
        dismissCeremony(true);
    });
});

function canRender() {
    return ready.players && ready.games && ready.seasons && ready.points && ready.admins && ready.tokens;
}

function yearsToShow() {
    const years = new Set([CURRENT_YEAR]);
    games.forEach((game) => {
        const year = Number(game.year);
        if (year) years.add(year);
    });
    Object.keys(seasons).forEach((year) => {
        const value = Number(year);
        if (value) years.add(value);
    });
    Object.keys(admins).forEach((year) => {
        const value = Number(year);
        if (value) years.add(value);
    });
    return [...years].sort((a, b) => b - a);
}

function seasonOf(year) {
    return seasons[String(year)] || { statsPublished: false, votesPublished: false, publicResults: null };
}

function adminOf(year) {
    return admins[String(year)] || { voteStatus: 'none', generation: 0, nomineeDraft: null };
}

function readSession(year) {
    try {
        const raw = sessionStorage.getItem(`hof-draft-${year}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function normalizeDraft(raw) {
    const draft = {};
    VOTE_AWARD_IDS.forEach((awardId) => {
        const value = raw && Array.isArray(raw[awardId]) ? raw[awardId] : [];
        draft[awardId] = NOMINEE_SLOTS.map((slot) => (typeof value[slot] === 'string' ? value[slot] : ''));
    });
    draft.creativeAwards = normalizeCreative(raw && raw.creativeAwards);
    return draft;
}

function blankCreativeNominee() {
    return { description: '', playerId: '', playerId2: '' };
}

function creativePlayerId(row) {
    if (typeof row?.playerId === 'string' && row.playerId) return row.playerId;
    if (typeof row?.id === 'string' && row.id && !row.id.includes('::')) return row.id;
    return '';
}

function creativePartnerId(row) {
    if (typeof row?.playerId2 === 'string' && row.playerId2) return row.playerId2;
    if (typeof row?.partner?.id === 'string') return row.partner.id;
    return '';
}

function creativeOptionId(row) {
    const primary = creativePlayerId(row);
    const partner = creativePartnerId(row);
    if (!partner || partner === primary) return primary;
    return [primary, partner].sort().join('::');
}

function nomineeLabel(person) {
    if (!person?.partner?.name) return person?.name || 'Player';
    return `${person.name} & ${person.partner.name}`;
}

function pairPhotos(person, extraClass) {
    if (!person?.partner) return photoHtml(person, extraClass);
    return `<span class="hof-pair">${photoHtml(person, extraClass)}${photoHtml(person.partner, extraClass)}</span>`;
}

function partnerFrom(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
    const live = playerMap()[raw.id];
    const firstName = live?.firstName || raw.firstName || '';
    const lastName = live?.lastName || raw.lastName || '';
    return {
        id: raw.id,
        firstName,
        lastName,
        name: live?.name || raw.name || `${firstName} ${lastName}`.trim() || 'Player',
        headshotLink: live?.headshotLink || raw.headshot || raw.headshotLink || ''
    };
}

function normalizeCreative(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.slice(0, CREATIVE_LIMIT).map((item, index) => {
        const nominees = Array.isArray(item?.nominees) ? item.nominees : [];
        return {
            id: `creative${index + 1}`,
            title: String(item?.title || '').slice(0, 80),
            kind: 'creative',
            nominees: NOMINEE_SLOTS.map((slot) => ({
                description: String(nominees[slot]?.description || '').slice(0, 160),
                playerId: creativePlayerId(nominees[slot]),
                playerId2: creativePartnerId(nominees[slot])
            }))
        };
    });
}

function draftScore(raw) {
    if (!raw || typeof raw !== 'object') return 0;
    const field = VOTE_AWARD_IDS.reduce((sum, awardId) => {
        const list = raw[awardId];
        if (!Array.isArray(list)) return sum;
        return sum + list.filter((value) => typeof value === 'string' && value).length;
    }, 0);
    return field + normalizeCreative(raw.creativeAwards).reduce((sum, award) => {
        const title = award.title.trim() ? 1 : 0;
        const rows = award.nominees.filter((row) => row.description.trim() || row.playerId || row.playerId2).length;
        return sum + title + rows;
    }, 0);
}

function picksFor(year) {
    const key = String(year);
    if (!seededDrafts.has(key)) {
        seededDrafts.add(key);
        const session = readSession(year);
        const server = adminOf(year).nomineeDraft;
        const chosen = session && draftScore(session) >= draftScore(server) ? session : (server || session);
        localDrafts[key] = normalizeDraft(chosen);
    }
    return localDrafts[key];
}

function rememberDraft(year, picks) {
    const draft = normalizeDraft(picks);
    localDrafts[String(year)] = draft;
    try {
        sessionStorage.setItem(`hof-draft-${year}`, JSON.stringify(draft));
    } catch {
        /* session storage can be unavailable; Firestore is the saved copy */
    }
    return draft;
}

function playersForYear(year) {
    const yearGames = games.filter((game) => Number(game.year) === year);
    return players.map((player) => ({
        ...player,
        ...calculateSeasonStats(player.id, yearGames, pointValues)
    }));
}

function playerMap() {
    const map = {};
    players.forEach((player) => { map[player.id] = player; });
    return map;
}

function creativeCatalog(year) {
    const admin = adminOf(year);
    if (admin.voteStatus === 'open') {
        const token = tokens.find((item) => item.year === year && item.generation === admin.generation && Array.isArray(item.creativeAwards));
        if (token) return normalizeCreative(token.creativeAwards);
    }
    if (role !== 'admin') return creativeFromPublic(seasonOf(year).publicResults);
    return normalizeCreative(picksFor(year).creativeAwards);
}

function creativeFromPublic(results) {
    if (!results || typeof results !== 'object') return [];
    return Object.keys(results)
        .filter((id) => /^creative(?:[1-9]|1[0-2])$/.test(id))
        .sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)))
        .map((id) => {
            const raw = results[id];
            return {
                id,
                title: raw && !Array.isArray(raw) && raw.title ? String(raw.title) : 'Creative award',
                kind: 'creative',
                nominees: []
            };
        });
}

function fieldAwards() {
    return VOTE_AWARDS.map((award) => ({ ...award, kind: 'field' }));
}

function aggregate(year) {
    const admin = adminOf(year);
    const relevant = tokens.filter((token) => token.year === year && token.generation === admin.generation);
    const awards = [...fieldAwards(), ...creativeCatalog(year)];
    const tally = {};
    const names = {};
    const detail = {};
    awards.forEach((award) => {
        tally[award.id] = {};
        detail[award.id] = {};
    });

    relevant.forEach((token) => {
        awards.forEach((award) => {
            (token.nominees?.[award.id] || []).forEach((nominee) => {
                if (!nominee?.id) return;
                if (!Object.prototype.hasOwnProperty.call(tally[award.id], nominee.id)) {
                    tally[award.id][nominee.id] = 0;
                }
                names[nominee.id] = nominee;
                detail[award.id][nominee.id] = nominee;
            });
        });
        if (!token.used || !token.votes) return;
        awards.forEach((award) => {
            const choice = token.votes[award.id];
            if (choice && Object.prototype.hasOwnProperty.call(tally[award.id], choice)) {
                tally[award.id][choice] += 1;
            }
        });
    });

    return {
        tally,
        names,
        detail,
        awards,
        ballots: relevant.filter((token) => token.used).length,
        links: relevant.slice().sort((a, b) => (a.voterName || '').localeCompare(b.voterName || ''))
    };
}

function decoratePerson(id, names, votes) {
    const snap = names[id] || {};
    const live = playerMap()[id] || (typeof snap.playerId === 'string' ? playerMap()[snap.playerId] : undefined);
    const firstName = live?.firstName || snap.firstName || '';
    const lastName = live?.lastName || snap.lastName || '';
    return {
        id,
        firstName,
        lastName,
        name: live?.name || snap.name || `${firstName} ${lastName}`.trim() || 'Player',
        headshotLink: live?.headshotLink || snap.headshot || '',
        votes
    };
}

function nomineeRows(awardId, agg) {
    const counts = agg.tally[awardId] || {};
    return Object.entries(counts)
        .map(([id, count]) => {
            const snap = agg.detail?.[awardId]?.[id] || agg.names[id] || {};
            const person = decoratePerson(id, { [id]: snap }, count);
            person.description = snap.description || '';
            const partner = partnerFrom(snap.partner);
            if (partner) {
                person.partner = partner;
                if (typeof snap.playerId === 'string' && snap.playerId) person.playerId = snap.playerId;
            }
            person.votes = count;
            return person;
        })
        .sort((a, b) => b.votes - a.votes || nomineeLabel(a).localeCompare(nomineeLabel(b)));
}

function liveLeaders(agg) {
    const leaders = {};
    (agg.awards || fieldAwards()).forEach((award) => {
        const rows = nomineeRows(award.id, agg);
        const max = rows.reduce((best, row) => Math.max(best, row.votes), 0);
        leaders[award.id] = max > 0 ? rows.filter((row) => row.votes === max) : [];
    });
    return leaders;
}

function publicShape(agg) {
    const results = {};
    (agg.awards || []).forEach((award) => {
        const rows = nomineeRows(award.id, agg);
        if (!rows.length && award.kind !== 'creative') return;
        if (award.kind !== 'creative' && !rows.some((row) => row.votes > 0)) return;
        results[award.id] = {
            title: award.title,
            kind: award.kind || 'field',
            nominees: rows.map((person) => {
                const packed = {
                    id: person.id,
                    name: person.name,
                    firstName: person.firstName || '',
                    lastName: person.lastName || '',
                    headshot: person.headshotLink || '',
                    votes: person.votes,
                    description: person.description || ''
                };
                if (person.partner) {
                    packed.playerId = person.playerId || '';
                    packed.partner = {
                        id: person.partner.id,
                        name: person.partner.name,
                        firstName: person.partner.firstName || '',
                        lastName: person.partner.lastName || '',
                        headshot: person.partner.headshotLink || ''
                    };
                }
                return packed;
            })
        };
    });
    return results;
}

function unpackReport(raw) {
    if (Array.isArray(raw)) {
        const nominees = raw.map((person) => decoratePerson(person.id, { [person.id]: person }, null));
        return { nominees, winners: nominees };
    }
    if (!raw || !Array.isArray(raw.nominees)) return null;
    const nominees = raw.nominees.map((person) => {
        const packed = decoratePerson(person.id, { [person.id]: person }, person.votes);
        packed.description = person.description || '';
        const partner = partnerFrom(person.partner);
        if (partner) packed.partner = partner;
        packed.votes = Number.isFinite(Number(person.votes)) ? Number(person.votes) : null;
        return packed;
    });
    const counted = nominees.filter((person) => person.votes !== null);
    const max = counted.reduce((best, person) => Math.max(best, person.votes), 0);
    const winners = max > 0 ? nominees.filter((person) => person.votes === max) : (counted.length ? [] : nominees);
    return { nominees, winners };
}

function signature(results) {
    const normalized = {};
    const source = results && typeof results === 'object' ? results : {};
    Object.keys(source).sort().forEach((awardId) => {
        const raw = source[awardId];
        if (Array.isArray(raw)) {
            normalized[awardId] = raw.map((person) => person.id).sort();
            return;
        }
        const rows = raw && Array.isArray(raw.nominees) ? raw.nominees : [];
        normalized[awardId] = rows.map((person) => `${person.id}:${person.votes}`).sort();
    });
    return JSON.stringify(normalized);
}

function isRevealed(year, awardId) {
    const saved = seasonOf(year).revealedAwards;
    return Array.isArray(saved) && saved.includes(awardId);
}

function render() {
    if (!canRender()) return;
    const years = yearsToShow();
    if (!years.includes(selectedYear)) selectedYear = years[0] || CURRENT_YEAR;
    const html = years.length ? renderYear(selectedYear, years) : '<p class="no-data">No seasons yet</p>';
    if (html === lastHtml) return;
    const scrollY = window.scrollY;
    root().innerHTML = html;
    lastHtml = html;
    window.scrollTo(0, scrollY);
    armReveal();
}

function renderYear(year, years) {
    const open = yearOpen;
    const roster = playersForYear(year);
    const season = seasonOf(year);
    const admin = adminOf(year);
    const isAdmin = role === 'admin';
    const agg = isAdmin ? aggregate(year) : null;
    const leaders = agg ? liveLeaders(agg) : {};
    const options = years.map((value) => {
        const label = value === CURRENT_YEAR ? 'Current season' : String(value);
        return `<option value="${value}"${value === year ? ' selected' : ''}>${label}</option>`;
    }).join('');

    return `<section class="hof-year${open ? ' is-open' : ''}">
        <div class="hof-year-bar">
            <span class="hof-year-num">${year}</span>
            <label class="hof-season-label">
                <select class="hof-season-select" aria-label="Choose season">${options}</select>
            </label>
            <button type="button" class="hof-collapse" data-action="toggle-year" data-year="${year}" aria-expanded="${open ? 'true' : 'false'}" aria-label="${open ? 'Collapse season' : 'Expand season'}">
                <span class="hof-chevron" aria-hidden="true"></span>
            </button>
        </div>
        <div class="hof-year-body">
            <section class="hof-block">
                <div class="hof-section-bar">
                    <span class="hof-section-mark">${sectionMark('stat', `stat${year}`)}</span>
                    <h2>Stat awards</h2>
                    ${isAdmin ? `<div class="admin-only hof-bar-status">${statApproval(year, season.statsPublished)}</div>` : ''}
                </div>
                <div class="hof-grid hof-grid-stats">
                    ${STAT_AWARDS.map((award) => renderStatCard(year, award, roster, season.statsPublished, isAdmin)).join('')}
                </div>
            </section>
            <section class="hof-block">
                <div class="hof-section-bar hof-section-bar-voted">
                    <span class="hof-section-mark">${sectionMark('voted', `voted${year}`)}</span>
                    <h2>Voted awards</h2>
                    ${isAdmin ? `<div class="admin-only hof-bar-status">${voteVisibilityNote(season.votesPublished)}</div>` : ''}
                </div>
                <h3 class="hof-vote-kind">Voted on field awards</h3>
                <div class="hof-grid hof-grid-votes">
                    ${fieldAwards().map((award) => renderVoteCard(year, award, season, leaders, isAdmin)).join('')}
                </div>
                ${renderCreativeBlock(year, season, leaders, isAdmin)}
            </section>
            ${renderClosingVideo(year, season, isAdmin)}
            ${isAdmin ? renderAdmin(year, roster, season, admin, agg, leaders) : ''}
        </div>
    </section>`;
}

function statApproval(year, published) {
    const button = published
        ? `<button type="button" class="hof-btn hof-btn-quiet" data-action="hide-stats" data-year="${year}">Hide stat awards</button>`
        : `<button type="button" class="hof-btn hof-btn-gold" data-action="show-stats" data-year="${year}">Show stat awards</button>`;
    return `<p class="hof-visibility${published ? ' is-live' : ''}">${published
        ? 'Players can see the stat awards. Totals keep updating as games are added.'
        : 'Players still see “To be Announced” for the stat awards.'}</p>
        ${button}`;
}

function savedClosingVideo(season) {
    return typeof season.closingVideo === 'string' ? season.closingVideo.trim() : '';
}

function renderClosingVideo(year, season, isAdmin) {
    const saved = savedClosingVideo(season);
    const revealed = season.videoRevealed === true;
    if (!isAdmin && !(saved && revealed)) return '';
    const draft = Object.prototype.hasOwnProperty.call(videoDrafts, String(year)) ? videoDrafts[String(year)] : saved;
    const savedNote = savedVideoYear === year;
    const player = saved && revealed ? closingPlayer(saved) : '';
    const reveal = isAdmin && saved && !revealed
        ? `<div class="hof-video-reveal"><button type="button" class="hof-reveal-btn" data-action="reveal-video" data-year="${year}">Reveal</button></div>`
        : '';
    const form = isAdmin ? `<div class="admin-only"><div class="hof-close-form">
        <label class="hof-close-label" for="hofVideo${year}">Video link</label>
        <input id="hofVideo${year}" class="hof-close-input" type="url" inputmode="url" placeholder="https://..." data-action="video-link" data-year="${year}" value="${esc(draft)}">
        <button type="button" class="hof-btn hof-btn-primary${savedNote ? ' is-saved' : ''}" data-action="save-video" data-year="${year}">${savedNote ? 'Saved' : 'Save video'}</button>
        ${saved ? `<button type="button" class="hof-btn hof-btn-quiet" data-action="remove-video" data-year="${year}">Remove</button>` : ''}
    </div></div>` : '';
    return `<section class="hof-block hof-close">
        <div class="hof-section-bar">
            <span class="hof-section-mark" aria-hidden="true">${closeMark()}</span>
            <h2>End of year video</h2>
        </div>
        ${player}
        ${isAdmin && saved && revealed ? `<button type="button" class="hof-undo" data-action="undo-video" data-year="${year}">Undo reveal</button>` : ''}
        ${reveal}
        ${form}
    </section>`;
}

function closeMark() {
    return `<svg viewBox="0 0 24 24" class="hof-mark" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="#F3D78A"/>
        <path d="M10 8.2v7.6l6.2-3.8z" fill="#102a56"/>
    </svg>`;
}

function highlightsVideoSrc() {
    return new URL('videos/sweat-squad-end-of-year-highlights.mp4', window.location.href).href;
}

function closingPlayer(raw) {
    const media = videoEmbed(raw);
    const playable = media && (media.kind === 'iframe' || media.kind === 'video')
        ? media
        : { kind: 'video', src: highlightsVideoSrc() };
    if (playable.kind === 'iframe') {
        return `<div class="hof-close-player"><iframe src="${esc(playable.src)}" title="End of year video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    }
    return `<div class="hof-close-player"><video src="${esc(playable.src)}" controls playsinline preload="metadata" title="Sweat Squad End of Year Highlights"></video></div>`;
}

function videoEmbed(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const youtubeId = youtubeVideoId(host, url);
    if (youtubeId) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${youtubeId}` };
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const match = url.pathname.match(/(\d{6,})/);
        if (match) return { kind: 'iframe', src: `https://player.vimeo.com/video/${match[1]}` };
    }
    if (host === 'drive.google.com') {
        const file = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.search.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (file) return { kind: 'iframe', src: `https://drive.google.com/file/d/${file[1]}/preview` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: 'video', src: url.href };
    return { kind: 'link', href: url.href };
}

function youtubeVideoId(host, url) {
    if (!['youtu.be', 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1] || '';
    }
    return /^[\w-]{6,}$/.test(id) ? id : '';
}

function voteVisibilityNote(published) {
    return `<p class="hof-visibility${published ? ' is-live' : ''}">${published
        ? 'Players see an award after you reveal it. The result then stays on the Hall of Fame.'
        : 'Players still see “To be Announced” for the voted awards.'}</p>`;
}

function renderStatCard(year, award, roster, published, isAdmin) {
    const winners = pickStatWinners(roster, award);
    const showWinner = published || isAdmin;
    const body = !showWinner
        ? '<p class="hof-tba">To be Announced</p>'
        : winnerList(winners, (player) => award.format(Number(player[award.statKey]) || 0));
    return cardShell(year, award, body, winners.length === 1 && showWinner);
}

function renderCreativeBlock(year, season, leaders, isAdmin) {
    const awards = creativeCatalog(year);
    if (!awards.length) return '';
    return `<h3 class="hof-vote-kind">Voted creative awards</h3>
        <div class="hof-grid hof-grid-creative">
            ${awards.map((award) => renderVoteCard(year, award, season, leaders, isAdmin)).join('')}
        </div>`;
}

function renderVoteCard(year, award, season, leaders, isAdmin) {
    const published = !!season.votesPublished;
    const report = unpackReport(season.publicResults && season.publicResults[award.id]);
    const publishedWinners = report ? report.winners : [];
    if (published && publishedWinners.length) {
        if (isRevealed(year, award.id)) {
            const undo = isAdmin
                ? `<button type="button" class="hof-undo" data-action="undo-reveal" data-year="${year}" data-award="${esc(award.id)}">Undo reveal</button>`
                : '';
            const body = `<button type="button" class="hof-history-btn" data-action="vote-history" data-year="${year}" data-award="${esc(award.id)}" aria-label="See the votes for ${esc(award.title)}">${winnerList(publishedWinners, null)}</button>${undo}`;
            return cardShell(year, award, body, publishedWinners.length === 1);
        }
        if (isAdmin) {
            const body = `<button type="button" class="hof-reveal-btn" data-action="reveal" data-year="${year}" data-award="${esc(award.id)}">Reveal</button>`;
            return cardShell(year, award, body, false);
        }
        return cardShell(year, award, '<p class="hof-tba">To be Announced</p>', false);
    }
    const people = isAdmin ? (leaders[award.id] || []) : [];
    const body = people.length
        ? winnerList(people, null)
        : '<p class="hof-tba">To be Announced</p>';
    return cardShell(year, award, body, people.length === 1);
}

function placeWord(rank) {
    const mod100 = rank % 100;
    const mod10 = rank % 10;
    const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
    return `${rank}${suffix}`;
}

function placeGroups(nominees) {
    const sorted = nominees.slice().sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0) || nomineeLabel(a).localeCompare(nomineeLabel(b)));
    let lastVotes = null;
    let lastRank = 0;
    const ranked = sorted.map((person, index) => {
        const votes = Number(person.votes) || 0;
        const rank = lastVotes === votes ? lastRank : index + 1;
        lastVotes = votes;
        lastRank = rank;
        return { person, rank };
    });
    const groups = [];
    ranked.forEach((row) => {
        const found = groups.find((group) => group.rank === row.rank);
        if (found) found.people.push(row.person);
        else groups.push({ rank: row.rank, people: [row.person] });
    });
    return groups.reverse();
}

function placeKicker(group) {
    if (group.rank === 1) return group.people.length > 1 ? 'Winners' : 'Winner';
    const word = placeWord(group.rank);
    return group.people.length > 1 ? `Tied for ${word}` : `${word} place`;
}

function nextPlaceLabel(group) {
    if (group.rank === 1) return group.people.length > 1 ? 'Reveal winners' : 'Reveal 1st place';
    const word = placeWord(group.rank);
    return group.people.length > 1 ? `Reveal tied ${word}` : `Reveal ${word} place`;
}

function revealPerson(person, large) {
    return `<div class="${large ? 'hof-reveal-winner' : 'hof-reveal-row'}">
        ${pairPhotos(person, large ? 'is-lg' : '')}
        <div>
            <div class="hof-reveal-name">${esc(nomineeLabel(person))}</div>
            ${person.description ? `<div class="${large ? 'hof-reveal-why' : 'hof-reveal-desc'}">${esc(person.description)}</div>` : ''}
            ${large ? voteLabel(person.votes) : ''}
        </div>
        ${large ? '' : voteLabel(person.votes)}
    </div>`;
}

function ceremonyDialog(award, report) {
    const kindLabel = award.kind === 'creative' ? 'Voted creative awards' : 'Voted on field awards';
    const winnerBlocks = report.winners.map((person) => revealPerson(person, true)).join('');
    const nomineeBlocks = report.nominees.map((person) => {
        const row = revealPerson(person, false);
        return report.winners.some((winner) => winner.id === person.id) ? row.replace('hof-reveal-row', 'hof-reveal-row is-winner') : row;
    }).join('');
    const title = report.winners.length > 1 ? `${award.title} · tie` : award.title;
    return `<div class="hof-reveal" role="dialog" aria-modal="true" aria-labelledby="hofRevealTitle">
            <div class="hof-reveal-stage">
                <div class="hof-spin-glow"></div>
                <div class="hof-spin">${awardArt(award.id, `spin${award.id}`)}</div>
                <p class="hof-roll-label">Drum roll</p>
                <p class="hof-roll-title">${esc(title)}</p>
            </div>
            <div class="hof-reveal-result">
                <p class="hof-reveal-kicker">${esc(kindLabel)}</p>
                <h3 id="hofRevealTitle">${esc(title)}</h3>
                ${winnerBlocks}
                <h4>Nominees</h4>
                <div class="hof-reveal-list">${nomineeBlocks}</div>
                <button type="button" class="hof-btn hof-btn-gold" data-action="close-reveal">Close</button>
            </div>
        </div>`;
}

function countdownShell(award) {
    const kindLabel = award.kind === 'creative' ? 'Voted creative awards' : 'Voted on field awards';
    return `<div class="hof-reveal hof-reveal-countdown" role="dialog" aria-modal="true" aria-labelledby="hofRevealTitle">
            <p class="hof-reveal-kicker">${esc(kindLabel)}</p>
            <h3 id="hofRevealTitle">${esc(award.title)}</h3>
            <p class="hof-spin-caption">First place</p>
            <div class="hof-envelope">
                <div class="hof-envelope-card"></div>
                <div class="hof-envelope-shell" aria-hidden="true">
                    <div class="hof-envelope-flap"></div>
                    <div class="hof-envelope-pocket"></div>
                </div>
            </div>
            <div class="hof-reveal-result"></div>
        </div>`;
}

function confettiHtml() {
    const colors = ['#e2b340', '#f6e3a4', '#1a3d78', '#fff8e4', '#c6a03a', '#8e1d24'];
    const pieces = Array.from({ length: 40 }, (_, index) => {
        const color = colors[index % colors.length];
        const left = (index * 37) % 100;
        const delay = ((index % 8) * 0.08).toFixed(2);
        const duration = (1.7 + (index % 5) * 0.22).toFixed(2);
        const drift = ((index % 7) - 3) * 14;
        return `<i style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${duration}s;--hof-drift:${drift}px"></i>`;
    }).join('');
    return `<div class="hof-confetti" aria-hidden="true">${pieces}</div>`;
}

function showPlace(step) {
    if (!revealOpen || !revealOpen.groups) return;
    const modal = document.querySelector('.hof-reveal-countdown');
    const envelope = modal && modal.querySelector('.hof-envelope');
    const card = envelope && envelope.querySelector('.hof-envelope-card');
    const result = modal && modal.querySelector('.hof-reveal-result');
    const group = revealOpen.groups[step];
    if (!modal || !envelope || !card || !result || !group) return;
    const award = revealOpen.award;
    const next = revealOpen.groups[step + 1];
    const earlier = revealOpen.groups.slice(0, step).reverse();
    const champion = group.rank === 1;
    if (champion && !revealOpen.spun) {
        beginChampionSpin(step);
        return;
    }
    const kicker = placeKicker(group);
    const earlierBlocks = earlier.map((place) => `<div class="hof-called">
        <span class="hof-place-tag">${esc(place.people.length > 1 ? `Tied ${placeWord(place.rank)}` : placeWord(place.rank))}</span>
        <div class="hof-called-people">${place.people.map((person) => revealPerson(person, false)).join('')}</div>
    </div>`).join('');
    const action = next
        ? `<button type="button" class="hof-btn hof-btn-gold hof-reveal-next" data-action="reveal-next">${esc(nextPlaceLabel(next))}</button>`
        : `<button type="button" class="hof-btn hof-btn-gold hof-reveal-next" data-action="close-reveal">Close</button>`;
    card.innerHTML = `<div class="hof-place-spot${champion ? ' is-champion' : ''}">
        ${champion ? `<div class="hof-champion-art">${awardArt(award.id, `champ${award.id}${step}`)}</div>` : ''}
        <p class="hof-place-kicker">${esc(kicker)}</p>
        ${group.people.map((person) => revealPerson(person, true)).join('')}
    </div>`;
    result.innerHTML = `${action}${earlierBlocks ? `<h4>Already called</h4><div class="hof-reveal-list">${earlierBlocks}</div>` : ''}`;
    envelope.classList.remove('is-open');
    void envelope.offsetWidth;
    envelope.classList.add('is-open');
    modal.classList.add('is-live');
    modal.classList.remove('is-settled');
    if (!champion) modal.classList.remove('is-champion');
    const burst = modal.querySelector('.hof-confetti');
    if (burst) burst.remove();
    revealOpen.step = step;
    revealOpen.placed = true;
    revealOpen.rolling = true;
    try {
        playPaper();
    } catch (error) {
        console.error(error);
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
        if (!revealOpen || !modal.isConnected) return;
        revealOpen.rolling = false;
        modal.classList.add('is-settled');
        if (!champion) return;
        modal.classList.add('is-champion');
        modal.insertAdjacentHTML('afterbegin', confettiHtml());
        try {
            playChampion();
        } catch (error) {
            console.error(error);
        }
        publishReveal();
    }, reduced ? 0 : 1100);
}

function beginChampionSpin(step) {
    const modal = document.querySelector('.hof-reveal-countdown');
    const envelope = modal && modal.querySelector('.hof-envelope');
    const card = envelope && envelope.querySelector('.hof-envelope-card');
    if (!modal || !envelope || !card || !revealOpen) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
        revealOpen.spun = true;
        showPlace(step);
        return;
    }
    card.innerHTML = '';
    envelope.classList.remove('is-open');
    envelope.classList.add('is-spinning');
    modal.classList.add('is-whirling', 'is-live');
    modal.classList.remove('is-settled', 'is-champion');
    const burst = modal.querySelector('.hof-confetti');
    if (burst) burst.remove();
    revealOpen.rolling = true;
    revealOpen.placed = true;
    try {
        playWhirl();
    } catch (error) {
        console.error(error);
    }
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
        if (!revealOpen || !modal.isConnected) return;
        envelope.classList.remove('is-spinning');
        modal.classList.remove('is-whirling');
        revealOpen.spun = true;
        revealOpen.rolling = false;
        showPlace(step);
    }, 2200);
}

function advanceReveal() {
    if (!revealOpen || revealOpen.history || !revealOpen.placed || revealOpen.rolling) return;
    const next = revealOpen.step + 1;
    if (!revealOpen.groups || next >= revealOpen.groups.length) return;
    showPlace(next);
}

function openCeremony(year, awardId) {
    if (role !== 'admin' || isRevealed(year, awardId)) return;
    const season = seasonOf(year);
    const award = [...fieldAwards(), ...creativeCatalog(year)].find((item) => item.id === awardId);
    const report = unpackReport(season.publicResults && season.publicResults[awardId]);
    if (!award || !report || !report.winners.length) return;
    const groups = placeGroups(report.nominees);
    if (!groups.length) return;
    dismissCeremony(false);
    const overlay = document.createElement('div');
    overlay.className = 'hof-reveal-back';
    overlay.innerHTML = countdownShell(award);
    document.body.appendChild(overlay);
    revealOpen = { year, awardId, award, started: performance.now(), saved: false, groups, step: -1, placed: false };
    overlay.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="reveal-next"]')) {
            event.preventDefault();
            advanceReveal();
            return;
        }
        if (!revealOpen || performance.now() - revealOpen.started < 900) return;
        const dialog = event.target.closest('.hof-reveal');
        if (dialog && !event.target.closest('[data-action="close-reveal"]')) return;
        dismissCeremony(true);
    });
    lastHtml = '';
    render();
}

function dismissCeremony(renderAfter) {
    window.clearTimeout(revealTimer);
    stopRevealAudio();
    revealOpen = null;
    document.querySelectorAll('.hof-reveal-back').forEach((node) => node.remove());
    if (!renderAfter) return;
    lastHtml = '';
    render();
}

function openVoteHistory(year, awardId) {
    if (!isRevealed(year, awardId)) return;
    const season = seasonOf(year);
    const award = [...fieldAwards(), ...creativeCatalog(year)].find((item) => item.id === awardId);
    const report = unpackReport(season.publicResults && season.publicResults[awardId]);
    if (!award || !report || !report.nominees.length) return;
    dismissCeremony(false);
    const overlay = document.createElement('div');
    overlay.className = 'hof-reveal-back';
    overlay.innerHTML = ceremonyDialog(award, report);
    document.body.appendChild(overlay);
    const modal = overlay.querySelector('.hof-reveal');
    if (modal) modal.classList.add('is-live');
    revealOpen = { year, awardId, started: performance.now(), saved: true, history: true };
    overlay.addEventListener('click', (event) => {
        const dialog = event.target.closest('.hof-reveal');
        if (dialog && !event.target.closest('[data-action="close-reveal"]')) return;
        dismissCeremony(false);
    });
}

function armReveal() {
    if (!revealOpen || revealOpen.history || revealOpen.placed) return;
    const modal = document.querySelector('.hof-reveal-countdown');
    if (!modal) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = reduced ? 0 : 40;
    window.clearTimeout(revealTimer);
    const show = () => {
        if (modal.isConnected) showPlace(0);
    };
    if (wait === 0) show();
    else revealTimer = window.setTimeout(show, wait);
}

function openVideoCeremony(year) {
    if (role !== 'admin' || seasonOf(year).videoRevealed === true) return;
    if (!savedClosingVideo(seasonOf(year))) return;
    dismissCeremony(false);
    const overlay = document.createElement('div');
    overlay.className = 'hof-reveal-back';
    overlay.innerHTML = `<div class="hof-reveal is-matchnight" role="dialog" aria-modal="true" aria-labelledby="hofVideoRevealTitle">
        <div class="hof-reveal-stage hof-match">
            <div class="hof-sky" aria-hidden="true"><span class="hof-light"></span><span class="hof-light"></span></div>
            <div class="hof-stands" aria-hidden="true"></div>
            <div class="hof-pitch">
                <div class="hof-goal" aria-hidden="true"><span></span><span></span><span></span></div>
                ${footballMark('a')}${footballMark('b')}${footballMark('c')}
            </div>
            <div class="hof-match-trophy">${awardArt('mvp', 'matchTrophy')}</div>
            <p class="hof-roll-label">Full time</p>
            <p class="hof-roll-title">End of year video</p>
        </div>
        <div class="hof-reveal-result">
            ${confettiHtml()}
            <div class="hof-champion-art">${awardArt('mvp', 'liveTrophy')}</div>
            <p class="hof-reveal-kicker">Sweat Squad</p>
            <h3 id="hofVideoRevealTitle">The highlights are live</h3>
            <p class="hof-reveal-why">End of year video</p>
            <button type="button" class="hof-btn hof-btn-gold" data-action="close-reveal">Close</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    revealOpen = { year, awardId: 'closingVideo', kind: 'video', started: performance.now(), saved: false, placed: true };
    overlay.addEventListener('click', (event) => {
        if (!revealOpen || performance.now() - revealOpen.started < 900) return;
        const dialog = event.target.closest('.hof-reveal');
        if (dialog && !event.target.closest('[data-action="close-reveal"]')) return;
        dismissCeremony(true);
    });
    try {
        playMatchNight();
    } catch (error) {
        console.error(error);
        stopRevealAudio();
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
        const modal = overlay.querySelector('.hof-reveal');
        if (!modal || !modal.isConnected || !revealOpen || revealOpen.kind !== 'video') return;
        modal.classList.add('is-live', 'is-champion');
        try {
            playChampion();
        } catch (error) {
            console.error(error);
        }
        publishReveal();
    }, reduced ? 0 : 2600);
}

async function publishVideoReveal() {
    const { year } = revealOpen;
    const key = String(year);
    seasons[key] = { ...(seasons[key] || { year }), videoRevealed: true };
    lastHtml = '';
    render();
    try {
        await writeSeason(year, { videoRevealed: true });
    } catch (error) {
        console.error(error);
        if (seasons[key]) seasons[key] = { ...seasons[key], videoRevealed: false };
        if (revealOpen && revealOpen.kind === 'video') revealOpen.saved = false;
        lastHtml = '';
        render();
        alert('The presentation finished, but the video did not go live. Close this and click Reveal again.');
    }
}

async function undoAwardReveal(year, awardId) {
    if (role !== 'admin') return;
    const key = String(year);
    const current = seasons[key] || { year };
    const existing = Array.isArray(current.revealedAwards) ? current.revealedAwards : [];
    const previous = existing.slice();
    seasons[key] = { ...current, revealedAwards: existing.filter((id) => id !== awardId) };
    lastHtml = '';
    render();
    try {
        await writeSeason(year, { revealedAwards: arrayRemove(awardId) });
    } catch (error) {
        console.error(error);
        if (seasons[key]) seasons[key] = { ...seasons[key], revealedAwards: previous };
        lastHtml = '';
        render();
        alert('That reveal could not be undone. Please try again.');
    }
}

async function undoVideoReveal(year) {
    if (role !== 'admin') return;
    const key = String(year);
    const current = seasons[key] || { year };
    seasons[key] = { ...current, videoRevealed: false };
    lastHtml = '';
    render();
    try {
        await writeSeason(year, { videoRevealed: false });
    } catch (error) {
        console.error(error);
        if (seasons[key]) seasons[key] = { ...seasons[key], videoRevealed: true };
        lastHtml = '';
        render();
        alert('That reveal could not be undone. Please try again.');
    }
}

async function publishReveal() {
    if (!revealOpen || revealOpen.saved || role !== 'admin') return;
    revealOpen.saved = true;
    if (revealOpen.kind === 'video') return publishVideoReveal();
    const { year, awardId } = revealOpen;
    const key = String(year);
    const current = seasons[key] || { year };
    const existing = Array.isArray(current.revealedAwards) ? current.revealedAwards : [];
    if (!existing.includes(awardId)) {
        seasons[key] = { ...current, revealedAwards: [...existing, awardId] };
        lastHtml = '';
        render();
    }
    try {
        await writeSeason(year, { revealedAwards: arrayUnion(awardId) });
    } catch (error) {
        console.error(error);
        const latest = seasons[key];
        if (latest && Array.isArray(latest.revealedAwards)) {
            seasons[key] = { ...latest, revealedAwards: latest.revealedAwards.filter((id) => id !== awardId) };
        }
        if (revealOpen && revealOpen.awardId === awardId) revealOpen.saved = false;
        lastHtml = '';
        render();
        alert('The presentation finished, but the result did not go live. Close this and click Reveal again.');
    }
}

function footballMark(which) {
    return `<span class="hof-ball hof-ball-${which}" aria-hidden="true"><svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="#f7f9fc" stroke="#14284b" stroke-width="3"/>
        <path d="M32 12l9 7-3 10H26l-3-10z" fill="#14284b"/>
        <path d="M14 27l8 3 4 9-9 6-8-7zM50 27l-8 3-4 9 9 6 8-7zM22 50l10 6 10-6-3-9H25z" fill="none" stroke="#14284b" stroke-width="2.4"/>
    </svg></span>`;
}

function playMatchNight() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopRevealAudio();
    const ctx = new AudioCtx();
    revealAudio = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const begin = ctx.currentTime + 0.04;
    const notes = [262, 330, 392, 523, 392, 523, 659, 784];
    notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = begin + index * 0.28;
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.09, at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.44);
    });
    window.setTimeout(() => {
        if (revealAudio === ctx) stopRevealAudio();
    }, 2800);
}

function playChampion() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopRevealAudio();
    const ctx = new AudioCtx();
    revealAudio = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime + 0.02;
    [523, 659, 784, 1046].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = now + index * 0.11;
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.34);
    });
    cymbalHit(ctx, now + 0.36);
    window.setTimeout(() => {
        if (revealAudio === ctx) stopRevealAudio();
    }, 1800);
}

function playWhirl() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopRevealAudio();
    const ctx = new AudioCtx();
    revealAudio = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const begin = ctx.currentTime + 0.03;
    let at = 0;
    let gap = 0.28;
    let note = 0;
    const tones = [392, 440, 494, 523, 587, 659, 784];
    while (at < 2.05) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = begin + at;
        osc.type = 'triangle';
        osc.frequency.value = tones[note % tones.length];
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + Math.min(0.22, gap));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
        at += gap;
        gap = Math.max(0.07, gap * 0.78);
        note += 1;
    }
    window.setTimeout(() => {
        if (revealAudio === ctx) stopRevealAudio();
    }, 2300);
}

function playPaper() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopRevealAudio();
    const ctx = new AudioCtx();
    revealAudio = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime + 0.02;
    const frames = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * Math.sin((i / frames) * Math.PI);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.3);
    window.setTimeout(() => {
        if (revealAudio === ctx) stopRevealAudio();
    }, 700);
}

function playDrumRoll() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopRevealAudio();
    const ctx = new AudioCtx();
    revealAudio = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const begin = ctx.currentTime + 0.03;
    let at = 0;
    let gap = 0.13;
    while (at < 2.05) {
        drumHit(ctx, begin + at, 0.28 + (at / 2.05) * 0.55);
        at += gap;
        gap = Math.max(0.042, gap * 0.88);
    }
    drumHit(ctx, begin + 2.12, 0.9);
    cymbalHit(ctx, begin + 2.16);
    window.setTimeout(() => {
        if (revealAudio === ctx) stopRevealAudio();
    }, 3400);
}

function drumHit(ctx, time, amount) {
    const frames = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(amount * 0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.09);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, time);
    body.frequency.exponentialRampToValueAtTime(70, time + 0.05);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(amount * 0.22, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(time);
    body.stop(time + 0.07);
}

function cymbalHit(ctx, time) {
    const frames = Math.floor(ctx.sampleRate * 0.7);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.7);
}

function stopRevealAudio() {
    if (!revealAudio) return;
    const ctx = revealAudio;
    revealAudio = null;
    ctx.close().catch(() => {});
}

function voteLabel(votes) {
    if (votes === null || votes === undefined || !Number.isFinite(Number(votes))) return '';
    const count = Number(votes);
    return `<div class="hof-reveal-votes">${count} vote${count === 1 ? '' : 's'}</div>`;
}

function cardShell(year, award, body, solo) {
    const tba = body.includes('hof-tba');
    return `<article class="hof-card${solo ? ' is-solo' : ''}${tba ? ' is-tba' : ''}">
        <h3>${esc(award.title)}</h3>
        <div class="hof-card-art"><div class="hof-laurels">${laurelMark(`y${year}${award.id}`)}${awardArt(award.id, `y${year}${award.id}`)}</div></div>
        ${award.blurb ? `<p class="hof-sub">${esc(award.blurb)}</p>` : ''}
        <div class="hof-card-foot">${body}</div>
    </article>`;
}

function winnerList(people, statFor) {
    if (!people.length) return '<p class="hof-empty">Not decided yet</p>';
    return `<div class="hof-winners">${people.map((person) => {
        const stat = statFor ? statFor(person) : '';
        const why = person.description ? `<div class="hof-winner-why">${esc(person.description)}</div>` : '';
        return `<div class="hof-winner${person.partner ? ' is-pair' : ''}">
            ${pairPhotos(person)}
            <div class="hof-winner-text">
                <div class="hof-winner-name">${esc(nomineeLabel(person))}</div>
                ${why}
                ${stat ? `<div class="hof-winner-stat">${esc(stat)}</div>` : ''}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderAdmin(year, roster, season, admin, agg, leaders) {
    const votingOpen = admin.voteStatus === 'open';
    const published = !!season.votesPublished;
    const stale = published && signature(season.publicResults) !== signature(publicShape(agg));
    const opened = formatOpened(admin.openedAt);

    return `<div class="admin-only"><div class="hof-admin">
        <div>
            <h3>Player vote</h3>
            ${votingOpen ? renderOpenPoll(year, agg, published, stale, opened) : renderSetup(year, roster)}
        </div>
    </div></div>`;
}

function renderSetup(year, roster) {
    const picks = picksFor(year);
    const needsPlayers = roster.length < NOMINEE_COUNT;
    const saved = savedNoteYear === year;
    const creative = picks.creativeAwards || [];
    return `<p class="hof-help">Voted on field awards use 4 players each. Voted creative awards are categories you name, with 4 descriptions and a player for each one. Add a second player only when you want a pair, such as Best Rivalry. Save keeps this if you leave the page. A private link is created only for players with ${MIN_VOTER_GAMES} or more games this year, and it expires after they submit.</p>
        ${needsPlayers ? '<p class="hof-help">Add at least 4 players before opening a vote.</p>' : ''}
        <h4 class="hof-setup-kind">Voted on field awards</h4>
        <div class="hof-picks">
            ${VOTE_AWARDS.map((award) => pickRow(year, award, roster, picks[award.id] || NOMINEE_SLOTS.map(() => ''))).join('')}
        </div>
        <h4 class="hof-setup-kind">Voted creative awards</h4>
        <div class="hof-creatives">
            ${creative.map((award, index) => creativeEditor(year, award, index, roster)).join('') || '<p class="hof-help">No creative categories yet.</p>'}
        </div>
        <div class="hof-actions">
            <button type="button" class="hof-btn hof-btn-quiet" data-action="add-creative" data-year="${year}" ${creative.length >= CREATIVE_LIMIT ? 'disabled' : ''}>Add category</button>
            <button type="button" class="hof-btn hof-btn-primary${saved ? ' is-saved' : ''}" data-action="save-draft" data-year="${year}">${saved ? 'Saved' : 'Save'}</button>
            <button type="button" class="hof-btn hof-btn-gold" data-action="open-voting" data-year="${year}" ${needsPlayers ? 'disabled' : ''}>Open Voting</button>
        </div>`;
}

function creativeEditor(year, award, index, roster) {
    return `<div class="hof-creative" data-year="${year}" data-index="${index}">
        <div class="hof-creative-head">
            <input type="text" maxlength="80" placeholder="Category, for example Biggest Upset" data-creative-title data-year="${year}" value="${esc(award.title)}" aria-label="Creative category ${index + 1}">
            <button type="button" class="hof-btn hof-btn-quiet" data-action="remove-creative" data-year="${year}" data-index="${index}">Remove</button>
        </div>
        ${NOMINEE_SLOTS.map((slot) => {
            const row = award.nominees[slot] || blankCreativeNominee();
            return `<div class="hof-creative-row">
                <input type="text" maxlength="160" placeholder="Description" data-creative-desc data-year="${year}" data-slot="${slot}" value="${esc(row.description)}" aria-label="Description ${slot + 1}">
                <select data-creative-player data-year="${year}" data-slot="${slot}" aria-label="Player ${slot + 1}">
                    <option value="">Select player</option>
                    ${roster.map((player) => `<option value="${esc(player.id)}"${row.playerId === player.id ? ' selected' : ''}>${esc(player.name)}</option>`).join('')}
                    ${row.playerId && !roster.some((player) => player.id === row.playerId) ? `<option value="${esc(row.playerId)}" selected>Removed player</option>` : ''}
                </select>
                <select data-creative-partner data-year="${year}" data-slot="${slot}" aria-label="Optional second player ${slot + 1}">
                    <option value="">2nd player (optional)</option>
                    ${roster.map((player) => `<option value="${esc(player.id)}"${row.playerId2 === player.id ? ' selected' : ''}>${esc(player.name)}</option>`).join('')}
                    ${row.playerId2 && !roster.some((player) => player.id === row.playerId2) ? `<option value="${esc(row.playerId2)}" selected>Removed player</option>` : ''}
                </select>
            </div>`;
        }).join('')}
        </div>`;
}

function pickRow(year, award, roster, selected) {
    return `<div class="hof-pick">
        <div class="hof-pick-title">${awardArt(award.id, `pick${year}${award.id}`)}<span>${esc(award.title)}</span></div>
        ${NOMINEE_SLOTS.map((slot) => `<select data-year="${year}" data-award="${award.id}" data-slot="${slot}" aria-label="${esc(award.title)} nominee ${slot + 1}">
            <option value="">Select player</option>
            ${roster.map((player) => `<option value="${esc(player.id)}"${selected[slot] === player.id ? ' selected' : ''}>${esc(player.name)}</option>`).join('')}
            ${selected[slot] && !roster.some((player) => player.id === selected[slot]) ? `<option value="${esc(selected[slot])}" selected>Removed player</option>` : ''}
        </select>`).join('')}
    </div>`;
}

function renderOpenPoll(year, agg, published, stale, opened) {
    const awards = agg.awards || fieldAwards();
    const maxVotes = Math.max(1, ...awards.flatMap((award) => Object.values(agg.tally[award.id] || {})));
    return `<p class="hof-help">Voting is open${opened ? ` · opened ${esc(opened)}` : ''}. ${agg.ballots} of ${agg.links.length} ballots submitted. Totals below do not show who voted for whom. Send each player only their own link.</p>
        ${stale ? '<p class="hof-visibility">New votes have come in since the Hall of Fame was updated.</p>' : ''}
        <div class="hof-actions">
            <button type="button" class="hof-btn hof-btn-primary" data-action="copy-all" data-year="${year}">Copy all links</button>
            ${!published ? `<button type="button" class="hof-btn hof-btn-gold" data-action="publish-votes" data-year="${year}">Show vote winners to players</button>` : ''}
            ${published && stale ? `<button type="button" class="hof-btn hof-btn-gold" data-action="publish-votes" data-year="${year}">Update vote winners</button>` : ''}
            ${published ? `<button type="button" class="hof-btn hof-btn-quiet" data-action="hide-votes" data-year="${year}">Hide vote winners</button>` : ''}
            <button type="button" class="hof-btn hof-btn-danger" data-action="delete-poll" data-year="${year}">Delete voting poll</button>
        </div>
        <div class="hof-tally-grid">
            ${awards.map((award) => renderTally(award, agg, maxVotes)).join('')}
        </div>
        <h3 class="hof-links-title">Player links</h3>
        <div class="hof-links">
            ${agg.links.map((token) => {
                const url = ballotUrl(token.id);
                return `<div class="hof-link-row">
                    <strong>${esc(token.voterName || 'Player')}</strong>
                    <code>${esc(url)}</code>
                    <button type="button" class="hof-btn hof-btn-quiet" data-action="copy-link" data-url="${esc(url)}">Copy</button>
                </div>`;
            }).join('') || '<p class="hof-help">No links yet.</p>'}
        </div>`;
}

function renderTally(award, agg, maxVotes) {
    const rows = nomineeRows(award.id, agg);
    const top = rows.reduce((best, row) => Math.max(best, row.votes), 0);
    const kind = award.kind === 'creative' ? 'Creative' : 'On field';
    return `<div class="hof-tally-card">
        <h4>${esc(award.title)}</h4>
        <p class="hof-tally-kind">${kind}</p>
        ${rows.map((row) => `<div class="hof-bar${row.votes > 0 && row.votes === top ? ' is-leader' : ''}">
            <div>
                <span>${esc(nomineeLabel(row))}</span>
                ${row.description ? `<em class="hof-bar-desc">${esc(row.description)}</em>` : ''}
                <div class="hof-bar-track"><div class="hof-bar-fill" style="width:${Math.round((row.votes / maxVotes) * 100)}%"></div></div>
            </div>
            <strong>${row.votes}</strong>
        </div>`).join('') || '<p class="hof-help">No nominees.</p>'}
    </div>`;
}

function formatOpened(value) {
    if (!value) return '';
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ballotUrl(token) {
    const url = new URL('vote.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('t', token);
    return url.href;
}

function onDraftChange(event) {
    const seasonSelect = event.target.closest('select.hof-season-select');
    if (seasonSelect) {
        selectedYear = Number(seasonSelect.value) || CURRENT_YEAR;
        yearOpen = true;
        lastHtml = '';
        render();
        return;
    }
    const creativeSelect = event.target.closest('select[data-creative-player], select[data-creative-partner]');
    if (creativeSelect) {
        syncCreativeFromDom(creativeSelect.dataset.year);
        return;
    }
    const select = event.target.closest('select[data-award]');
    if (!select) return;
    const year = select.dataset.year;
    const draft = picksFor(year);
    if (!Array.isArray(draft[select.dataset.award])) draft[select.dataset.award] = NOMINEE_SLOTS.map(() => '');
    draft[select.dataset.award][Number(select.dataset.slot)] = select.value;
    rememberDraft(year, draft);
    if (savedNoteYear === Number(year)) {
        savedNoteYear = null;
        const button = root().querySelector(`button[data-action="save-draft"][data-year="${year}"]`);
        if (button) {
            button.textContent = 'Save';
            button.classList.remove('is-saved');
        }
    }
}

function onVideoInput(event) {
    if (event.target.closest('[data-creative-title], [data-creative-desc]')) {
        syncCreativeFromDom(event.target.dataset.year);
        return;
    }
    const input = event.target.closest('input[data-action="video-link"]');
    if (!input) return;
    const year = Number(input.dataset.year);
    videoDrafts[String(year)] = input.value;
    if (savedVideoYear !== year) return;
    savedVideoYear = null;
    const button = root().querySelector(`button[data-action="save-video"][data-year="${year}"]`);
    if (button) {
        button.textContent = 'Save video';
        button.classList.remove('is-saved');
    }
}

async function onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const year = Number(button.dataset.year);

    if (action === 'toggle-year') {
        yearOpen = !yearOpen;
        lastHtml = '';
        render();
        return;
    }
    if (action === 'reveal') {
        event.preventDefault();
        openCeremony(Number(button.dataset.year) || selectedYear, button.dataset.award);
        return;
    }
    if (action === 'reveal-video') {
        event.preventDefault();
        openVideoCeremony(Number(button.dataset.year) || selectedYear);
        return;
    }
    if (action === 'undo-reveal') {
        event.preventDefault();
        const awardId = button.dataset.award;
        const awardYear = Number(button.dataset.year) || selectedYear;
        const award = [...fieldAwards(), ...creativeCatalog(awardYear)].find((item) => item.id === awardId);
        const title = award ? award.title : 'this award';
        if (!confirm(`Undo the ${title} reveal? Players will see To be Announced until you reveal it again.`)) return;
        await undoAwardReveal(awardYear, awardId);
        return;
    }
    if (action === 'undo-video') {
        event.preventDefault();
        const videoYear = Number(button.dataset.year) || selectedYear;
        if (!confirm('Undo the end of year video reveal? It leaves the site until you reveal it again.')) return;
        await undoVideoReveal(videoYear);
        return;
    }
    if (action === 'vote-history') {
        event.preventDefault();
        openVoteHistory(Number(button.dataset.year) || selectedYear, button.dataset.award);
        return;
    }
    if (action === 'close-reveal') {
        if (event.target.closest('.hof-reveal') && !event.target.closest('button[data-action="close-reveal"]')) return;
        dismissCeremony(true);
        return;
    }
    if (action === 'add-creative') {
        const picks = picksFor(year);
        picks.creativeAwards = readCreative(year);
        if (picks.creativeAwards.length >= CREATIVE_LIMIT) return;
        picks.creativeAwards.push({
            title: '',
            nominees: NOMINEE_SLOTS.map(() => blankCreativeNominee())
        });
        rememberDraft(year, picks);
        lastHtml = '';
        render();
        return;
    }
    if (action === 'remove-creative') {
        const picks = picksFor(year);
        const next = readCreative(year);
        next.splice(Number(button.dataset.index), 1);
        picks.creativeAwards = next;
        rememberDraft(year, picks);
        lastHtml = '';
        render();
        return;
    }
    if (action === 'copy-link') {
        await copyText(button.dataset.url || '', button);
        return;
    }
    if (action === 'copy-all') {
        const text = aggregate(year).links.map((token) => `${token.voterName || 'Player'}\n${ballotUrl(token.id)}`).join('\n\n');
        await copyText(text, button);
        return;
    }
    if (busy) return;

    if (action === 'save-draft') {
        await saveDraft(year);
    } else if (action === 'show-stats') {
        if (!confirm(`Show the ${year} stat awards on the Hall of Fame? Players will see the current leaders, and those names stay up to date as more games are added.`)) return;
        await run(() => writeSeason(year, { year, statsPublished: true }));
    } else if (action === 'hide-stats') {
        if (!confirm(`Hide the ${year} stat awards? Players will see To be Announced again.`)) return;
        await run(() => writeSeason(year, { statsPublished: false }));
    } else if (action === 'open-voting') {
        await openVoting(year);
    } else if (action === 'publish-votes') {
        await publishVotes(year);
    } else if (action === 'hide-votes') {
        if (!confirm(`Hide the ${year} voted awards? The ballots stay saved, and the cards go back to To be Announced.`)) return;
        await run(() => writeSeason(year, { votesPublished: false, publicResults: deleteField(), revealedAwards: deleteField() }));
    } else if (action === 'delete-poll') {
        if (!confirm(`Delete the entire ${year} voting poll? Every link will stop working and all votes will be erased. You can fix the shortlist and open voting again.`)) return;
        await run(() => deletePoll(year));
    } else if (action === 'save-video') {
        await saveClosingVideo(year);
    } else if (action === 'remove-video') {
        if (!confirm(`Remove the ${year} end of year video?`)) return;
        delete videoDrafts[String(year)];
        await run(() => writeSeason(year, { closingVideo: deleteField(), videoRevealed: deleteField() }));
    }
}

async function run(task) {
    busy = true;
    try {
        await task();
    } catch (error) {
        console.error(error);
        alert(error?.message || 'Something went wrong. Please try again.');
    } finally {
        busy = false;
    }
}

function readCreative(year) {
    const blocks = [...root().querySelectorAll(`.hof-creative[data-year="${year}"]`)];
    if (!blocks.length) return normalizeCreative(picksFor(year).creativeAwards);
    return normalizeCreative(blocks.map((block) => ({
        title: block.querySelector('[data-creative-title]')?.value || '',
        nominees: NOMINEE_SLOTS.map((slot) => ({
            description: block.querySelector(`[data-creative-desc][data-slot="${slot}"]`)?.value || '',
            playerId: block.querySelector(`[data-creative-player][data-slot="${slot}"]`)?.value || '',
            playerId2: block.querySelector(`[data-creative-partner][data-slot="${slot}"]`)?.value || ''
        }))
    })));
}

function syncCreativeFromDom(year) {
    const picks = picksFor(year);
    picks.creativeAwards = readCreative(year);
    rememberDraft(year, picks);
    if (savedNoteYear === Number(year)) {
        savedNoteYear = null;
        const button = root().querySelector(`button[data-action="save-draft"][data-year="${year}"]`);
        if (button) {
            button.textContent = 'Save';
            button.classList.remove('is-saved');
        }
    }
}

async function saveDraft(year) {
    const picks = picksFor(year);
    Object.assign(picks, readPicks(year));
    picks.creativeAwards = readCreative(year);
    rememberDraft(year, picks);
    await run(async () => {
        const batch = writeBatch(db);
        batch.set(doc(db, 'hofAdmin', String(year)), {
            nomineeDraft: {
                ...picks,
                bestMidfielder: deleteField(),
                bestDefendingMidfielder: deleteField(),
                youngPlayer: deleteField()
            }
        }, { merge: true });
        await batch.commit();
        savedNoteYear = year;
        lastHtml = '';
        render();
        window.clearTimeout(savedTimer);
        savedTimer = window.setTimeout(() => {
            if (savedNoteYear !== year) return;
            savedNoteYear = null;
            lastHtml = '';
            render();
        }, 1800);
    });
}

async function saveClosingVideo(year) {
    const input = root().querySelector(`input[data-action="video-link"][data-year="${year}"]`);
    const raw = (input ? input.value : videoDrafts[String(year)] || '').trim();
    if (!raw) {
        alert('Paste the video link first.');
        return;
    }
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        alert('That link is not a valid web address.');
        return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        alert('Use a link that starts with https://');
        return;
    }
    await run(async () => {
        await writeSeason(year, { year, closingVideo: parsed.href });
        delete videoDrafts[String(year)];
        savedVideoYear = year;
        lastHtml = '';
        render();
        window.clearTimeout(savedVideoTimer);
        savedVideoTimer = window.setTimeout(() => {
            if (savedVideoYear !== year) return;
            savedVideoYear = null;
            lastHtml = '';
            render();
        }, 1800);
    });
}

async function writeSeason(year, data) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'hofSeasons', String(year)), data, { merge: true });
    await batch.commit();
}

function readPicks(year) {
    const picks = {};
    VOTE_AWARD_IDS.forEach((awardId) => {
        picks[awardId] = NOMINEE_SLOTS.map((slot) => {
            const select = root().querySelector(`select[data-year="${year}"][data-award="${awardId}"][data-slot="${slot}"]`);
            return select ? select.value : '';
        });
    });
    return picks;
}

async function openVoting(year) {
    const admin = adminOf(year);
    if (admin.voteStatus === 'open') {
        alert('Voting is already open. Delete the poll first if you need a new set of links.');
        return;
    }
    const picks = picksFor(year);
    Object.assign(picks, readPicks(year));
    picks.creativeAwards = readCreative(year);
    const roster = playersForYear(year);
    const byId = {};
    roster.forEach((player) => { byId[player.id] = player; });

    for (const award of VOTE_AWARDS) {
        const chosen = picks[award.id] || [];
        if (chosen.length !== NOMINEE_COUNT || chosen.some((id) => !id) || new Set(chosen).size !== NOMINEE_COUNT || chosen.some((id) => !byId[id])) {
            alert(`Pick 4 different players for ${award.title}.`);
            return;
        }
    }
    const creative = normalizeCreative(picks.creativeAwards);
    for (const award of creative) {
        if (!award.title.trim()) {
            alert('Name every creative category.');
            return;
        }
        if (award.nominees.some((row) => !row.description.trim())) {
            alert(`Write all 4 descriptions for ${award.title}.`);
            return;
        }
        for (const row of award.nominees) {
            if (!row.playerId || !byId[row.playerId]) {
                alert(`Pick a player for every option in ${award.title}. The second player can stay empty.`);
                return;
            }
            if (!row.playerId2) continue;
            if (row.playerId2 === row.playerId) {
                alert(`The second player has to be a different person in ${award.title}.`);
                return;
            }
            if (!byId[row.playerId2]) {
                alert(`Pick a real second player in ${award.title}, or leave that box empty.`);
                return;
            }
        }
        const optionIds = award.nominees.map((row) => creativeOptionId(row));
        if (new Set(optionIds).size !== NOMINEE_COUNT) {
            alert(`Each option in ${award.title} needs a different player or pair.`);
            return;
        }
    }
    const voters = roster.filter((player) => (player.games || 0) >= MIN_VOTER_GAMES);
    if (!voters.length) {
        alert(`Nobody has ${MIN_VOTER_GAMES} or more games in ${year}, so there is nobody to send a voting link to.`);
        return;
    }
    const creativeNote = creative.length ? ` ${creative.length} creative categor${creative.length === 1 ? 'y' : 'ies'} will be on the ballot too.` : '';
    if (!confirm(`Open voting for ${year}? A private link will be created for the ${voters.length} player${voters.length === 1 ? '' : 's'} with ${MIN_VOTER_GAMES} or more games. Players with fewer games do not get a link. Each link stops working after that player submits one choice for every award.${creativeNote}`)) return;

    await run(async () => {
        await deleteTokens(year);
        const generation = (admin.generation || 0) + 1;
        const nominees = {};
        const nomineeIds = {};
        VOTE_AWARDS.forEach((award) => {
            nominees[award.id] = picks[award.id].map((id) => ({
                id,
                name: byId[id].name,
                firstName: byId[id].firstName || '',
                lastName: byId[id].lastName || '',
                headshot: byId[id].headshotLink || ''
            }));
            nomineeIds[award.id] = picks[award.id].slice();
        });
        creative.forEach((award) => {
            nominees[award.id] = award.nominees.map((row) => {
                const primary = byId[row.playerId];
                const entry = {
                    id: creativeOptionId(row),
                    playerId: primary.id,
                    name: primary.name,
                    firstName: primary.firstName || '',
                    lastName: primary.lastName || '',
                    headshot: primary.headshotLink || '',
                    description: row.description.trim()
                };
                if (row.playerId2) {
                    const partner = byId[row.playerId2];
                    entry.partner = {
                        id: partner.id,
                        name: partner.name,
                        firstName: partner.firstName || '',
                        lastName: partner.lastName || '',
                        headshot: partner.headshotLink || ''
                    };
                }
                return entry;
            });
            nomineeIds[award.id] = nominees[award.id].map((entry) => entry.id);
        });
        const creativeAwards = creative.map((award) => ({
            id: award.id,
            title: award.title.trim(),
            nominees: nominees[award.id]
        }));

        const tokenDocs = voters.map((player) => ({
            id: newToken(),
            data: {
                year,
                generation,
                playerId: player.id,
                voterName: player.name,
                used: false,
                nomineeIds,
                nominees,
                creativeAwards,
                createdAt: serverTimestamp()
            }
        }));

        const seasonPayload = { year, votesPublished: false, revealedAwards: deleteField() };
        if (seasons[String(year)]) seasonPayload.publicResults = deleteField();
        const adminPayload = {
            voteStatus: 'open',
            generation,
            nomineeDraft: {
                ...picks,
                bestMidfielder: deleteField(),
                bestDefendingMidfielder: deleteField(),
                youngPlayer: deleteField()
            },
            openedAt: serverTimestamp()
        };
        await commitInChunks(tokenDocs, doc(db, 'hofSeasons', String(year)), seasonPayload, doc(db, 'hofAdmin', String(year)), adminPayload);
        rememberDraft(year, picks);
    });
}

async function publishVotes(year) {
    const admin = adminOf(year);
    if (admin.voteStatus !== 'open') {
        alert('Open voting before publishing winners.');
        return;
    }
    const agg = aggregate(year);
    const publicResults = publicShape(agg);
    const withVotes = Object.values(publicResults).some((award) => (award.nominees || []).some((person) => person.votes > 0));
    if (!withVotes) {
        alert('No votes have been cast yet.');
        return;
    }
    const missing = (agg.awards || []).filter((award) => {
        const rows = publicResults[award.id]?.nominees || [];
        return !rows.some((person) => person.votes > 0);
    }).map((award) => award.title);
    const extra = missing.length ? `\n\nThese awards have no votes yet and will stay To be Announced: ${missing.join(', ')}.` : '';
    const season = seasonOf(year);
    const updating = !!season.votesPublished;
    const revealNote = updating ? '' : '\n\nPlayers still see To be Announced. Reveal each award here, and that result goes live for everyone.';
    if (!confirm(`${updating ? `Update the ${year} Hall of Fame to match the latest votes?` : `Show the current ${year} voted awards on the Hall of Fame?`}${revealNote}${extra}`)) return;

    await run(() => writeSeason(year, { year, votesPublished: true, publicResults }));
}

async function deletePoll(year) {
    const admin = adminOf(year);
    await deleteTokens(year);
    const batch = writeBatch(db);
    batch.set(doc(db, 'hofAdmin', String(year)), {
        voteStatus: 'none',
        generation: (admin.generation || 0) + 1,
        openedAt: deleteField()
    }, { merge: true });
    batch.set(doc(db, 'hofSeasons', String(year)), {
        year,
        votesPublished: false,
        publicResults: deleteField(),
        revealedAwards: deleteField()
    }, { merge: true });
    await batch.commit();
}

async function deleteTokens(year) {
    const snap = await getDocs(query(collection(db, 'hofTokens'), where('year', '==', year)));
    const docs = snap.docs;
    for (let index = 0; index < docs.length; index += 400) {
        const batch = writeBatch(db);
        docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
        await batch.commit();
    }
}

async function commitInChunks(tokenDocs, seasonRef, seasonPayload, adminRef, adminPayload) {
    const pending = tokenDocs.slice();
    if (!pending.length) throw new Error('Add players before opening voting.');
    while (pending.length) {
        const batch = writeBatch(db);
        const room = pending.length <= 450;
        const chunk = pending.splice(0, room ? pending.length : 400);
        chunk.forEach((token) => batch.set(doc(db, 'hofTokens', token.id), token.data));
        if (!pending.length) {
            batch.set(seasonRef, seasonPayload, { merge: true });
            batch.set(adminRef, adminPayload, { merge: true });
        }
        await batch.commit();
    }
}

function newToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
        if (button.isConnected) button.textContent = original;
    }, 1600);
}
