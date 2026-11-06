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

function ballotReady(data) {
    return VOTE_AWARDS.every((award) => Array.isArray(data.nominees?.[award.id]) && data.nominees[award.id].length === NOMINEE_COUNT);
}

function renderBallot() {
    finished = true;
    clearTimeout(slowTimer);
    const year = tokenData.year || '';
    ballot.innerHTML = `
        <p class="vote-hello">Hi ${esc(tokenData.voterName || 'there')}. Pick one player for each award. You can submit once.</p>
        ${VOTE_AWARDS.map((award) => `
            <section class="vote-award">
                <div class="vote-award-head">
                    ${awardArt(award.id, `vote${award.id}`)}
                    <div>
                        <h2>${esc(award.title)}</h2>
                        <p>${esc(year)} Hall of Fame</p>
                    </div>
                </div>
                <div class="vote-choices">
                    ${tokenData.nominees[award.id].map((nominee) => `
                        <button type="button" class="vote-choice" data-award="${esc(award.id)}" data-player="${esc(nominee.id)}">
                            ${photoHtml(nominee, 'is-lg')}
                            <span>${esc(personName(nominee))}</span>
                        </button>
                    `).join('')}
                </div>
            </section>
        `).join('')}`;
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
    const count = VOTE_AWARDS.filter((award) => picks[award.id]).length;
    progress.textContent = `${count} of ${VOTE_AWARDS.length} awards picked`;
    submitBtn.disabled = count !== VOTE_AWARDS.length;
}

async function submitBallot() {
    const votes = {};
    for (const award of VOTE_AWARDS) {
        const choice = picks[award.id];
        const allowed = (tokenData.nomineeIds?.[award.id] || tokenData.nominees[award.id].map((nominee) => nominee.id));
        if (!choice || !allowed.includes(choice)) {
            alert(`Pick one player for ${award.title}.`);
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
