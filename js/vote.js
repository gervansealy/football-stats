import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { VOTE_AWARDS, NOMINEE_COUNT, esc, awardArt, photoHtml, personName, mountHofBanner } from './hof-shared.js';

mountHofBanner();

const ballot = document.getElementById('ballot');
const bar = document.getElementById('voteBar');
const progress = document.getElementById('voteProgress');
const submitBtn = document.getElementById('submitVotes');
const picks = {};
let tokenId = '';
let tokenData = null;
let finished = false;

const slowTimer = setTimeout(() => {
    if (!finished) {
        showMessage('Still loading', 'This is taking a while. If you opened the link from WhatsApp, use Open in Safari or Chrome and try again.');
    }
}, 15000);

boot();

async function boot() {
    tokenId = new URLSearchParams(window.location.search).get('t') || '';
    if (!/^[a-f0-9]{32}$/.test(tokenId)) {
        showMessage('Link not valid', 'This voting link is missing or incomplete. Ask the admin for a new one.');
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'hofTokens', tokenId));
        if (!snap.exists()) {
            showMessage('Link not valid', 'This link does not exist, or the poll was deleted. Ask the admin for a new link.');
            return;
        }
        tokenData = snap.data();
        if (tokenData.used) {
            showMessage('Ballot already in', 'This link has expired. Each player can submit one vote for each award, and then the link stops working.');
            return;
        }
        if (!ballotReady(tokenData)) {
            showMessage('Ballot unavailable', 'This ballot is incomplete. Ask the admin to delete the poll and send a new link.');
            return;
        }
        renderBallot();
    } catch (error) {
        console.error(error);
        showMessage('Can’t open this ballot', 'Check your connection and open the link again. If it still fails, ask the admin for a new link.');
    }
}

function creativeAwards(data) {
    return Array.isArray(data?.creativeAwards) ? data.creativeAwards : [];
}

function ballotAwards(data) {
    return [
        ...VOTE_AWARDS.map((award) => ({ ...award, kind: 'field' })),
        ...creativeAwards(data).map((award) => ({ id: award.id, title: award.title, kind: 'creative' }))
    ];
}

function ballotReady(data) {
    const onField = VOTE_AWARDS.every((award) => Array.isArray(data.nominees?.[award.id]) && data.nominees[award.id].length === NOMINEE_COUNT);
    const creative = creativeAwards(data).every((award) => Array.isArray(data.nominees?.[award.id]) && data.nominees[award.id].length === NOMINEE_COUNT);
    return onField && creative;
}

function choiceLabel(nominee) {
    if (!nominee?.partner) return personName(nominee);
    return `${personName(nominee)} & ${personName(nominee.partner)}`;
}

function choicePhotos(nominee) {
    if (!nominee?.partner) return photoHtml(nominee, 'is-lg');
    return `<span class="vote-pair">${photoHtml(nominee, 'is-lg')}${photoHtml(nominee.partner, 'is-lg')}</span>`;
}

function choiceButton(award, nominee) {
    const description = nominee.description ? `<span class="vote-desc">${esc(nominee.description)}</span>` : '';
    return `<button type="button" class="vote-choice${nominee.partner ? ' is-pair' : ''}" data-award="${esc(award.id)}" data-player="${esc(nominee.id)}">
        ${choicePhotos(nominee)}
        ${description}
        <span class="vote-player">${esc(choiceLabel(nominee))}</span>
    </button>`;
}

function awardSection(award, year) {
    return `<section class="vote-award">
        <div class="vote-award-head">
            ${awardArt(award.id, `vote${award.id}`)}
            <div>
                <h2>${esc(award.title)}</h2>
                <p>${esc(year)} Hall of Fame</p>
            </div>
        </div>
        <div class="vote-choices">
            ${(tokenData.nominees[award.id] || []).map((nominee) => choiceButton(award, nominee)).join('')}
        </div>
    </section>`;
}

function renderBallot() {
    finished = true;
    clearTimeout(slowTimer);
    const year = tokenData.year || '';
    const awards = ballotAwards(tokenData);
    const field = awards.filter((award) => award.kind !== 'creative');
    const creative = awards.filter((award) => award.kind === 'creative');
    ballot.innerHTML = `
        <p class="vote-hello">Hi ${esc(tokenData.voterName || 'there')}. Pick one for each award. You can submit once.</p>
        <h2 class="vote-group-title">Voted on field awards</h2>
        ${field.map((award) => awardSection(award, year)).join('')}
        ${creative.length ? `<h2 class="vote-group-title">Voted creative awards</h2>${creative.map((award) => awardSection(award, year)).join('')}` : ''}`;
    bar.hidden = false;
    updateProgress();
}

ballot.addEventListener('click', (event) => {
    const choice = event.target.closest('.vote-choice');
    if (!choice || finished === 'done') return;
    const awardId = choice.dataset.award;
    picks[awardId] = choice.dataset.player;
    ballot.querySelectorAll(`.vote-choice[data-award="${awardId}"]`).forEach((button) => {
        button.classList.toggle('is-selected', button === choice);
        button.setAttribute('aria-pressed', button === choice ? 'true' : 'false');
    });
    updateProgress();
});

submitBtn.addEventListener('click', submitBallot);

function updateProgress() {
    const awards = ballotAwards(tokenData || {});
    const count = awards.filter((award) => picks[award.id]).length;
    progress.textContent = `${count} of ${awards.length} awards picked`;
    submitBtn.disabled = count !== awards.length;
}

async function submitBallot() {
    const awards = ballotAwards(tokenData || {});
    const votes = {};
    for (const award of awards) {
        const choice = picks[award.id];
        const allowed = (tokenData.nomineeIds?.[award.id] || tokenData.nominees[award.id].map((nominee) => nominee.id));
        if (!choice || !allowed.includes(choice)) {
            alert(`Pick one for ${award.title}.`);
            return;
        }
        votes[award.id] = choice;
    }
    if (!confirm('Submit your votes? This link expires as soon as you submit, and you cannot change your picks.')) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    try {
        await updateDoc(doc(db, 'hofTokens', tokenId), {
            used: true,
            votes
        });
        finished = 'done';
        bar.hidden = true;
        showMessage('Votes submitted', 'Thank you. Your ballot is in, and this link has now expired.');
    } catch (error) {
        console.error(error);
        submitBtn.textContent = 'Submit votes';
        updateProgress();
        const denied = error?.code === 'permission-denied';
        alert(denied
            ? 'This link has already been used, or the poll was reset. Ask the admin if you still need to vote.'
            : 'Your votes were not saved. Check your connection and try again.');
    }
}

function showMessage(title, text) {
    finished = finished || true;
    clearTimeout(slowTimer);
    bar.hidden = true;
    ballot.innerHTML = `<div class="vote-message"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
}
