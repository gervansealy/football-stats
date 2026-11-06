import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import {
    collection, doc, onSnapshot, getDocs, query, where, writeBatch, serverTimestamp, deleteField
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
    STAT_AWARDS, VOTE_AWARDS, VOTE_AWARD_IDS, normalizePoints, calculateSeasonStats,
    pickStatWinners, esc, awardArt, photoHtml, mountHofBanner, sectionMark, laurelMark
} from './hof-shared.js';

mountHofBanner();

const CURRENT_YEAR = new Date().getFullYear();

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
        draft[awardId] = [0, 1, 2].map((slot) => (typeof value[slot] === 'string' ? value[slot] : ''));
    });
    return draft;
}

function draftScore(raw) {
    if (!raw || typeof raw !== 'object') return 0;
    return VOTE_AWARD_IDS.reduce((sum, awardId) => {
        const list = raw[awardId];
        if (!Array.isArray(list)) return sum;
        return sum + list.filter((value) => typeof value === 'string' && value).length;
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

function aggregate(year) {
    const admin = adminOf(year);
    const relevant = tokens.filter((token) => token.year === year && token.generation === admin.generation);
    const tally = {};
    const names = {};
    VOTE_AWARDS.forEach((award) => { tally[award.id] = {}; });

    relevant.forEach((token) => {
        VOTE_AWARDS.forEach((award) => {
            (token.nominees?.[award.id] || []).forEach((nominee) => {
                if (!Object.prototype.hasOwnProperty.call(tally[award.id], nominee.id)) {
                    tally[award.id][nominee.id] = 0;
                }
                names[nominee.id] = nominee;
            });
        });
        if (!token.used || !token.votes) return;
        VOTE_AWARDS.forEach((award) => {
            const choice = token.votes[award.id];
            if (choice && Object.prototype.hasOwnProperty.call(tally[award.id], choice)) {
                tally[award.id][choice] += 1;
            }
        });
    });

    return {
        tally,
        names,
        ballots: relevant.filter((token) => token.used).length,
        links: relevant.slice().sort((a, b) => (a.voterName || '').localeCompare(b.voterName || ''))
    };
}

function decoratePerson(id, names, votes) {
    const live = playerMap()[id];
    const snap = names[id] || {};
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

function liveLeaders(agg) {
    const leaders = {};
    VOTE_AWARDS.forEach((award) => {
        const counts = agg.tally[award.id] || {};
        const max = Object.values(counts).reduce((best, value) => Math.max(best, value), 0);
        leaders[award.id] = max > 0
            ? Object.entries(counts)
                .filter(([, count]) => count === max)
                .map(([id, count]) => decoratePerson(id, agg.names, count))
                .sort((a, b) => a.name.localeCompare(b.name))
            : [];
    });
    return leaders;
}

function signature(results) {
    const normalized = {};
    VOTE_AWARDS.forEach((award) => {
        const list = (results && results[award.id]) || [];
        normalized[award.id] = list.map((person) => person.id).sort();
    });
    return JSON.stringify(normalized);
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
                <div class="hof-section-bar">
                    <span class="hof-section-mark">${sectionMark('voted', `voted${year}`)}</span>
                    <h2>Voted awards</h2>
                    ${isAdmin ? `<div class="admin-only hof-bar-status">${voteVisibilityNote(season.votesPublished)}</div>` : ''}
                </div>
                <div class="hof-grid hof-grid-votes">
                    ${VOTE_AWARDS.map((award) => renderVoteCard(year, award, season, leaders, isAdmin)).join('')}
                </div>
            </section>
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

function voteVisibilityNote(published) {
    return `<p class="hof-visibility${published ? ' is-live' : ''}">${published
        ? 'Players can see the published vote winners.'
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

function renderVoteCard(year, award, season, leaders, isAdmin) {
    const published = !!season.votesPublished;
    const snapshot = (season.publicResults && season.publicResults[award.id]) || [];
    const people = published
        ? snapshot.map((person) => decoratePerson(person.id, { [person.id]: person }))
        : (isAdmin ? (leaders[award.id] || []) : []);
    const showWinner = people.length > 0 && (published || isAdmin);
    const body = showWinner
        ? winnerList(people, null)
        : '<p class="hof-tba">To be Announced</p>';
    return cardShell(year, award, body, people.length === 1 && showWinner);
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
        return `<div class="hof-winner">
            ${photoHtml(person)}
            <div class="hof-winner-text">
                <div class="hof-winner-name">${esc(person.name)}</div>
                ${stat ? `<div class="hof-winner-stat">${esc(stat)}</div>` : ''}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderAdmin(year, roster, season, admin, agg, leaders) {
    const votingOpen = admin.voteStatus === 'open';
    const published = !!season.votesPublished;
    const stale = published && signature(season.publicResults) !== signature(leaders);
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
    const needsPlayers = roster.length < 3;
    const saved = savedNoteYear === year;
    return `<p class="hof-help">Choose the 3 players on the ballot for each award, then open voting. Save keeps the shortlist if you leave this page. Each player gets a private link that expires after they submit.</p>
        ${needsPlayers ? '<p class="hof-help">Add at least 3 players before opening a vote.</p>' : ''}
        <div class="hof-picks">
            ${VOTE_AWARDS.map((award) => pickRow(year, award, roster, picks[award.id] || ['', '', ''])).join('')}
        </div>
        <div class="hof-actions">
            <button type="button" class="hof-btn hof-btn-primary${saved ? ' is-saved' : ''}" data-action="save-draft" data-year="${year}">${saved ? 'Saved' : 'Save'}</button>
            <button type="button" class="hof-btn hof-btn-gold" data-action="open-voting" data-year="${year}" ${needsPlayers ? 'disabled' : ''}>Open Voting</button>
        </div>`;
}

function pickRow(year, award, roster, selected) {
    return `<div class="hof-pick">
        <div class="hof-pick-title">${awardArt(award.id, `pick${year}${award.id}`)}<span>${esc(award.title)}</span></div>
        ${[0, 1, 2].map((slot) => `<select data-year="${year}" data-award="${award.id}" data-slot="${slot}" aria-label="${esc(award.title)} nominee ${slot + 1}">
            <option value="">Select player</option>
            ${roster.map((player) => `<option value="${esc(player.id)}"${selected[slot] === player.id ? ' selected' : ''}>${esc(player.name)}</option>`).join('')}
            ${selected[slot] && !roster.some((player) => player.id === selected[slot]) ? `<option value="${esc(selected[slot])}" selected>Removed player</option>` : ''}
        </select>`).join('')}
    </div>`;
}

function renderOpenPoll(year, agg, published, stale, opened) {
    const maxVotes = Math.max(1, ...VOTE_AWARDS.flatMap((award) => Object.values(agg.tally[award.id] || {})));
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
            ${VOTE_AWARDS.map((award) => renderTally(award, agg, maxVotes)).join('')}
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
    const counts = agg.tally[award.id] || {};
    const rows = Object.entries(counts)
        .map(([id, count]) => ({ person: decoratePerson(id, agg.names), count }))
        .sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name));
    const top = rows.reduce((best, row) => Math.max(best, row.count), 0);
    return `<div class="hof-tally-card">
        <h4>${esc(award.title)}</h4>
        ${rows.map((row) => `<div class="hof-bar${row.count > 0 && row.count === top ? ' is-leader' : ''}">
            <div>
                <span>${esc(row.person.name)}</span>
                <div class="hof-bar-track"><div class="hof-bar-fill" style="width:${Math.round((row.count / maxVotes) * 100)}%"></div></div>
            </div>
            <strong>${row.count}</strong>
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
    const select = event.target.closest('select[data-award]');
    if (!select) return;
    const year = select.dataset.year;
    const draft = picksFor(year);
    if (!Array.isArray(draft[select.dataset.award])) draft[select.dataset.award] = ['', '', ''];
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
        await run(() => writeSeason(year, { votesPublished: false, publicResults: deleteField() }));
    } else if (action === 'delete-poll') {
        if (!confirm(`Delete the entire ${year} voting poll? Every link will stop working and all votes will be erased. You can fix the shortlist and open voting again.`)) return;
        await run(() => deletePoll(year));
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

async function saveDraft(year) {
    const picks = rememberDraft(year, readPicks(year));
    await run(async () => {
        const batch = writeBatch(db);
        batch.set(doc(db, 'hofAdmin', String(year)), {
            nomineeDraft: {
                ...picks,
                bestMidfielder: deleteField(),
                bestDefendingMidfielder: deleteField()
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

async function writeSeason(year, data) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'hofSeasons', String(year)), data, { merge: true });
    await batch.commit();
}

function readPicks(year) {
    const picks = {};
    VOTE_AWARD_IDS.forEach((awardId) => {
        picks[awardId] = [0, 1, 2].map((slot) => {
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
    const picks = readPicks(year);
    const roster = playersForYear(year);
    const byId = {};
    roster.forEach((player) => { byId[player.id] = player; });

    for (const award of VOTE_AWARDS) {
        const chosen = picks[award.id] || [];
        if (chosen.some((id) => !id) || new Set(chosen).size !== 3 || chosen.some((id) => !byId[id])) {
            alert(`Pick 3 different players for ${award.title}.`);
            return;
        }
    }
    if (!confirm(`Open voting for ${year}? A private link will be created for every player. Each link stops working after that player submits one choice for every award.`)) return;

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

        const tokenDocs = roster.map((player) => ({
            id: newToken(),
            data: {
                year,
                generation,
                playerId: player.id,
                voterName: player.name,
                used: false,
                nomineeIds,
                nominees,
                createdAt: serverTimestamp()
            }
        }));

        const seasonPayload = { year, votesPublished: false };
        if (seasons[String(year)]) seasonPayload.publicResults = deleteField();
        const adminPayload = {
            voteStatus: 'open',
            generation,
            nomineeDraft: {
                ...picks,
                bestMidfielder: deleteField(),
                bestDefendingMidfielder: deleteField()
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
    const leaders = liveLeaders(aggregate(year));
    const publicResults = {};
    const missing = [];
    VOTE_AWARDS.forEach((award) => {
        const winners = leaders[award.id] || [];
        if (!winners.length) {
            missing.push(award.title);
            return;
        }
        publicResults[award.id] = winners.map((person) => ({
            id: person.id,
            name: person.name,
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            headshot: person.headshotLink || ''
        }));
    });
    if (!Object.keys(publicResults).length) {
        alert('No votes have been cast yet.');
        return;
    }
    const extra = missing.length ? `\n\nThese awards have no votes yet and will stay To be Announced: ${missing.join(', ')}.` : '';
    const season = seasonOf(year);
    const updating = !!season.votesPublished;
    if (!confirm(`${updating ? `Update the ${year} Hall of Fame to match the latest votes?` : `Show the current ${year} vote winners on the Hall of Fame?`}${extra}`)) return;

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
        publicResults: deleteField()
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
