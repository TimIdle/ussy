'use strict';

const APP_VERSION = 'Ussy v1.4';

// Zones are IANA names, never fixed offsets: Amsterdam and London switch for daylight saving.
const MEMBERS = [
	{ id: 'tim', name: 'Tim_Idle', place: 'Malaysia', code: 'MY', zone: 'Asia/Kuala_Lumpur' },
	{ id: 'mayseph', name: 'Mayseph', place: 'Netherlands', code: 'NL', zone: 'Europe/Amsterdam' },
	{ id: 'folio', name: 'Folio', place: 'Netherlands', code: 'NL', zone: 'Europe/Amsterdam' },
	{ id: 'vitamin', name: 'Vitamin', place: 'United Kingdom', code: 'UK', zone: 'Europe/London' }
];

const MEMBER_IDS = MEMBERS.map(m => m.id);

// The countries the club streams from, for "where to watch". TMDB writes the UK as GB.
const CLUB_REGIONS = Array.from(new Set(MEMBERS.map(m => m.code))).map(code => ({
	label: code,
	tmdb: code === 'UK' ? 'GB' : code
}));

// What each member thought of something the club watched. No dates, no stars, just a word.
const WORDS = [
	{ id: 'LOVED', label: 'Loved it', art: 'face_loved' },
	{ id: 'LIKED', label: 'Liked it', art: 'face_liked' },
	{ id: 'AIGHT', label: 'It aight', art: 'face_aight' },
	{ id: 'NOT_FOR_ME', label: 'Not for me', art: 'face_nope' }
];

// The comfort questions, asked one at a time, like the first "Is it safe for Mayseph?" page.
// hard: a Yes means NSFM and ends the check. parent: a follow-up, only asked when the parent is Yes.
// hints: which metadata hints can suggest a Yes for this question (never answer it).
const QUESTIONS = [
	{
		id: 'trailer',
		text: 'Does the trailer give Mayseph bad vibes?',
		hard: true,
		help: 'Watch it first. If it gives her the heebie-jeebies, say yes.'
	},
	{
		id: 'scare',
		text: 'Does it contain jumpscares?',
		hints: ['scare'],
		help: 'Not sure? Check a parents guide before deciding.'
	},
	{
		id: 'scareMany',
		text: 'Are the jumpscares frequent or intense?',
		parent: 'scare',
		hard: true,
		help: 'One or two mild ones is a no. Several, or loud ones, is a yes.'
	},
	{
		id: 'gore',
		text: 'Is there visible gore or full nudity?',
		hints: ['gore'],
		hard: true,
		help: 'Exposed organs, or full nudity on screen.'
	},
	{
		id: 'blood',
		text: 'Is there realistic blood?',
		hints: ['blood'],
		help: 'Cartoon or stylised blood counts as no.'
	},
	{
		id: 'bloodMany',
		text: 'Is it a lot of blood or heavy splatter?',
		parent: 'blood',
		hard: true,
		help: 'Drips and small amounts count as no.'
	},
	{
		id: 'nudity',
		text: 'Is there partial nudity or sexual content?',
		hints: ['nude'],
		help: 'Anything short of full nudity on screen.'
	},
	{
		id: 'violence',
		text: 'Is there gratuitous violence or heavy swearing?',
		hints: ['viol', 'lang'],
		help: 'Gratuitous means it is there for shock, not for the story.'
	},
	{
		id: 'dark',
		text: 'Is it horror, stressful or nightmare-inducing?',
		hints: ['dark'],
		help: 'Go by the tone, not just the genre label.'
	}
];

const BASE_QUESTIONS = QUESTIONS.filter(q => !q.parent);
const ANSWER_VALUES = ['YES', 'NO', 'UNKNOWN', 'NOT_APPLICABLE'];
const ANSWER_LABELS = { YES: 'Yes', NO: 'No', UNKNOWN: 'Not sure', NOT_APPLICABLE: "Doesn't apply" };

const HINT_LABELS = {
	scare: 'jumpscares',
	gore: 'gore',
	blood: 'blood',
	nude: 'nudity',
	lang: 'strong language',
	viol: 'violence',
	dark: 'dark themes'
};

// label: what a badge shows. full: what screen readers hear and what sentences spell out.
const RESULT_INFO = {
	COMFORTABLE: { label: 'SFM', full: 'Safe for Mayseph', icon: 'check' },
	DISCUSS_FIRST: { label: 'Discuss first', full: 'Discuss first', icon: 'warn' },
	NOT_SUITABLE: { label: 'NSFM', full: 'Not safe for Mayseph', icon: 'close' },
	INCOMPLETE: { label: 'Incomplete', full: 'Incomplete', icon: 'dots' },
	NOT_ASSESSED: { label: 'Not checked', full: 'Not checked yet', icon: 'question' }
};

const OVERRIDE_RESULTS = ['COMFORTABLE', 'DISCUSS_FIRST', 'NOT_SUITABLE'];
const TYPE_LABELS = { movie: 'Movie', series: 'Series', anime: 'Anime' };
const VOTES_PER_MEMBER = 3;
const WHEEL_COLOURS = ['#F2554A', '#FF8CC6', '#3CCB4B', '#FF8A3D', '#4FB3FF', '#B9A3FF', '#F2CB4E', '#7DD39A'];
const LOOP_COPIES = 5;           // how many copies of the list the endless carousel keeps side by side
const WHERE_MAX_AGE_DAYS = 7;    // streaming catalogues change, so "where to watch" is refreshed weekly

// Title keys say where a title came from: tmdb-movie-346648, tmdb-tv-66732, anilist-154587, custom-k3j9x2f7.
const KEY_PATTERN = /^(tmdb-(movie|tv)-\d{1,10}|anilist-\d{1,10}|custom-[a-z0-9]{6,16})$/;

// Club codes: six groups of four letters and digits, such as k7qm-x2fd-9pwz-r4tn-8hvc-3jby.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_PATTERN = /^[a-z0-9]{4}(-[a-z0-9]{4}){5}$/;



// B. Small helpers

const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Anything that came from outside (titles, synopses, anything a member typed) is escaped before it
// becomes HTML. This is the one place that happens.
function esc(value) {
	return String(value === null || value === undefined ? '' : value).replace(
		/[&<>"']/g,
		ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
	);
}

function icon(name, extra) {
	return '<svg class="ico' + (extra ? ' ' + extra : '') + '" aria-hidden="true"><use href="#icon_' + name + '"/></svg>';
}

function art(name, extra) {
	return '<svg class="art' + (extra ? ' ' + extra : '') + '" aria-hidden="true"><use href="#art_' + name + '"/></svg>';
}

function sticker(memberId, extra) {
	return '<span class="sticker st_' + memberId + (extra ? ' ' + extra : '') + '" aria-hidden="true"></span>';
}

function plural(n, word, many) {
	return n + ' ' + (n === 1 ? word : (many || word + 's'));
}

function joinList(items, last) {
	if (items.length < 2) return items.join('');
	return items.slice(0, -1).join(', ') + ' ' + (last || 'and') + ' ' + items[items.length - 1];
}

function formatMinutes(total) {
	const m = Math.round(total), h = Math.floor(m / 60), r = m % 60;
	if (!h) return r + ' min';
	return h + ' h' + (r ? ' ' + r + ' min' : '');
}

function formatHours(h) {
	return (h % 1 ? h.toFixed(1) : h) + ' h';
}

function clampInt(value, min, max) {
	const n = Math.round(Number(value));
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function memberById(id) {
	return MEMBERS.find(m => m.id === id) || null;
}

function memberName(id) {
	const m = memberById(id);
	return m ? m.name : 'Someone';
}

function hueFor(text) {
	let hash = 0;
	for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) % 360;
	return hash;
}

function normTitle(text) {
	return String(text || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
}

// Same idea as Java's SecureRandom.nextInt(n): the uneven top slice is thrown away, so every
// value is equally likely.
function secureRandomIndex(n) {
	const limit = Math.floor(0x100000000 / n) * n;
	const buffer = new Uint32Array(1);
	do {
		crypto.getRandomValues(buffer);
	} while (buffer[0] >= limit);
	return buffer[0] % n;
}

function randomLetters(count) {
	let out = '';
	for (let i = 0; i < count; i++) out += CODE_ALPHABET[secureRandomIndex(CODE_ALPHABET.length)];
	return out;
}

function makeClubCode() {
	const groups = [];
	for (let i = 0; i < 6; i++) groups.push(randomLetters(4));
	return groups.join('-');
}

// Base64 that is safe inside a link (no + / or =).
function toBase64Url(text) {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	bytes.forEach(b => {
		binary += String.fromCharCode(b);
	});
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
	const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

// Runs tasks with at most `limit` in flight at once, like a small Java ExecutorService.
// JavaScript has one thread, but each task spends most of its time waiting on the network,
// so four "lanes" fetch four titles at the same time.
async function runPool(items, limit, worker) {
	let next = 0;
	const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++; // safe: nothing else runs between reading and bumping it
			await worker(items[index], index);
		}
	});
	await Promise.all(lanes);
}

let toastTimer = 0;

// A short message at the bottom of the screen. memberId puts that member's sticker beside it.
function toast(message, memberId) {
	const el = $('toast');
	el.innerHTML = (memberId ? sticker(memberId) : '') + '<span>' + esc(message) + '</span>';
	el.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

function announce(message) {
	$('focusLive').textContent = message;
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		return false; // no clipboard (an old browser or a blocked frame): the caller shows the text instead
	}
}



// C. What this browser remembers
// Small things only: who is watching here, the music switch, your own TMDB key, and which club
// this browser belongs to. Private windows can refuse storage; then Ussy simply forgets on reload.

const STORAGE = {
	member: 'ussy.member',
	muted: 'ussy.muted',
	tmdbKey: 'ussy.tmdbKey',
	club: 'ussy.club',
	local: 'ussy.local'
};

const Saved = {
	get(key) {
		try {
			return localStorage.getItem(key);
		} catch (error) {
			return null;
		}
	},
	set(key, value) {
		try {
			if (value === null) localStorage.removeItem(key);
			else localStorage.setItem(key, value);
			return true;
		} catch (error) {
			return false;
		}
	},
	getJson(key) {
		try {
			return JSON.parse(this.get(key) || 'null');
		} catch (error) {
			return null;
		}
	},
	setJson(key, value) {
		return this.set(key, value === null ? null : JSON.stringify(value));
	},
	works() {
		try {
			localStorage.setItem('ussy.test', '1');
			localStorage.removeItem('ussy.test');
			return true;
		} catch (error) {
			return false;
		}
	}
};

function savedMember() {
	const id = Saved.get(STORAGE.member);
	return MEMBER_IDS.includes(id) ? id : null;
}

function tmdbKey() {
	return (Saved.get(STORAGE.tmdbKey) || '').trim();
}

// Which club this browser belongs to: { mode: 'firebase', code, config } or { mode: 'local' }.
function savedClub() {
	const c = Saved.getJson(STORAGE.club);
	if (c && c.mode === 'local') return { mode: 'local' };
	if (c && c.mode === 'firebase' && CODE_PATTERN.test(c.code || '') && cleanFirebaseConfig(c.config))
		return { mode: 'firebase', code: c.code, config: cleanFirebaseConfig(c.config) };
	return null;
}



// D. The club's data: kept on this device, or live for everyone through Firebase
// Two stores with the same methods, like two Java classes implementing one interface:
//
//   LocalClub      keeps everything in this browser (localStorage)
//   FirestoreClub  keeps everything in the club's Firebase database, live for all four of
//                  you; it works offline too, and catches up when the connection is back
//
// Both hold the same four "collections", just like the database:
//   titles/{key}    one per title: status (listed, watched, removed), order, addedBy,
//                   progress (episodes the club has seen), historyOrder, words, info
//   votes/{member}  { picks: [up to three title keys] }
//   checks/{id}     one per Safe for Mayseph check: key, by, answers, result, override, at
//   state/club      { tonight: { tim: true, ... }, tieWinner, closed }
//
// Methods (all of them write; reading happens through connect's onChange):
//   connect(onChange, onStatus)  start; onChange(raw) on every change, onStatus(status) when
//                                the connection changes ('local', 'connecting', 'synced',
//                                'saving', 'offline' or 'error')
//   disconnect()
//   putTitle(key, fields)        replace these top-level fields of a title (creates it if new)
//   setWord(key, member, word)   one member's word on a title (null clears it)
//   putVotes(member, picks)
//   addCheck(check)
//   setHere(member, here)        who's here tonight
//   putState(fields)             tieWinner, closed
//   dropVotesFor(key)            a title left the list: its votes go back to the voters
//   dump() / load(dump) / wipe() moving the whole club to a new code or a new home

const COLLECTIONS = ['titles', 'votes', 'checks', 'state'];

function emptyDump() {
	return { titles: {}, votes: {}, checks: {}, state: {} };
}

function isPlainObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The same "merge" Firestore does: nested maps merge, anything else is replaced.
function mergeDeep(target, patch) {
	Object.keys(patch).forEach(k => {
		if (isPlainObject(patch[k]) && isPlainObject(target[k])) mergeDeep(target[k], patch[k]);
		else target[k] = isPlainObject(patch[k]) ? JSON.parse(JSON.stringify(patch[k])) : patch[k];
	});
	return target;
}

class LocalClub {
	constructor() {
		this.kind = 'local';
		this.data = emptyDump();
		this.onStorage = event => {
			// Another tab of Ussy on this browser saved something: show it here too.
			if (event.key === STORAGE.local) {
				this.read();
				this.emit();
			}
		};
	}

	connect(onChange, onStatus) {
		this.onChange = onChange;
		this.read();
		window.addEventListener('storage', this.onStorage);
		onStatus('local');
		this.emit();
	}

	disconnect() {
		window.removeEventListener('storage', this.onStorage);
		this.onChange = null;
	}

	read() {
		const raw = Saved.getJson(STORAGE.local);
		this.data = emptyDump();
		if (isPlainObject(raw)) {
			COLLECTIONS.forEach(name => {
				if (isPlainObject(raw[name])) this.data[name] = raw[name];
			});
		}
	}

	save() {
		Saved.setJson(STORAGE.local, this.data);
		this.emit();
	}

	emit() {
		if (this.onChange) this.onChange(JSON.parse(JSON.stringify(this.data)), { pending: false, fromCache: false });
	}

	putTitle(key, fields) {
		this.data.titles[key] = Object.assign(this.data.titles[key] || {}, JSON.parse(JSON.stringify(fields)));
		this.save();
	}

	setWord(key, member, word) {
		if (!this.data.titles[key]) return;
		mergeDeep(this.data.titles[key], { words: { [member]: word } });
		this.save();
	}

	putVotes(member, picks) {
		this.data.votes[member] = { picks: picks.slice() };
		this.save();
	}

	addCheck(check) {
		this.data.checks['c' + Date.now().toString(36) + randomLetters(6)] = JSON.parse(JSON.stringify(check));
		this.save();
	}

	setHere(member, here) {
		this.data.state.club = mergeDeep(this.data.state.club || {}, { tonight: { [member]: here } });
		this.save();
	}

	putState(fields) {
		this.data.state.club = Object.assign(this.data.state.club || {}, fields);
		this.save();
	}

	dropVotesFor(key) {
		Object.keys(this.data.votes).forEach(member => {
			const picks = (this.data.votes[member] && this.data.votes[member].picks) || [];
			if (picks.includes(key)) this.data.votes[member] = { picks: picks.filter(k => k !== key) };
		});
		this.save();
	}

	dump() {
		return JSON.parse(JSON.stringify(this.data));
	}

	load(dump) {
		COLLECTIONS.forEach(name => Object.assign(this.data[name], dump[name] || {}));
		this.save();
	}

	wipe() {
		this.data = emptyDump();
		this.save();
	}
}

// The Firebase side. FirebaseKit is the Firestore part of Google's Firebase SDK, from
// js/firebase.js (its licence is in LICENCES.txt). Each club code gets one Firebase app for the
// whole visit, kept here, so leaving and coming back never starts a second one.
const firebaseApps = new Map();

class FirestoreClub {
	constructor(config, code) {
		this.kind = 'firebase';
		this.config = config;
		this.code = code;
		this.cache = { titles: new Map(), votes: new Map(), checks: new Map(), state: new Map() };
		this.meta = { titles: null, votes: null, checks: null, state: null };
		this.errors = {};
		this.unsubscribers = [];
		this.emitQueued = false;
		this.cacheKind = 'persistent';
	}

	// Starts the Firebase app and database. Separate from connect(), so a new code can be
	// written to before anyone listens to it (see rotating the code, section X).
	open() {
		if (this.db) return;
		const known = firebaseApps.get(this.code);
		if (known) {
			this.app = known.app;
			this.db = known.db;
			this.cacheKind = known.cacheKind;
			return;
		}
		const F = window.FirebaseKit;
		if (!F) throw new Error('The Firebase part of this page did not load.');
		this.app = F.initializeApp(this.config, 'ussy-' + this.code);
		try {
			this.db = F.initializeFirestore(this.app, {
				ignoreUndefinedProperties: true,
				localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() })
			});
		} catch (error) {
			// No IndexedDB (some private windows): keep working, just without offline saving.
			this.cacheKind = 'memory';
			this.db = F.initializeFirestore(this.app, { ignoreUndefinedProperties: true, localCache: F.memoryLocalCache() });
		}
		firebaseApps.set(this.code, { app: this.app, db: this.db, cacheKind: this.cacheKind });
	}

	connect(onChange, onStatus) {
		this.onChange = onChange;
		this.onStatus = onStatus;
		this.open();
		const F = window.FirebaseKit;
		onStatus('connecting');

		// Firestore gives up on the server for a while after about ten seconds; by then, call it offline.
		this.startedAt = Date.now();
		this.statusTimer = setTimeout(() => this.reportStatus(), 10500);
		this.unsubscribers = COLLECTIONS.map(name =>
			F.onSnapshot(
				F.collection(this.db, 'clubs', this.code, name),
				{ includeMetadataChanges: true },
				snap => this.take(name, snap),
				error => this.fail(name, error)
			)
		);
		this.onOnline = () => this.reportStatus();
		window.addEventListener('online', this.onOnline);
		window.addEventListener('offline', this.onOnline);
	}

	// Stops listening. The database itself stays open for the rest of the visit, so changes made
	// offline still reach the server once the connection is back.
	disconnect() {
		clearTimeout(this.statusTimer);
		this.unsubscribers.forEach(stop => stop());
		this.unsubscribers = [];
		this.onChange = null;
		this.onStatus = null;
		window.removeEventListener('online', this.onOnline);
		window.removeEventListener('offline', this.onOnline);
	}

	take(name, snap) {
		const map = new Map();
		snap.forEach(d => map.set(d.id, d.data()));
		this.cache[name] = map;
		this.meta[name] = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites };
		delete this.errors[name];
		this.reportStatus();
		if (!this.emitQueued) {
			// Four listeners answer at once when the page opens: draw once, not four times.
			this.emitQueued = true;
			setTimeout(() => {
				this.emitQueued = false;
				if (this.onChange) this.onChange(this.dump(), this.summary());
			}, 0);
		}
	}

	fail(name, error) {
		this.errors[name] = error && error.code ? error.code : String(error);
		this.reportStatus();
	}

	summary() {
		const metas = Object.values(this.meta).filter(Boolean);
		return {
			pending: metas.some(m => m.pending),
			fromCache: metas.length < COLLECTIONS.length || metas.some(m => m.fromCache)
		};
	}

	// error: Firebase said no. offline: no answer from the server (changes wait on this device).
	// connecting: just started. saving: changes on their way. synced: all caught up.
	status() {
		if (Object.keys(this.errors).length) return 'error';
		if (!navigator.onLine) return 'offline';
		const s = this.summary();
		if (s.fromCache) return Date.now() - this.startedAt > 10000 ? 'offline' : 'connecting';
		if (s.pending) return 'saving';
		return 'synced';
	}

	errorText() {
		const codes = Object.values(this.errors);
		if (!codes.length) return '';
		if (codes.includes('permission-denied'))
			return 'Firebase said no (permission denied). Check that the security rules from the setup guide are published.';
		if (codes.includes('failed-precondition')) return 'Firebase is not set up yet: create the Firestore database first.';
		return 'Firebase reported: ' + codes[0] + '.';
	}

	reportStatus() {
		if (this.onStatus) this.onStatus(this.status());
	}

	ref(collection, id) {
		return window.FirebaseKit.doc(this.db, 'clubs', this.code, collection, id);
	}

	// Writes go into the local copy at once (so the page updates straight away) and to the server
	// when it can be reached. Waiting for the server would hang offline, so nothing waits here.
	write(promise) {
		promise.catch(error => {
			this.errors.write = error && error.code ? error.code : String(error);
			this.reportStatus();
			reportSyncProblem(this.errorText());
		});
	}

	putTitle(key, fields) {
		this.write(window.FirebaseKit.setDoc(this.ref('titles', key), fields, { mergeFields: Object.keys(fields) }));
	}

	setWord(key, member, word) {
		this.write(window.FirebaseKit.setDoc(this.ref('titles', key), { words: { [member]: word } }, { merge: true }));
	}

	putVotes(member, picks) {
		this.write(window.FirebaseKit.setDoc(this.ref('votes', member), { picks: picks.slice() }));
	}

	addCheck(check) {
		const id = 'c' + Date.now().toString(36) + randomLetters(6);
		this.write(window.FirebaseKit.setDoc(this.ref('checks', id), check));
	}

	setHere(member, here) {
		this.write(window.FirebaseKit.setDoc(this.ref('state', 'club'), { tonight: { [member]: here } }, { merge: true }));
	}

	putState(fields) {
		this.write(window.FirebaseKit.setDoc(this.ref('state', 'club'), fields, { mergeFields: Object.keys(fields) }));
	}

	dropVotesFor(key) {
		const F = window.FirebaseKit;
		this.cache.votes.forEach((doc, member) => {
			if (Array.isArray(doc.picks) && doc.picks.includes(key))
				this.write(F.setDoc(this.ref('votes', member), { picks: F.arrayRemove(key) }, { merge: true }));
		});
	}

	dump() {
		const out = emptyDump();
		COLLECTIONS.forEach(name => {
			this.cache[name].forEach((doc, id) => {
				out[name][id] = doc;
			});
		});
		return out;
	}

	// Writes a whole club's worth of documents, in batches (Firestore takes up to 500 at a time).
	load(dump) {
		this.open();
		const F = window.FirebaseKit;
		let batch = F.writeBatch(this.db);
		let count = 0;
		COLLECTIONS.forEach(name => {
			Object.keys(dump[name] || {}).forEach(id => {
				batch.set(this.ref(name, id), dump[name][id]);
				count++;
				if (count === 450) {
					this.write(batch.commit());
					batch = F.writeBatch(this.db);
					count = 0;
				}
			});
		});
		if (count) this.write(batch.commit());
	}

	// Empties this code's documents and marks it closed, so anyone still on it is told to get the
	// new invite link.
	wipe() {
		const F = window.FirebaseKit;
		let batch = F.writeBatch(this.db);
		let count = 0;
		COLLECTIONS.forEach(name => {
			this.cache[name].forEach((doc, id) => {
				if (name === 'state' && id === 'club') return;
				batch.delete(this.ref(name, id));
				count++;
				if (count === 450) {
					this.write(batch.commit());
					batch = F.writeBatch(this.db);
					count = 0;
				}
			});
		});
		batch.set(this.ref('state', 'club'), { closed: true });
		this.write(batch.commit());
	}
}

// The parts of a Firebase web config that Ussy needs. Everything is checked, because it can
// arrive through a link.
function cleanFirebaseConfig(c) {
	if (!isPlainObject(c)) return null;
	const out = {
		apiKey: String(c.apiKey || ''),
		authDomain: String(c.authDomain || ''),
		projectId: String(c.projectId || ''),
		appId: String(c.appId || '')
	};
	if (!/^[A-Za-z0-9_-]{20,80}$/.test(out.apiKey)) return null;
	if (!/^[a-z0-9][a-z0-9-]{3,40}$/.test(out.projectId)) return null;
	if (!/^[0-9]+:[0-9]+:web:[a-f0-9]+$/.test(out.appId)) return null;
	if (out.authDomain && !/^[a-z0-9.-]+$/.test(out.authDomain)) out.authDomain = '';
	if (!out.authDomain) out.authDomain = out.projectId + '.firebaseapp.com';
	return out;
}

// Reads the config block from the Firebase console, pasted as it is:
//   const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", ... };
function parseFirebaseConfig(text) {
	const found = {};
	const pattern = /["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId)["']?\s*:\s*["']([^"']+)["']/g;
	let match;
	while ((match = pattern.exec(String(text))) !== null) found[match[1]] = match[2].trim();
	return cleanFirebaseConfig(found);
}

// An invite link carries the club code and the Firebase config after a #, which browsers never
// send to any server. Opening it stores both in this browser, then the # part is wiped from the
// address bar.
function inviteLink(code, config) {
	const payload = toBase64Url(JSON.stringify({ v: 1, code, config }));
	const base = location.protocol === 'file:' ? 'https://YOUR-NAME.github.io/ussy/' : location.origin + location.pathname;
	return base + '#join=' + payload;
}

function parseInvite(text) {
	const match = String(text || '').match(/join=([A-Za-z0-9_-]{20,})/);
	if (!match) return null;
	try {
		const data = JSON.parse(fromBase64Url(match[1]));
		const config = cleanFirebaseConfig(data && data.config);
		if (!data || data.v !== 1 || !CODE_PATTERN.test(data.code || '') || !config) return null;
		return { code: data.code, config };
	} catch (error) {
		return null;
	}
}



// E. TMDB and AniList
// TMDB answers with your own key from Settings. AniList needs no key. Every call goes in the
// small log in Settings > Diagnostics: the service, the path and how long it took. Never the key.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGES = 'https://image.tmdb.org/t/p/';
const TMDB_LANGUAGE = 'en-US';
const CERT_REGIONS = ['GB', 'NL', 'MY', 'US'];
const TMDB_GENRES = {
	28: 'Action',
	12: 'Adventure',
	16: 'Animation',
	35: 'Comedy',
	80: 'Crime',
	99: 'Documentary',
	18: 'Drama',
	10751: 'Family',
	14: 'Fantasy',
	36: 'History',
	27: 'Horror',
	10402: 'Music',
	9648: 'Mystery',
	10749: 'Romance',
	878: 'Science Fiction',
	10770: 'TV Movie',
	53: 'Thriller',
	10752: 'War',
	37: 'Western',
	10759: 'Action & Adventure',
	10762: 'Kids',
	10763: 'News',
	10764: 'Reality',
	10765: 'Sci-Fi & Fantasy',
	10766: 'Soap',
	10767: 'Talk',
	10768: 'War & Politics'
};

class ApiError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

const apiLog = [];

function logApi(service, method, path, status, ms) {
	apiLog.unshift({ service, method, path, status, ms: Math.round(ms), at: new Date() });
	if (apiLog.length > 12) apiLog.length = 12;
	if ($('settingsDialog').open) renderDiagnostics();
}

async function tmdb(path, params, signal) {
	const key = tmdbKey();
	if (!key) throw new ApiError(401, 'Add your TMDB key in Settings to search films and TV.');
	const url = new URL(TMDB_BASE + path);
	Object.entries(Object.assign({ language: TMDB_LANGUAGE }, params || {})).forEach(([k, v]) =>
		url.searchParams.set(k, v)
	);

	// The long "API Read Access Token" goes in a header; a short v3 key has to go in the URL.
	const headers = { Accept: 'application/json' };
	if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
	else url.searchParams.set('api_key', key);

	const started = performance.now();
	let response;
	try {
		response = await fetch(url, { headers, signal, referrerPolicy: 'no-referrer' });
	} catch (error) {
		if (error.name === 'AbortError') throw error;
		logApi('TMDB', 'GET', path, 0, performance.now() - started);
		throw new ApiError(0, 'TMDB could not be reached. Check the connection.');
	}
	logApi('TMDB', 'GET', path, response.status, performance.now() - started);
	if (response.status === 401) throw new ApiError(401, 'TMDB turned the key down. Check it in Settings.');
	if (response.status === 429) throw new ApiError(429, 'TMDB asked us to slow down. Try again in a moment.');
	if (!response.ok) throw new ApiError(response.status, 'TMDB answered ' + response.status + '.');
	return response.json();
}

// AniList speaks GraphQL: one POST with a query and its variables.
async function anilist(query, variables, signal, label) {
	const started = performance.now();
	let response;
	try {
		response = await fetch('https://graphql.anilist.co', {
			method: 'POST',
			signal,
			referrerPolicy: 'no-referrer',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		});
	} catch (error) {
		if (error.name === 'AbortError') throw error;
		logApi('AniList', 'POST', label, 0, performance.now() - started);
		throw new ApiError(0, 'AniList could not be reached.');
	}
	logApi('AniList', 'POST', label, response.status, performance.now() - started);
	if (response.status === 429) throw new ApiError(429, 'AniList asked us to slow down for a minute.');
	if (!response.ok) throw new ApiError(response.status, 'AniList answered ' + response.status + '.');
	const json = await response.json();
	if (json.errors && json.errors.length) throw new ApiError(400, 'AniList: ' + json.errors[0].message);
	return json.data;
}

const ANILIST_FIELDS = 'id title { romaji english native } format episodes duration seasonYear startDate { year } ' +
	'genres averageScore popularity coverImage { large } bannerImage isAdult';

async function anilistSearch(query, page, signal) {
	const q = 'query ($search: String, $page: Int) { Page(page: $page, perPage: 8) { pageInfo { hasNextPage } ' +
		'media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { ' + ANILIST_FIELDS + ' } } }';
	const data = await anilist(q, { search: query, page }, signal, 'search');
	return { media: (data.Page.media || []).filter(a => !a.isAdult), hasNext: Boolean(data.Page.pageInfo.hasNextPage) };
}

async function anilistById(id, signal) {
	const q = 'query ($id: Int) { Media(id: $id, type: ANIME) { ' + ANILIST_FIELDS +
		' description(asHtml: false) trailer { id site } tags { name rank isMediaSpoiler } externalLinks { site type } } }';
	const data = await anilist(q, { id }, signal, 'title');
	if (!data.Media) throw new ApiError(404, 'AniList has no title with that id.');
	return data.Media;
}

// A quick look-up of an anime TMDB also knows, for its AniList score. A bonus: it may fail quietly.
async function anilistScoreFor(title, signal) {
	try {
		const q = 'query ($search: String) { Media(search: $search, type: ANIME) { id averageScore popularity title { romaji english } } }';
		const data = await anilist(q, { search: title }, signal, 'match');
		return data.Media || null;
	} catch (error) {
		if (error.name === 'AbortError') throw error;
		return null;
	}
}

// AniList descriptions can hold HTML tags and ~!spoilers!~. Keep plain words only (escaped later).
function cleanAnilistText(text) {
	return String(text || '').replace(/~!.*?!~/gs, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
		.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function anilistImage(url) {
	return /^https:\/\/s\d+\.anilist\.co\/[A-Za-z0-9/._-]+$/.test(url || '') ? url : null;
}

function tmdbPath(path) {
	return /^\/[A-Za-z0-9._-]+$/.test(path || '') ? path : null;
}

// The order the first "Is it safe for Mayseph?" page used: an official trailer, any trailer, a teaser.
function pickTrailer(videos) {
	return videos.find(v => v.type === 'Trailer' && v.official) || videos.find(v => v.type === 'Trailer') ||
		videos.find(v => v.type === 'Teaser') || videos[0] || null;
}

function certificationFor(t, movie) {
	if (movie) {
		const list = (t.release_dates && t.release_dates.results) || [];
		for (const region of CERT_REGIONS) {
			const entry = list.find(x => x.iso_3166_1 === region);
			const dated = entry && entry.release_dates.find(d => d.certification);
			if (dated) return { cert: dated.certification, region };
		}
	} else {
		const list = (t.content_ratings && t.content_ratings.results) || [];
		for (const region of CERT_REGIONS) {
			const entry = list.find(x => x.iso_3166_1 === region && x.rating);
			if (entry) return { cert: entry.rating, region };
		}
	}
	return { cert: '', region: '' };
}

function seasonTagsFor(genres, keywords) {
	const words = keywords.join(' ').toLowerCase();
	const tags = [];
	if (genres.includes('Horror') || /halloween|haunted|ghost|witch|supernatural|vampire|zombie/.test(words))
		tags.push('Halloween');
	if (/christmas|winter|snow/.test(words)) tags.push('Winter');
	if (/summer|beach|vacation/.test(words)) tags.push('Summer');
	if (/autumn|thanksgiving|harvest/.test(words)) tags.push('Autumn');
	if (/spring|cherry blossom/.test(words)) tags.push('Spring');
	return tags;
}

// TMDB's watch/providers block -> stream and rent-or-buy lists for the club's countries.
// TMDB gets this from JustWatch, and JustWatch is credited wherever it shows.
function providerList(entries) {
	const out = [];
	entries.slice().sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0)).forEach(p => {
		if (p.provider_name && !out.some(o => o.name === p.provider_name))
			out.push({ name: String(p.provider_name).slice(0, 60), logo: tmdbPath(p.logo_path) });
	});
	return out.slice(0, 12);
}

function availabilityFromTmdb(t) {
	const results = (t['watch/providers'] && t['watch/providers'].results) || {};
	const regions = {};
	CLUB_REGIONS.forEach(r => {
		const x = results[r.tmdb] || {};
		regions[r.tmdb] = {
			stream: providerList([].concat(x.flatrate || [], x.free || [], x.ads || [])),
			rentBuy: providerList([].concat(x.rent || [], x.buy || [])),
			link: /^https:\/\/www\.themoviedb\.org\/[A-Za-z0-9/?=&._-]+$/.test(x.link || '') ? x.link : null
		};
	});
	return { checkedAt: new Date().toISOString().slice(0, 10), regions };
}

// Comfort-related keywords become hints for the Mayseph check. A hint only suggests a Yes; it
// never answers a question by itself, and it never marks a title unsafe.
const HINT_RULES = [
	{ key: 'scare', pattern: /jump.?scare/ },
	{ key: 'gore', pattern: /gore|gory|splatter|body horror|torture|mutilat|dismember|cannibal|frontal nudity/ },
	{ key: 'blood', pattern: /blood/ },
	{ key: 'nude', pattern: /nudity|nude|topless/ },
	{ key: 'viol', pattern: /gratuitous|erotic|explicit sex|extreme violence|brutal/ },
	{ key: 'lang', pattern: /profanity|swearing|strong language/ },
	{ key: 'dark', pattern: /horror|slasher|haunted|possession|nightmare|demon/ }
];

function hintsFor(info) {
	const words = info.keywords.map(k => k.toLowerCase()).concat(info.genres.map(g => 'genre: ' + g.toLowerCase()));
	const hints = [];
	HINT_RULES.forEach(rule => {
		const hit = words.find(w => rule.pattern.test(w));
		if (hit) hints.push({ key: rule.key, from: hit });
	});
	return hints;
}




// F. Title info: one shape for TMDB, AniList and custom titles
// Every title on the list carries an "info" snapshot, saved with it in the club's data, so
// everyone sees its poster and details, even without a TMDB key of their own:
//   source, type, episodic, title, originalTitle, year, runtime (a film's, or one episode's),
//   intro, credits, seasons, episodes, seasonEpisodes, genres, keywords, seasonTags, cert,
//   certRegion, synopsis, poster and backdrop (TMDB paths), posterUrl and backdropUrl (AniList),
//   hue, ratings, videos, availability, anilistStreams, ids, checkedAt, full
// "full" is false for a search result (the short version) and true once the details are in.

function today() {
	return new Date().toISOString().slice(0, 10);
}

function blankInfo(source) {
	return {
		source,
		type: 'movie',
		episodic: false,
		title: 'Untitled',
		originalTitle: null,
		year: null,
		runtime: 0,
		intro: 0,
		credits: 0,
		seasons: 0,
		episodes: 0,
		seasonEpisodes: [],
		genres: [],
		keywords: [],
		seasonTags: [],
		cert: '',
		certRegion: '',
		synopsis: '',
		poster: null,
		backdrop: null,
		posterUrl: null,
		backdropUrl: null,
		hue: 0,
		ratings: [],
		videos: [],
		availability: null,
		anilistStreams: [],
		ids: { tmdb: null, tmdbType: null, anilist: null },
		checkedAt: today(),
		full: false
	};
}

function youtubeKey(key) {
	return /^[A-Za-z0-9_-]{6,20}$/.test(key || '');
}

// A TMDB answer -> info. Search results only have the basics; details have everything.
function infoFromTmdb(t, tmdbType, full) {
	const movie = tmdbType === 'movie';
	const info = blankInfo('tmdb');
	const genreIds = t.genre_ids || (t.genres || []).map(g => g.id);
	info.genres = t.genres ? t.genres.map(g => String(g.name)) : genreIds.map(id => TMDB_GENRES[id]).filter(Boolean);
	info.type = genreIds.includes(16) && t.original_language === 'ja' ? 'anime' : movie ? 'movie' : 'series';
	info.episodic = !movie;
	info.title = String((movie ? t.title : t.name) || 'Untitled');
	const original = movie ? t.original_title : t.original_name;
	info.originalTitle = original && original !== info.title ? String(original) : null;
	const date = String((movie ? t.release_date : t.first_air_date) || '');
	info.year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
	info.runtime = movie
		? (t.runtime || 0)
		: ((t.episode_run_time && t.episode_run_time[0]) || (t.last_episode_to_air && t.last_episode_to_air.runtime) ||
			(t.next_episode_to_air && t.next_episode_to_air.runtime) || 0);

	// TMDB has no intro or credits lengths, so shows get a guess of a minute and a half each.
	info.intro = movie ? 0 : 1.5;
	info.credits = movie ? 0 : 1.5;
	info.seasons = t.number_of_seasons || 0;
	info.episodes = t.number_of_episodes || 0;
	info.seasonEpisodes = (t.seasons || [])
		.filter(s => s.season_number > 0 && s.episode_count > 0)
		.sort((a, b) => a.season_number - b.season_number)
		.map(s => s.episode_count);
	info.synopsis = String(t.overview || '');
	info.poster = tmdbPath(t.poster_path);
	info.backdrop = tmdbPath(t.backdrop_path);
	info.hue = hueFor(info.title);
	info.ratings = t.vote_count
		? [{
			source: 'TMDB',
			value: Math.round((t.vote_average || 0) * 10) / 10,
			scale: 10,
			note: Number(t.vote_count).toLocaleString('en-GB') + ' votes'
		}]
		: [];
	info.ids = { tmdb: t.id, tmdbType, anilist: null };

	if (full) {
		info.keywords = ((t.keywords && (t.keywords.keywords || t.keywords.results)) || [])
			.map(k => String(k.name)).slice(0, 40);
		const cert = certificationFor(t, movie);
		info.cert = cert.cert;
		info.certRegion = cert.region;
		info.seasonTags = seasonTagsFor(info.genres, info.keywords);
		info.availability = availabilityFromTmdb(t);
		info.videos = ((t.videos && t.videos.results) || [])
			.filter(v => v.site === 'YouTube' && youtubeKey(v.key))
			.slice(0, 12)
			.map(v => ({ key: v.key, type: String(v.type || 'Video'), name: String(v.name || '').slice(0, 120), official: Boolean(v.official) }));
		info.full = true;
	}
	return info;
}

// An AniList answer -> info.
function infoFromAnilist(a, full) {
	const movie = a.format === 'MOVIE';
	const info = blankInfo('anilist');
	info.type = 'anime';
	info.episodic = !movie;
	info.title = String(a.title.english || a.title.romaji || a.title.native || 'Untitled');
	const original = a.title.native || a.title.romaji;
	info.originalTitle = original && original !== info.title ? String(original) : null;
	info.year = a.seasonYear || (a.startDate && a.startDate.year) || null;
	info.runtime = a.duration || 0;
	info.intro = movie ? 0 : 1.5;
	info.credits = movie ? 0 : 1.5;
	info.seasons = movie ? 0 : 1;
	info.episodes = movie ? 0 : (a.episodes || 0);
	info.seasonEpisodes = !movie && a.episodes ? [a.episodes] : [];
	info.genres = (a.genres || []).map(String);
	info.posterUrl = anilistImage(a.coverImage && a.coverImage.large);
	info.backdropUrl = anilistImage(a.bannerImage);
	info.hue = hueFor(info.title);
	info.ratings = a.averageScore
		? [{ source: 'AniList', value: a.averageScore, scale: 100, note: 'on ' + (a.popularity || 0).toLocaleString('en-GB') + ' lists' }]
		: [];
	info.ids = { tmdb: null, tmdbType: null, anilist: a.id };

	if (full) {
		info.keywords = (a.tags || []).filter(t => !t.isMediaSpoiler && t.rank >= 50).map(t => String(t.name)).slice(0, 40);
		info.synopsis = cleanAnilistText(a.description);
		info.seasonTags = seasonTagsFor(info.genres, info.keywords);
		info.anilistStreams = Array.from(new Set((a.externalLinks || [])
			.filter(l => l.type === 'STREAMING').map(l => String(l.site)))).slice(0, 8);
		info.videos = a.trailer && a.trailer.site === 'youtube' && youtubeKey(a.trailer.id)
			? [{ key: a.trailer.id, type: 'Trailer', name: info.title + ' trailer', official: true }]
			: [];
		info.full = true;
	}
	return info;
}

// A title a member typed in by hand. kind: movie, series, anime-film or anime-series.
function customInfo(fields) {
	const info = blankInfo('custom');
	const anime = fields.kind.startsWith('anime');
	const episodic = fields.kind === 'series' || fields.kind === 'anime-series';
	info.type = anime ? 'anime' : episodic ? 'series' : 'movie';
	info.episodic = episodic;
	info.title = fields.title;
	info.year = fields.year || null;
	info.runtime = fields.runtime || 0;
	info.seasons = episodic ? 1 : 0;
	info.episodes = episodic ? (fields.episodes || 0) : 0;
	info.seasonEpisodes = episodic && fields.episodes ? [fields.episodes] : [];
	info.hue = hueFor(fields.title);
	info.full = true;
	return info;
}

// Everything about one title, fresh from TMDB or AniList. Custom titles have nothing to fetch.
async function fetchFullInfo(key, signal) {
	const tmdbMatch = key.match(/^tmdb-(movie|tv)-(\d+)$/);
	if (tmdbMatch) {
		const movie = tmdbMatch[1] === 'movie';
		const t = await tmdb('/' + tmdbMatch[1] + '/' + tmdbMatch[2], {
			append_to_response: movie
				? 'videos,keywords,release_dates,watch/providers'
				: 'videos,keywords,content_ratings,watch/providers',
			include_video_language: 'en,null'
		}, signal);
		const info = infoFromTmdb(t, tmdbMatch[1], true);

		// Anime TMDB also knows gets its AniList score beside TMDB's (never blended with it).
		if (info.type === 'anime') {
			const ani = await anilistScoreFor(info.title, signal);
			if (ani && ani.averageScore) {
				info.ids.anilist = ani.id;
				info.ratings.push({
					source: 'AniList',
					value: ani.averageScore,
					scale: 100,
					note: 'on ' + (ani.popularity || 0).toLocaleString('en-GB') + ' lists, matched "' +
						String(ani.title.english || ani.title.romaji || '').slice(0, 60) + '"'
				});
			}
		}
		return info;
	}
	const aniMatch = key.match(/^anilist-(\d+)$/);
	if (aniMatch) return infoFromAnilist(await anilistById(Number(aniMatch[1]), signal), true);
	return null;
}

// Whether a title's saved details are worth fetching again: short ones, and week-old streaming data.
function infoIsStale(t) {
	const info = t.info;
	if (info.source === 'custom') return false;
	if (!info.full) return true;
	if (info.source !== 'tmdb') return false;
	const checked = Date.parse(info.availability ? info.availability.checkedAt : info.checkedAt);
	return !checked || Date.now() - checked > WHERE_MAX_AGE_DAYS * 864e5;
}

function canFetch(key) {
	return key.startsWith('anilist-') || (key.startsWith('tmdb-') && Boolean(tmdbKey()));
}

// Club data can be written by anyone holding the club code, so it is checked on the way in,
// field by field, like validating at a server's front door. Anything odd is dropped.
function cleanInfo(raw, key) {
	if (!isPlainObject(raw)) return null;
	const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
	const num = (v, max) => {
		const n = Number(v);
		return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
	};
	const list = (v, max, each) => (Array.isArray(v) ? v : []).slice(0, max).map(each).filter(x => x !== null && x !== '');

	const source = key.startsWith('tmdb-') ? 'tmdb' : key.startsWith('anilist-') ? 'anilist' : 'custom';
	const info = blankInfo(source);
	info.type = ['movie', 'series', 'anime'].includes(raw.type) ? raw.type : 'movie';
	info.episodic = Boolean(raw.episodic);
	info.title = str(raw.title, 200).trim() || 'Untitled';
	info.originalTitle = str(raw.originalTitle, 200) || null;
	info.year = raw.year ? clampInt(raw.year, 1870, 2200) : null;
	info.runtime = num(raw.runtime, 2000);
	info.intro = num(raw.intro, 30);
	info.credits = num(raw.credits, 30);
	info.seasons = clampInt(raw.seasons, 0, 500);
	info.episodes = clampInt(raw.episodes, 0, 20000);
	info.seasonEpisodes = list(raw.seasonEpisodes, 200, n => clampInt(n, 0, 5000) || null);
	info.genres = list(raw.genres, 12, g => str(g, 40));
	info.keywords = list(raw.keywords, 40, k => str(k, 60));
	info.seasonTags = list(raw.seasonTags, 6, s => str(s, 20));
	info.cert = str(raw.cert, 12);
	info.certRegion = str(raw.certRegion, 4);
	info.synopsis = str(raw.synopsis, 2400);
	info.poster = tmdbPath(raw.poster);
	info.backdrop = tmdbPath(raw.backdrop);
	info.posterUrl = anilistImage(raw.posterUrl);
	info.backdropUrl = anilistImage(raw.backdropUrl);
	info.hue = clampInt(raw.hue, 0, 359);
	info.ratings = list(raw.ratings, 4, r =>
		isPlainObject(r) && ['TMDB', 'AniList'].includes(r.source)
			? { source: r.source, value: num(r.value, 100), scale: r.scale === 100 ? 100 : 10, note: str(r.note, 100) }
			: null
	);
	info.videos = list(raw.videos, 12, v =>
		isPlainObject(v) && youtubeKey(v.key)
			? { key: v.key, type: str(v.type, 20) || 'Video', name: str(v.name, 120), official: Boolean(v.official) }
			: null
	);
	info.availability = cleanAvailability(raw.availability);
	info.anilistStreams = list(raw.anilistStreams, 8, s => str(s, 40));

	// The ids come from the key itself, so a title can't point somewhere else.
	const tmdbMatch = key.match(/^tmdb-(movie|tv)-(\d+)$/);
	const aniMatch = key.match(/^anilist-(\d+)$/);
	const rawIds = isPlainObject(raw.ids) ? raw.ids : {};
	info.ids = {
		tmdb: tmdbMatch ? Number(tmdbMatch[2]) : null,
		tmdbType: tmdbMatch ? tmdbMatch[1] : null,
		anilist: aniMatch ? Number(aniMatch[1]) : (Number.isInteger(rawIds.anilist) ? rawIds.anilist : null)
	};
	info.checkedAt = /^\d{4}-\d{2}-\d{2}$/.test(raw.checkedAt || '') ? raw.checkedAt : today();
	info.full = Boolean(raw.full);
	return info;
}

function cleanAvailability(raw) {
	if (!isPlainObject(raw) || !isPlainObject(raw.regions)) return null;
	const regions = {};
	const providers = list => (Array.isArray(list) ? list : []).slice(0, 12).filter(isPlainObject)
		.map(p => ({ name: String(p.name || '').slice(0, 60), logo: tmdbPath(p.logo) }))
		.filter(p => p.name);
	CLUB_REGIONS.forEach(r => {
		const x = isPlainObject(raw.regions[r.tmdb]) ? raw.regions[r.tmdb] : {};
		regions[r.tmdb] = {
			stream: providers(x.stream),
			rentBuy: providers(x.rentBuy),
			link: /^https:\/\/www\.themoviedb\.org\/[A-Za-z0-9/?=&._-]+$/.test(x.link || '') ? x.link : null
		};
	});
	return { checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(raw.checkedAt || '') ? raw.checkedAt : today(), regions };
}

function cleanTitle(key, raw) {
	if (!KEY_PATTERN.test(key) || !isPlainObject(raw)) return null;
	const info = cleanInfo(raw.info, key);
	if (!info) return null;
	const words = {};
	MEMBER_IDS.forEach(id => {
		const w = isPlainObject(raw.words) ? raw.words[id] : null;
		words[id] = WORDS.some(x => x.id === w) ? w : null;
	});
	return {
		key,
		status: ['listed', 'watched', 'removed'].includes(raw.status) ? raw.status : 'listed',
		order: Number(raw.order) || 0,
		addedBy: MEMBER_IDS.includes(raw.addedBy) ? raw.addedBy : null,
		progress: clampInt(raw.progress, 0, 20000),
		historyOrder: Number(raw.historyOrder) || 0,
		words,
		info
	};
}

function cleanCheck(id, raw) {
	if (!isPlainObject(raw) || !KEY_PATTERN.test(raw.key || '') || !MEMBER_IDS.includes(raw.by)) return null;
	const answers = {};
	if (isPlainObject(raw.answers)) {
		QUESTIONS.forEach(q => {
			if (ANSWER_VALUES.includes(raw.answers[q.id])) answers[q.id] = raw.answers[q.id];
		});
	}
	return {
		id,
		key: raw.key,
		by: raw.by,
		answers,
		result: computeVerdict(answers).result, // worked out again here, never taken on trust
		override: raw.by === 'mayseph' && OVERRIDE_RESULTS.includes(raw.override) ? raw.override : null,
		at: Number(raw.at) || 0
	};
}

// The whole club, from a store's raw documents.
function readClub(raw) {
	const titles = new Map();
	Object.keys(raw.titles || {}).forEach(key => {
		const t = cleanTitle(key, raw.titles[key]);
		if (t) titles.set(key, t);
	});

	const votes = {};
	MEMBER_IDS.forEach(id => {
		const doc = raw.votes ? raw.votes[id] : null;
		const picks = isPlainObject(doc) && Array.isArray(doc.picks) ? doc.picks : [];
		votes[id] = Array.from(new Set(picks.filter(k => typeof k === 'string' && KEY_PATTERN.test(k)))).slice(0, 12);
	});

	const checks = Object.keys(raw.checks || {})
		.map(id => cleanCheck(id, raw.checks[id]))
		.filter(Boolean)
		.sort((a, b) => a.at - b.at);

	const st = raw.state && isPlainObject(raw.state.club) ? raw.state.club : {};
	const tonight = {};
	MEMBER_IDS.forEach(id => {
		tonight[id] = !(isPlainObject(st.tonight) && st.tonight[id] === false);
	});

	return {
		titles,
		votes,
		checks,
		tonight,
		tieWinner: typeof st.tieWinner === 'string' && KEY_PATTERN.test(st.tieWinner) ? st.tieWinner : null,
		closed: st.closed === true
	};
}

// What the page knows about the club right now. Only readClub() fills it in.
const club = {
	titles: new Map(),
	votes: {},
	checks: [],
	tonight: { tim: true, mayseph: true, folio: true, vitamin: true },
	tieWinner: null,
	closed: false,
	loaded: false
};

MEMBER_IDS.forEach(id => {
	club.votes[id] = [];
});

function titleByKey(key) {
	return club.titles.get(key) || null;
}

// Titles on the Master List, oldest first, the order they were added.
function listedTitles() {
	return Array.from(club.titles.values()).filter(t => t.status === 'listed').sort((a, b) => a.order - b.order);
}

// Titles in the watch history, newest first.
function watchedTitles() {
	return Array.from(club.titles.values()).filter(t => t.status === 'watched').sort((a, b) => b.historyOrder - a.historyOrder);
}

function isListed(key) {
	const t = titleByKey(key);
	return Boolean(t && t.status === 'listed');
}

function typeLabel(info) {
	return info.type === 'anime' ? (info.episodic ? 'Anime series' : 'Anime film') : TYPE_LABELS[info.type];
}

function yearText(info) {
	return info.year ? String(info.year) : 'year unknown';
}

function formatLength(info) {
	if (!info.runtime) return info.episodic ? 'Episode length unknown' : 'Runtime unknown';
	return info.episodic ? Math.round(info.runtime) + ' min an episode' : formatMinutes(info.runtime);
}

function formatFormat(info) {
	if (!info.episodic) return 'Feature film';
	if (!info.episodes) return info.seasons ? plural(info.seasons, 'season') + ', episode count unknown' : 'Series';
	return info.seasons > 1 ? plural(info.seasons, 'season') + ', ' + plural(info.episodes, 'episode') : plural(info.episodes, 'episode');
}

function formatRating(r) {
	return r.source + ' ' + r.value + '/' + r.scale;
}

function certText(info) {
	return info.cert ? esc(info.cert) + (info.certRegion ? ' (' + esc(info.certRegion === 'GB' ? 'UK' : info.certRegion) + ')' : '') : 'Not rated yet';
}

const SOURCE_LABELS = { tmdb: 'TMDB', anilist: 'AniList', custom: 'Custom' };

function sourceChip(info) {
	return '<span class="src_chip src_' + info.source + '">' + SOURCE_LABELS[info.source] + '</span>';
}

// Posters come from TMDB's or AniList's image servers; without one, the drawn poster shows.
function posterSrc(info, size) {
	return info.posterUrl || (info.poster ? TMDB_IMAGES + (size || 'w500') + info.poster : null);
}

function backdropUrl(info) {
	return info.backdropUrl || (info.backdrop ? TMDB_IMAGES + 'w780' + info.backdrop : null);
}

function posterArt(info, size) {
	const src = posterSrc(info, size);
	const img = src ? '<img class="poster_img" src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' : '';
	return '<span class="poster_art" style="--h:' + info.hue + '">' + img + '</span>';
}

function miniPoster(t, size, attrs) {
	return '<span class="mini_poster"' + (attrs || '') + '>' + posterArt(t.info, size || 'w154') + '</span>';
}

// Which episode comes next, as "S2 E3" when the seasons are known, or "episode 15".
function episodeLabel(info, n) {
	const seasons = info.seasonEpisodes || [];
	if (seasons.length > 1) {
		let left = n;
		for (let s = 0; s < seasons.length; s++) {
			if (left <= seasons[s]) return 'S' + (s + 1) + ' E' + left;
			left -= seasons[s];
		}
	}
	return 'episode ' + n;
}

function showFinished(t) {
	return t.info.episodic && t.info.episodes > 0 && t.progress >= t.info.episodes;
}

function progressText(t) {
	const info = t.info;
	if (showFinished(t)) return 'All ' + plural(info.episodes, 'episode') + ' watched';
	const next = episodeLabel(info, t.progress + 1);
	if (!t.progress) return 'Not started yet, first up is ' + next;
	return 'Watched ' + t.progress + (info.episodes ? ' of ' + info.episodes : '') + ', next up is ' + next;
}

function progressShare(t) {
	return t.info.episodes ? Math.min(1, t.progress / t.info.episodes) : 0;
}



// G. Comfort rules (Safe for Mayseph)

function comfortOf(key) {
	let latest = null;
	club.checks.forEach(c => {
		if (c.key === key) latest = c; // checks are oldest first, so the last one wins
	});
	if (!latest) return { result: 'NOT_ASSESSED' };
	return { result: latest.override || latest.result, overridden: Boolean(latest.override), latest };
}

// A hard Yes wins, then open questions, then anything to talk about, else comfortable.
function computeVerdict(answers) {
	let answered = 0, openCount = 0, hardYes = null;
	const talkAbout = [];
	for (const q of QUESTIONS) {
		const value = answers[q.id];
		if (value) answered++;
		if (q.parent && answers[q.parent] !== 'YES') continue;
		if (value === 'YES') {
			if (q.hard) {
				if (!hardYes) hardYes = q;
			} else {
				talkAbout.push(q);
			}
		} else if (value !== 'NO' && value !== 'NOT_APPLICABLE') {
			openCount++;
		}
	}
	const short = q => q.text.charAt(0).toLowerCase() + q.text.slice(1).replace(/\?$/, '');
	if (!answered) return { result: 'NOT_ASSESSED', why: 'No questions answered yet.' };
	if (hardYes) return { result: 'NOT_SUITABLE', why: 'Yes to "' + short(hardYes) + '", which is a hard no.' };
	if (openCount) return { result: 'INCOMPLETE', why: plural(openCount, 'question') + ' still open or marked Not sure.' };
	if (talkAbout.length) return { result: 'DISCUSS_FIRST', why: 'Yes to: ' + talkAbout.map(short).join('; ') + '.' };
	return { result: 'COMFORTABLE', why: 'No concerns on any question.' };
}

// "SFM (safe for Mayseph)" in sentences; labels that are already words stay as they are.
function resultName(result) {
	const r = RESULT_INFO[result];
	return r.label === r.full ? r.label : r.label + ' (' + r.full.charAt(0).toLowerCase() + r.full.slice(1) + ')';
}

function badgeHtml(result) {
	const info = RESULT_INFO[result];
	const text = info.label === info.full
		? info.label
		: '<span aria-hidden="true">' + info.label + '</span><span class="sr_only">' + info.full + '</span>';
	return '<span class="badge r_' + result + '" title="' + info.full + '">' + icon(info.icon) + text + '</span>';
}



// H. Tonight's rules: who's here decides what suits tonight
// The club watches together. Everyone here: NSFM titles sit out. Someone away: shows wait for
// them (nobody misses an episode). Mayseph away: NSFM titles are on the menu.

function awayMembers() {
	return MEMBERS.filter(m => !club.tonight[m.id]);
}

// Why a title is set aside tonight, or null when it suits. short goes on its poster.
function asideFor(t) {
	const away = awayMembers();
	if (t.info.episodic && away.length) {
		const names = away.map(m => m.name);
		return {
			short: away.length > 2 ? 'Waits for everyone' : 'Waits for ' + joinList(names),
			long: joinList(names) + (away.length === 1 ? ' is' : ' are') + ' away and would miss ' +
				(t.progress ? 'episodes' : 'the start')
		};
	}
	if (club.tonight.mayseph && comfortOf(t.key).result === 'NOT_SUITABLE')
		return { short: 'NSFM tonight', long: 'NSFM, and Mayseph is here' };
	return null;
}

function suitsTonight(t) {
	return !asideFor(t);
}

function tonightSummary() {
	const away = awayMembers();
	if (away.length === MEMBERS.length) return 'Nobody is marked as here yet. Tap whoever is in tonight.';
	if (!away.length) return "Everyone's here, so NSFM titles sit this one out.";
	const names = joinList(away.map(m => m.name));
	const are = away.length === 1 ? ' is' : ' are';
	if (!club.tonight.mayseph) {
		const back = away.length === 1 ? "she's back" : "everyone's back";
		return names + are + ' away: NSFM titles are on the menu, and shows wait until ' + back + '.';
	}
	return names + are + " away, so shows wait until everyone's back. NSFM titles still sit out.";
}



// I. One spring for every panel
// The island and every dialog grow the same way: a black shape (the "skin") springs from the
// island's pill to its full size, stretching while it moves fast and squashing a little as it
// lands, while the contents fade in. The skin is grown by its size (top, left, width, height),
// never by scaling it: Firefox draws seams across scaled layers, and sizes have none.
// The spring is worked out one frame (1/60 s) at a time and handed to the browser as keyframes.

const PANEL_SPRING = { stiffness: 0.085, damping: 0.27, stretch: 1.4 };
let springSamplesCache = null;

// One sample per frame. x: how far open (0 to 1, overshooting a little). v: how fast it moves.
function springSamples() {
	if (springSamplesCache) return springSamplesCache;
	const out = [{ x: 0, v: 0 }];
	let x = 0, v = 0;
	for (let i = 0; i < 90; i++) {
		v += PANEL_SPRING.stiffness * (1 - x) - PANEL_SPRING.damping * v;
		x += v;
		out.push({ x, v });
		if (i > 8 && Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.002) break;
	}
	out.push({ x: 1, v: 0 });
	springSamplesCache = out;
	return out;
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function px(n) {
	return n.toFixed(1) + 'px';
}

function rectFrame(left, top, width, height, radius) {
	return { left: px(left), top: px(top), width: px(width), height: px(height), borderRadius: px(radius) };
}

function stopMorph(el) {
	if (el._morph) el._morph.cancel();
	el._morph = null;
}

// Grows el from one box to another on the spring. Boxes: { left, top, width, height, radius },
// measured from el's positioned parent.
function morphOpen(el, from, to) {
	stopMorph(el);
	if (reduceMotion.matches || !el.animate) return null;
	const frames = springSamples().map(sample => {
		const p = sample.x;

		// Moving fast: taller and narrower (stretch). Landing past the end: shorter and wider (squash).
		const s = Math.max(-0.07, Math.min(0.12, sample.v * PANEL_SPRING.stretch));
		const w = lerp(from.width, to.width, p) * (1 - s * 0.5);
		const h = lerp(from.height, to.height, p) * (1 + s);
		const centre = lerp(from.left + from.width / 2, to.left + to.width / 2, p);
		return rectFrame(centre - w / 2, lerp(from.top, to.top, p), w, h, lerp(from.radius, to.radius, Math.min(1, p)));
	});
	const anim = el.animate(frames, { duration: frames.length * 1000 / 60, easing: 'linear' });
	el._morph = anim;
	const tidy = () => {
		if (el._morph === anim) el._morph = null;
	};
	anim.finished.then(tidy, tidy);
	return anim;
}

// Shrinks el back into a box, with a little squash just before it lands, then calls done().
function morphClose(el, from, to, done) {
	stopMorph(el);
	if (reduceMotion.matches || !el.animate) {
		done();
		return;
	}
	// Most of the way there, it lands a little wide and flat, then settles into the pill.
	const nearW = lerp(from.width, to.width * 1.06, 0.85);
	const nearH = lerp(from.height, to.height * 0.9, 0.85);
	const nearCentre = lerp(from.left + from.width / 2, to.left + to.width / 2, 0.85);
	const anim = el.animate([
		rectFrame(from.left, from.top, from.width, from.height, from.radius),
		Object.assign(
			rectFrame(nearCentre - nearW / 2, lerp(from.top, to.top, 0.85), nearW, nearH, lerp(from.radius, to.radius, 0.85)),
			{ offset: 0.78 }
		),
		rectFrame(to.left, to.top, to.width, to.height, to.radius)
	], { duration: 240, easing: 'cubic-bezier(.5, 0, .75, .1)', fill: 'forwards' });
	el._morph = anim;
	anim.finished.then(() => {
		if (el._morph !== anim) return;
		el._morph = null;
		done();
		anim.cancel(); // drop the held last frame now that the shape is put away
	}, () => { /* cancelled by a newer animation, which takes over */ });
}

function fadeIn(el, delay, duration) {
	if (reduceMotion.matches || !el.animate) return;
	el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration || 170, delay: delay || 0, easing: 'ease-out', fill: 'backwards' });
}

function fadeOut(el, duration) {
	if (reduceMotion.matches || !el.animate) return null;
	return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration || 110, easing: 'ease-in', fill: 'forwards' });
}

// The island's pill, measured from another element's corner, so dialogs can grow out of it.
function islandBoxFrom(el) {
	const pill = $('islandSkin').getBoundingClientRect();
	const box = el.getBoundingClientRect();
	return { left: pill.left - box.left, top: pill.top - box.top, width: pill.width, height: pill.height, radius: 29 };
}

// Scrolling squashes and stretches the island a little. It only ever scales the closed pill,
// which has nothing clipped inside it, so there is nothing for Firefox to draw seams on.
const islandPhysics = { x: 0, v: 0, speed: 0, lastY: 0, lastT: 0, lastEvent: 0, running: false };
const SQUISH_STIFFNESS = 0.1;
const SQUISH_DAMPING = 0.28;
const SQUISH_MAX = 0.16;

function onPageScroll() {
	const p = islandPhysics;
	const now = performance.now();
	const y = window.scrollY;
	const dt = Math.max(8, now - p.lastT);
	p.speed = p.speed * 0.6 + ((y - p.lastY) / dt) * 0.4; // smooths out jittery wheel and touch events
	p.lastY = y;
	p.lastT = now;
	p.lastEvent = now;
	if (!p.running && !reduceMotion.matches && !$('islandShell').classList.contains('is_open')) {
		p.running = true;
		requestAnimationFrame(stepIsland);
	}
}

function kickIsland(amount) {
	if (reduceMotion.matches || $('islandShell').classList.contains('is_open')) return;
	const p = islandPhysics;
	p.v += amount;
	if (!p.running) {
		p.running = true;
		p.lastT = performance.now();
		requestAnimationFrame(stepIsland);
	}
}

function stopSquish() {
	const p = islandPhysics;
	p.x = 0;
	p.v = 0;
	p.speed = 0;
	p.running = false;
	$('islandShell').style.transform = '';
}

function stepIsland(now) {
	const p = islandPhysics;
	if (!p.running) return;
	if (now - p.lastEvent > 60) p.speed *= 0.6; // no fresh scroll events: the speed drops away
	const target = Math.min(SQUISH_MAX, Math.abs(p.speed) * 0.05);
	p.v += SQUISH_STIFFNESS * (target - p.x) - SQUISH_DAMPING * p.v;
	p.x += p.v;
	if (Math.abs(p.x) < 0.0004 && Math.abs(p.v) < 0.0004 && Math.abs(p.speed) < 0.005) {
		stopSquish();
		return;
	}
	const direction = p.speed >= 0 ? 1 : -1;
	const x = Math.max(-0.06, Math.min(0.18, p.x));
	const scaleX = x >= 0 ? 1 - x * 0.45 : 1 - x * 0.8;
	const scaleY = x >= 0 ? 1 + x : 1 + x * 1.3;
	$('islandShell').style.transform = 'translateY(' + (direction * x * 16).toFixed(2) + 'px) scale(' +
		scaleX.toFixed(4) + ', ' + scaleY.toFixed(4) + ')';
	requestAnimationFrame(stepIsland);
}



// J. The island: clocks, and who's watching
// Closed, it shows your sticker and the club's three clocks. Open, it is the member picker:
// each member's clock is a radio button. It opens instantly, can be tapped while it is still
// growing, and closes the moment you pick. The keys 1 to 4 switch member from anywhere.

const formatters = {};

function fmt(zone, options) {
	const key = zone + JSON.stringify(options);
	if (!formatters[key]) formatters[key] = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: zone }, options));
	return formatters[key];
}

function clockTime(zone, now) {
	return fmt(zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

function localDateKey(zone, now) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
}

function localHour(zone, now) {
	return Number(fmt(zone, { hour: 'numeric', hourCycle: 'h23' }).format(now));
}

// The four member slots. Used in the island, in Settings, in the welcome and in "Who's watching?".
function slotsHtml(withClocks) {
	return MEMBERS.map((m, i) =>
		'<button class="slot m_' + m.id + '" role="radio" aria-checked="false" tabindex="-1" data-member="' + m.id + '">' +
		'<span class="num" aria-hidden="true">' + (i + 1) + '</span>' +
		sticker(m.id) +
		'<span class="who">' + esc(m.name) + '</span>' +
		'<span class="where">' + esc(m.place) + ' time</span>' +
		'<span class="you" aria-hidden="true" hidden>You</span>' +
		(withClocks ? '<span class="time"><b data-clock="' + m.id + '"></b><span data-date="' + m.id + '"></span></span>' : '') +
		'</button>'
	).join('');
}

function renderSlots(container) {
	const me = state.memberId;
	container.querySelectorAll('[data-member]').forEach((b, i) => {
		const on = b.dataset.member === me;
		b.setAttribute('aria-checked', String(on));
		b.tabIndex = on || (!me && i === 0) ? 0 : -1;
		b.querySelector('.you').hidden = !on;
	});
}

// Arrow keys move between members, like any radio group; picking happens on click or Space.
function onSlotKeys(event, container, pick) {
	const slots = Array.from(container.querySelectorAll('[data-member]'));
	const i = slots.indexOf(document.activeElement);
	let next = null;
	if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = slots[(i + 1) % slots.length];
	if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = slots[(i - 1 + slots.length) % slots.length];
	if (next) {
		event.preventDefault();
		next.focus();
		pick(next.dataset.member, true);
	}
}

function renderIsland() {
	const me = state.memberId ? memberById(state.memberId) : null;
	$('meToken').innerHTML = me ? sticker(me.id) : '<span class="me_empty">' + icon('user', 'small') + '</span>';
	$('islandPrompt').textContent = me
		? 'Watching as ' + me.name + '. Tap someone else to switch.'
		: "Who's watching? Tap yourself.";
	$('islandLabel').textContent = (me ? 'Watching as ' + me.name + '.' : 'Nobody picked yet.') +
		" Open for everyone's local time and to pick who is watching.";
	renderSlots($('islandSlots'));
}

function tickClocks() {
	const now = new Date();
	const seen = {};
	let compact = '';
	MEMBERS.forEach(m => {
		if (seen[m.code]) return;
		seen[m.code] = true;
		compact += '<span class="zone"><b>' + m.code + '</b>' + clockTime(m.zone, now) + '</span>';
	});
	$('clockCompact').innerHTML = compact;
	if (!$('islandShell').classList.contains('is_open')) return;

	const me = state.memberId ? memberById(state.memberId) : null;
	const myDay = me ? Date.parse(localDateKey(me.zone, now)) : 0;
	MEMBERS.forEach(m => {
		let note = fmt(m.zone, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
		if (me) {
			const dayDiff = (Date.parse(localDateKey(m.zone, now)) - myDay) / 864e5;
			if (dayDiff > 0) note += ', a day ahead of you';
			if (dayDiff < 0) note += ', a day behind you';
		}
		const asleep = localHour(m.zone, now) < 7;
		const time = clockTime(m.zone, now);
		const clock = document.querySelector('#islandSlots [data-clock="' + m.id + '"]');
		const date = document.querySelector('#islandSlots [data-date="' + m.id + '"]');
		if (!clock) return;
		clock.textContent = time;
		date.innerHTML = esc(note) + (asleep ? '<br><span class="night">' + icon('moon', 'small') + 'probably asleep</span>' : '');
		clock.closest('.slot').setAttribute('aria-label', m.name + ', ' + m.place + ', ' + time + (asleep ? ', probably asleep' : ''));
	});
}

function setIslandOpen(open) {
	const shell = $('islandShell');
	if (open === shell.classList.contains('is_open')) return;
	const skin = $('islandSkin');
	stopSquish();
	const before = skin.getBoundingClientRect();
	stopMorph(skin);

	shell.classList.toggle('is_open', open);
	$('islandPanel').hidden = !open;
	$('islandButton').setAttribute('aria-expanded', String(open));
	if (open) tickClocks();

	const after = shell.getBoundingClientRect();
	const from = { left: before.left - after.left, top: before.top - after.top, width: before.width, height: before.height, radius: 32 };
	const to = { left: 0, top: 0, width: after.width, height: after.height, radius: 32 };
	shell.classList.add('is_morphing');
	const anim = open ? morphOpen(skin, from, to) : null;
	if (open) {
		fadeIn($('islandPanel'), 0, 140);
	} else {
		morphClose(skin, from, to, () => {});
	}
	const settle = () => shell.classList.remove('is_morphing');
	if (anim) anim.finished.then(settle, settle);
	else setTimeout(settle, reduceMotion.matches ? 0 : 260);
}

// Who is watching on this device. how: 'island', 'key', 'settings', 'who' or 'welcome'.
function selectMember(id, how) {
	if (!MEMBER_IDS.includes(id)) return;
	const changed = id !== state.memberId;
	const first = !state.memberId;
	state.memberId = id;
	Saved.set(STORAGE.member, id);
	if (changed) {
		renderAll();
		if (how !== 'welcome') toast((first ? 'Hi, ' : 'Now watching as ') + memberName(id) + '.', id);
	}
	renderIsland();
	if ($('settingsDialog').open) renderSlots($('settingsSlots'));
}



// K. Dialogs
// Every dialog grows out of the island and shrinks back into it. While one is open the page
// underneath is locked in place, so a list scrolling inside a dialog never drags the page.
// Dialogs can stack: "Who's watching?" can open on top of the one asking for it.

function openDialogs() {
	return Array.from(document.querySelectorAll('dialog.isle[open], dialog.menu_sheet[open]'))
		.filter(d => !d.dataset.closing);
}

function syncPageLock() {
	document.documentElement.classList.toggle('modal_open', openDialogs().length > 0);
}

function openDialog(dialog) {
	if (dialog.open && !dialog.dataset.closing) return;
	const skin = dialog.querySelector('.dlg_skin');
	const content = dialog.querySelector('.dlg_content');
	if (dialog._fade) {
		dialog._fade.cancel();
		dialog._fade = null;
	}
	if (content._fade) {
		content._fade.cancel();
		content._fade = null;
	}
	delete dialog.dataset.closing;
	if (!dialog.open) {
		dialog._returnFocus = document.activeElement;
		dialog.showModal();
	}
	syncPageLock();
	if (islandOpen()) setIslandOpen(false);

	if (!reduceMotion.matches && skin) {
		const to = { left: 0, top: 0, width: dialog.offsetWidth, height: dialog.offsetHeight, radius: parseFloat(getComputedStyle(skin).borderTopLeftRadius) || 34 };
		morphOpen(skin, islandBoxFrom(dialog), to);
		fadeIn(content, 70, 180);
		content.style.pointerEvents = 'none'; // a fast double-click must not land on the dialog's buttons
		setTimeout(() => {
			content.style.pointerEvents = '';
		}, 160);
	}
	kickIsland(-0.05);
}

// then: runs once the dialog has gone (the next dialog to open, say).
function closeDialog(dialog, then) {
	if (!dialog.open || dialog.dataset.closing) {
		if (then) then();
		return;
	}
	const skin = dialog.querySelector('.dlg_skin');
	const content = dialog.querySelector('.dlg_content');
	dialog.dataset.closing = '1';
	syncPageLock();
	if (dialog.id === 'playerDialog') closePlayer(); // the sound stops at once
	const finish = () => {
		if (!dialog.dataset.closing) return; // opened again while it was closing
		delete dialog.dataset.closing;
		dialog.close();
		if (content && content._fade) {
			content._fade.cancel();
			content._fade = null;
		}
		if (dialog._fade) {
			dialog._fade.cancel();
			dialog._fade = null;
		}
		syncPageLock();
		const back = dialog._returnFocus;
		if (back && back.isConnected && !then && !back.closest('dialog:not([open])')) back.focus({ preventScroll: true });
		if (then) then();
	};
	if (reduceMotion.matches || !skin || !dialog.animate) {
		finish();
		return;
	}
	try {
		dialog._fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, pseudoElement: '::backdrop', fill: 'forwards' });
	} catch (error) {
		dialog._fade = null;
	}
	if (content) content._fade = fadeOut(content, 100);
	const from = { left: 0, top: 0, width: dialog.offsetWidth, height: dialog.offsetHeight, radius: 34 };
	morphClose(skin, from, islandBoxFrom(dialog), finish);
	kickIsland(0.06);
}

function closeTopDialog() {
	const open = openDialogs();
	if (!open.length) return false;
	const top = open[open.length - 1];
	if (top.id === 'menuSheet') closeSheet();
	else if (top.id === 'welcomeDialog' && !welcomeCanClose()) return true;
	else closeDialog(top);
	return true;
}

function islandOpen() {
	return $('islandShell').classList.contains('is_open');
}

// Back buttons, backdrop clicks and Esc all close a dialog. A backdrop click only counts when the
// press also started on the backdrop, so selecting text and letting go outside never closes one.
function wireDialog(dialog) {
	dialog.addEventListener('pointerdown', e => {
		dialog._pressOnBackdrop = e.target === dialog;
	});
	dialog.addEventListener('click', e => {
		const onBackdrop = e.target === dialog && dialog._pressOnBackdrop;
		dialog._pressOnBackdrop = false;
		if (dialog.id === 'welcomeDialog' && !welcomeCanClose()) return;
		if (onBackdrop || e.target.closest('[data-close]')) closeDialog(dialog);
	});
	dialog.addEventListener('cancel', e => {
		e.preventDefault();
		if (dialog.id === 'welcomeDialog' && !welcomeCanClose()) return;
		closeDialog(dialog);
	});
}




// L. Master List: the endless carousel
// The list is drawn LOOP_COPIES times side by side. Only the middle copy is "real" (reachable by
// keyboard and screen readers). When scrolling stops outside the middle copy, the row jumps by
// exactly one copy's width, which looks identical, so the list never runs out.

// What the page itself is doing right now. (The club's data lives in `club`, section F.)
const state = {
	memberId: savedMember(),
	store: null,                 // the club store in use: a LocalClub or a FirestoreClub
	clubSetting: null,           // what this browser remembers about its club
	syncState: 'local',          // local, connecting, synced, saving, offline or error
	syncError: '',
	lastChangeAt: null,
	openKey: null,               // the title open in Details
	activeTab: 'details',
	quizzes: new Map(),          // title key -> the check in progress
	refreshed: new Set(),        // titles whose details were fetched again this visit
	afterWho: null,              // what to do once "Who's watching?" is answered
	fitOptions: { skipIntro: false, skipCredits: false },
	wheel: { angle: 0, items: [], pickKey: null, spinning: false, pool: null },
	shelf: { keys: [], looping: false, setWidth: 0, centerKey: null, heading: null, html: '', lastScroll: 0, timer: 0 },
	player: null,
	welcomeStep: null,
	seen: null                   // the club as it was last drawn, for "Folio added ..." toasts
};

function matchesSearch(t, query) {
	if (!query) return true;
	const info = t.info;
	const haystack = [
		info.title,
		info.originalTitle || '',
		typeLabel(info),
		info.genres.join(' '),
		info.seasonTags.join(' '),
		hintsFor(info).map(h => HINT_LABELS[h.key] + ' ' + h.from).join(' ')
	].join(' ').toLowerCase();
	return haystack.includes(query);
}

function peekHtml(t) {
	const info = t.info;
	const where = whereShort(info.availability);
	return '<span class="peek" aria-hidden="true"><b>' + esc(info.title) + '</b>' +
		yearText(info) + ', ' + typeLabel(info) + ', ' + (info.episodic ? formatFormat(info) : formatLength(info)) + '<br>' +
		(info.genres.length ? esc(info.genres.slice(0, 3).join(', ')) + '<br>' : '') +
		(info.ratings.length ? info.ratings.map(formatRating).join(', ') + '<br>' : '') +
		(info.episodic && t.progress ? esc(progressText(t)) + '<br>' : '') +
		(where ? where + '<br>' : '') +
		(t.addedBy ? 'Added by ' + esc(memberName(t.addedBy)) : '') +
		'<span class="go">Click for details</span></span>';
}

function cardHtml(t, leader, isClone) {
	const info = t.info;
	const comfort = comfortOf(t.key);
	const voters = votersOf(t.key);
	const aside = asideFor(t);
	const dots = MEMBERS.map((m, i) =>
		'<span class="m_' + m.id + (voters.includes(m.id) ? ' on' : '') + '">' + (i + 1) + '</span>'
	).join('');
	const label = info.title + ', ' + typeLabel(info).toLowerCase() + ', ' + yearText(info) + '. ' +
		RESULT_INFO[comfort.result].full + '. ' + plural(voters.length, 'vote') + (leader === t.key ? ', leading' : '') + '. ' +
		(aside ? 'Set aside tonight: ' + aside.long + '. ' : '') +
		(info.episodic && t.progress ? progressText(t) + '. ' : '') + 'Open details.';
	return '<li data-key="' + t.key + '"' + (isClone ? ' aria-hidden="true"' : '') + (aside ? ' class="is_aside"' : '') + '>' +
		'<button class="poster_card' + (posterSrc(info) ? ' has_poster' : '') + '" data-key="' + t.key + '"' +
		(isClone ? ' tabindex="-1" data-clone' : '') + ' aria-label="' + esc(label) + '">' +
		posterArt(info) +
		'<span class="poster_title rimmed" style="--h:' + info.hue + '" aria-hidden="true">' + esc(info.title) + '</span>' +
		badgeHtml(comfort.result) +
		'<span class="vote_dots" aria-hidden="true">' + dots + '</span>' +
		(info.episodic && t.progress
			? '<span class="poster_progress" aria-hidden="true"><i style="width:' + (Math.max(0.04, progressShare(t)) * 100).toFixed(1) + '%"></i></span>'
			: '') +
		(aside ? '<span class="aside_tag" aria-hidden="true">' + icon('moon', 'small') + esc(aside.short) + '</span>' : '') +
		peekHtml(t) +
		'</button>' +
		(leader === t.key ? art('crown', 'crown_tag') : '') +

		// A sibling of the poster, not inside it: a button can't hold another button.
		'<button class="remove_btn" data-remove="' + t.key + '"' + (isClone ? ' tabindex="-1"' : '') +
		' aria-label="Remove ' + esc(info.title) + ' from the Master List" title="Remove from the Master List">' +
		icon('close') + '</button>' +
		'</li>';
}

function shelfLoading() {
	return !club.loaded || (state.store && state.store.kind === 'firebase' && state.syncState === 'connecting' && !club.titles.size);
}

function shelfEmptyHtml(listedCount, query) {
	if (shelfLoading()) return '<div class="empty_note">' + art('popcorn_empty') + 'Loading the Master List…</div>';
	if (!listedCount) {
		return '<div class="empty_note">' + sticker('folio', 'boil') +
			'<span>The Master List is empty. Press the + button to add the first title.</span></div>';
	}
	return '<div class="empty_note">' + art('discover') + '<span>Nothing on the list matches "' + esc(query) +
		'". Press + to look for it on TMDB and AniList.</span></div>';
}

function realLi(key) {
	return $('shelfRow').querySelector(':scope > li[data-key="' + key + '"]:not([aria-hidden])');
}

// The row is busy while you drag or scroll it: redraws from someone else's change wait a moment.
function shelfBusy() {
	return drag.down || performance.now() - state.shelf.lastScroll < 300;
}

function renderShelf(force) {
	const row = $('shelfRow');
	const query = $('searchInput').value.trim().toLowerCase();
	const all = listedTitles();
	const list = all.filter(t => matchesSearch(t, query));
	const leader = leaderKey();
	const looping = list.length >= 2;
	const copies = looping ? Math.max(LOOP_COPIES, 2 * Math.ceil(24 / list.length / 2) + 1) : 1;
	const middle = Math.floor(copies / 2);
	let html = '';
	for (let c = 0; c < copies; c++) html += list.map(t => cardHtml(t, leader, c !== middle)).join('');
	if (!list.length) html = '<li class="shelf_empty">' + shelfEmptyHtml(all.length, query) + '</li>';

	$('shelfCount').textContent = query
		? plural(list.length, 'match', 'matches') + ' for "' + $('searchInput').value.trim() + '"'
		: '';
	$('prevButton').disabled = $('nextButton').disabled = list.length < 2;

	if (!force && html === state.shelf.html) return; // nothing on the posters changed
	if (!force && shelfBusy()) {
		clearTimeout(state.shelf.timer);
		state.shelf.timer = setTimeout(() => renderShelf(false), 320);
		return;
	}

	// Keep keyboard focus on the same title across the redraw.
	const focused = row.contains(document.activeElement) ? document.activeElement.closest('[data-key], [data-remove]') : null;
	const focusKey = focused ? (focused.dataset.key || focused.dataset.remove) : null;

	state.shelf.html = html;
	row.innerHTML = html;
	row.classList.toggle('no_loop', !looping);
	state.shelf.heading = null;
	state.shelf.keys = list.map(t => t.key);
	state.shelf.looping = looping;
	measureShelf();
	const keep = state.shelf.keys.includes(state.shelf.centerKey) ? state.shelf.centerKey : state.shelf.keys[0];
	if (keep) scrollToLi(realLi(keep), false);
	updateCenter(true);
	if (focusKey) {
		const li = realLi(focusKey);
		if (li) li.querySelector('.poster_card').focus({ preventScroll: true });
	}
}

function measureShelf() {
	const s = state.shelf;
	const lis = $('shelfRow').querySelectorAll(':scope > li[data-key]');
	s.setWidth = s.looping && lis.length > s.keys.length ? lis[s.keys.length].offsetLeft - lis[0].offsetLeft : 0;
}

function scrollToLi(li, smooth) {
	if (!li) return;
	const row = $('shelfRow');
	row.scrollTo({
		left: li.offsetLeft + li.offsetWidth / 2 - row.clientWidth / 2,
		behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto'
	});
}

// The copy of a title closest to the middle of the row: scrolling to it is always the short way
// round, and when the scroll ends normalizeLoop() swaps in the real middle copy.
function nearestLi(key) {
	const row = $('shelfRow');
	const center = row.scrollLeft + row.clientWidth / 2;
	let best = null, bestDist = Infinity;
	row.querySelectorAll(':scope > li[data-key="' + key + '"]').forEach(li => {
		const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - center);
		if (d < bestDist) {
			bestDist = d;
			best = li;
		}
	});
	return best;
}

function normalizeLoop() {
	const s = state.shelf;
	if (!s.looping || !s.setWidth) return;
	const row = $('shelfRow');
	const first = realLi(s.keys[0]);
	if (!first) return;
	const start = first.offsetLeft - 9; // half the gap before the middle copy
	let center = row.scrollLeft + row.clientWidth / 2;
	while (center < start) {
		row.scrollLeft += s.setWidth;
		center += s.setWidth;
	}
	while (center >= start + s.setWidth) {
		row.scrollLeft -= s.setWidth;
		center -= s.setWidth;
	}
}

function updateCenter(force) {
	const row = $('shelfRow');
	const center = row.scrollLeft + row.clientWidth / 2;
	const reach = row.clientWidth * 0.6;
	let best = null, bestDist = Infinity;
	row.querySelectorAll(':scope > li[data-key]').forEach(li => {
		const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - center);
		if (d < bestDist) {
			bestDist = d;
			best = li;
		}
		li.style.setProperty('--d', Math.min(1, d / reach).toFixed(3));
	});
	row.querySelectorAll(':scope > li.is_center').forEach(li => li.classList.remove('is_center'));
	if (!best) {
		renderSpotlight(null);
		return;
	}
	best.classList.add('is_center');
	const key = best.dataset.key;
	if (force || key !== state.shelf.centerKey) {
		state.shelf.centerKey = key;
		renderSpotlight(key);
	}
}

function stepShelf(direction) {
	const row = $('shelfRow');
	const lis = Array.from(row.querySelectorAll(':scope > li[data-key]'));

	// While a smooth scroll is still on its way, step on from where it is heading, so quick
	// presses add up instead of all aiming at the same poster.
	const heading = state.shelf.heading;
	const from = heading && heading.isConnected ? heading : row.querySelector(':scope > li.is_center');
	const index = lis.indexOf(from);
	if (index < 0) return;
	const target = lis[index + direction] || (direction > 0 ? lis[0] : lis[lis.length - 1]);
	state.shelf.heading = reduceMotion.matches ? null : target;
	scrollToLi(target, true);
}

function moveFocus(fromKey, direction) {
	const keys = state.shelf.keys;
	const next = keys[(keys.indexOf(fromKey) + direction + keys.length) % keys.length];
	focusCard(next);
}

function focusCard(key) {
	const li = realLi(key);
	if (li) li.querySelector('.poster_card').focus({ preventScroll: true }); // the focusin handler centres it
}

let shelfFrame = 0, scrollEndTimer = 0;

function onShelfScroll() {
	state.shelf.lastScroll = performance.now();
	cancelLongPress(); // a swipe is not a long-press
	if (!shelfFrame) {
		shelfFrame = requestAnimationFrame(() => {
			shelfFrame = 0;
			updateCenter(false);
		});
	}
	if (!('onscrollend' in window)) {
		clearTimeout(scrollEndTimer);
		scrollEndTimer = setTimeout(onShelfScrollEnd, 150);
	}
}

function onShelfScrollEnd() {
	if (drag.down) return; // still dragging: onDragMove looks after the loop
	state.shelf.heading = null;
	if ($('shelfRow').classList.contains('is_dragging')) {
		settleAfterDrag();
		return;
	}
	normalizeLoop();
	updateCenter(false);
}



// M. Dragging the posters, and taking one off the list
// Touch screens swipe natively, so dragging is for mice (and pens). A press that moves more than
// DRAG_START_PX is a drag; anything less is still a click. Letting go throws the row on a little
// in the direction you were moving, then it settles on the nearest poster.
// The red × shows on hover, on keyboard focus (or press Delete), or after holding a poster for
// half a second on a touch screen. It always asks first.

const DRAG_START_PX = 6;
const THROW_MS = 260;
const LONG_PRESS_MS = 520;
const drag = { down: false, moving: false, pointerId: null, startX: 0, startScroll: 0, lastX: 0, lastT: 0, speed: 0 };
const press = { timer: 0, x: 0, y: 0, suppressClick: false, downAt: -1e9, downCard: null };

function cancelLongPress() {
	clearTimeout(press.timer);
	press.timer = 0;
}

function hideRemoveButtons() {
	$('shelfRow').querySelectorAll(':scope > li.show_remove').forEach(li => li.classList.remove('show_remove'));
}

function onShelfPointerDown(e) {
	press.suppressClick = false;
	press.downAt = performance.now();
	press.downCard = e.target.closest('.poster_card');
	if (e.pointerType !== 'touch') return;
	const card = e.target.closest('.poster_card');
	if (!card) return;
	press.x = e.clientX;
	press.y = e.clientY;
	cancelLongPress();
	press.timer = setTimeout(() => {
		press.timer = 0;
		hideRemoveButtons();
		card.parentElement.classList.add('show_remove');
		press.suppressClick = true; // lifting the finger must not also open the details
		if (navigator.vibrate) navigator.vibrate(12);
	}, LONG_PRESS_MS);
}

function onShelfPointerMove(e) {
	if (press.timer && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelLongPress();
}

function onDragDown(e) {
	if (e.pointerType === 'touch' || e.button !== 0) return;
	drag.down = true;
	drag.moving = false;
	drag.pointerId = e.pointerId;
	drag.startX = drag.lastX = e.clientX;
	drag.startScroll = $('shelfRow').scrollLeft;
	drag.lastT = performance.now();
	drag.speed = 0;
}

function onDragMove(e) {
	if (!drag.down || e.pointerId !== drag.pointerId) return;

	// The button came up somewhere we didn't hear about (over a dialog, outside the window).
	if (!(e.buttons & 1)) {
		onDragUp(e);
		return;
	}
	const row = $('shelfRow');
	const dx = e.clientX - drag.startX;
	if (!drag.moving) {
		if (Math.abs(dx) < DRAG_START_PX) return;
		drag.moving = true;
		row.classList.add('is_dragging');
		try {
			row.setPointerCapture(e.pointerId);
		} catch (error) { /* the pointer already went away */ }
		state.shelf.heading = null;
		hideRemoveButtons();
	}
	const now = performance.now();
	const instant = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
	drag.speed = drag.speed * 0.6 + instant * 0.4;
	drag.lastX = e.clientX;
	drag.lastT = now;
	row.scrollLeft = drag.startScroll - dx;

	// Past the edge of the middle copy the row jumps by one copy (it looks identical), so the
	// drag's starting point jumps with it.
	const before = row.scrollLeft;
	normalizeLoop();
	drag.startScroll += row.scrollLeft - before;
}

function onDragUp(e) {
	if (!drag.down || e.pointerId !== drag.pointerId) return;
	drag.down = false;
	if (!drag.moving) return;
	drag.moving = false;

	// The release ends a drag; it isn't a click on whatever poster is under the pointer now.
	press.suppressClick = true;
	setTimeout(() => {
		press.suppressClick = false;
	}, 0);
	const row = $('shelfRow');
	const recent = performance.now() - drag.lastT < 80; // a pause before letting go means no throw
	const aim = row.scrollLeft - (recent ? drag.speed * THROW_MS : 0) + row.clientWidth / 2;
	let best = null, bestDist = Infinity;
	row.querySelectorAll(':scope > li[data-key]').forEach(li => {
		const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - aim);
		if (d < bestDist) {
			bestDist = d;
			best = li;
		}
	});
	if (!best) {
		row.classList.remove('is_dragging');
		return;
	}
	scrollToLi(best, true);
	if (reduceMotion.matches || Math.abs(best.offsetLeft + best.offsetWidth / 2 - row.scrollLeft - row.clientWidth / 2) < 2)
		settleAfterDrag();
}

function settleAfterDrag() {
	$('shelfRow').classList.remove('is_dragging');
	normalizeLoop();
	updateCenter(false);
}

// What the confirm dialog will do when its red button is pressed.
let confirmAction = null;

function askConfirm(options) {
	confirmAction = options.action;
	$('confirmArt').innerHTML = options.art || '';
	$('confirmTitle').textContent = options.title;
	$('confirmText').textContent = options.text;
	$('confirmYes').innerHTML = options.yes;
	$('confirmYes').disabled = false;
	$('confirmKeep').textContent = options.keep || 'Keep it';
	$('confirmError').hidden = true;
	openDialog($('confirmDialog'));
	$('confirmKeep').focus(); // the safe choice has focus, so a stray Enter changes nothing
}

function askRemove(key, fromKeyboard) {
	hideRemoveButtons();
	const t = titleByKey(key);
	if (!t) return;
	const voters = votersOf(key).map(memberName);
	askConfirm({
		art: miniPoster(t, 'w185'),
		title: 'Remove ' + t.info.title + '?',
		text: 'It comes off the Master List for all four of you. ' +
			(voters.length
				? 'Its ' + plural(voters.length, 'vote') + ' go' + (voters.length === 1 ? 'es' : '') + ' back to ' + joinList(voters) + '.'
				: 'Nobody has voted for it yet.') +
			' You can add it again later with the + button.',
		yes: icon('trash') + ' Remove',
		action: () => closeDialog($('confirmDialog'), () => finishRemove(key, fromKeyboard))
	});
}

function finishRemove(key, fromKeyboard) {
	// The poster shrinks away, then the row closes the gap and its neighbour takes the middle.
	const t = titleByKey(key);
	const keys = state.shelf.keys;
	const neighbour = keys.length > 1 ? keys[(keys.indexOf(key) + 1) % keys.length] : null;
	$('shelfRow').querySelectorAll(':scope > li[data-key="' + key + '"]').forEach(li => li.classList.add('is_removing'));
	setTimeout(() => {
		if (neighbour && neighbour !== key) state.shelf.centerKey = neighbour;
		state.store.putTitle(key, { status: 'removed' });
		state.store.dropVotesFor(key);
		if (club.tieWinner === key) state.store.putState({ tieWinner: null });
		if (fromKeyboard && neighbour) focusCard(neighbour);
		if (t) toast(t.info.title + ' is off the Master List.');
	}, reduceMotion.matches ? 0 : 280);
}



// N. The spotlight: whichever poster sits in the middle

function renderSpotlight(key) {
	const t = key ? titleByKey(key) : null;
	$('spotlight').hidden = !t;
	if (!t) return;
	const info = t.info;
	const voted = Boolean(state.memberId) && votersOf(key).includes(state.memberId);
	const aside = asideFor(t);
	$('spotKicker').textContent = (info.source === 'custom' ? 'Custom ' + typeLabel(info).toLowerCase() : typeLabel(info)) +
		', ' + yearText(info) + ', ' + (info.episodic ? formatFormat(info) : formatLength(info));
	$('spotTitle').textContent = info.title;
	const n = voteCount(key);
	$('spotMeta').innerHTML = badgeHtml(comfortOf(key).result) +
		(aside ? '<span class="badge aside">' + icon('moon') + 'Set aside: ' + esc(aside.long) + '</span>' : '') +
		whereChipHtml(info.availability) +
		(info.episodic && (t.progress || info.episodes) ? '<span class="where_chip">' + icon('tv', 'small') + esc(progressText(t)) + '</span>' : '') +
		(info.genres.length ? '<span>' + esc(info.genres.slice(0, 3).join(', ')) + '</span>' : '') +
		'<span class="voters">' + voterStickers(key) + '</span><span>' + plural(n, 'vote') + '</span>';
	const vote = $('spotVote');
	vote.innerHTML = voted ? icon('check') + ' Voted' : 'Vote for this';
	vote.classList.toggle('is_on', voted);
	vote.setAttribute('aria-pressed', String(voted));
	$('spotTrailer').disabled = !info.videos.length && info.full;
}

// Where to watch, in short. "Available" means on a streaming plan (or free) in at least one of
// the club's countries; whoever has it can host. The data says nothing about screen sharing.
function regionsWith(av, kind) {
	return CLUB_REGIONS.filter(r => av.regions[r.tmdb] && av.regions[r.tmdb][kind].length);
}

function allRegionsText() {
	return joinList(CLUB_REGIONS.map(r => r.label), 'or');
}

function whereMatch(av) {
	if (!av || !av.regions) return 'unknown';
	if (regionsWith(av, 'stream').length) return 'stream';
	if (regionsWith(av, 'rentBuy').length) return 'rent';
	return 'none';
}

function whereShort(av) {
	const match = whereMatch(av);
	if (match === 'stream') return 'Streams in ' + joinList(regionsWith(av, 'stream').map(r => r.label));
	if (match === 'rent') return 'Rent or buy in ' + joinList(regionsWith(av, 'rentBuy').map(r => r.label));
	if (match === 'none') return 'Not streaming in ' + allRegionsText();
	return '';
}

function providerNames(list, max) {
	return list.slice(0, max).map(p => esc(p.name)).join(', ') + (list.length > max ? ' +' + (list.length - max) : '');
}

// One line for a search result, e.g. "MY Netflix · NL Netflix, Disney+ · UK —".
function whereLine(av) {
	const match = whereMatch(av);
	if (match === 'unknown') return 'No streaming data for this title';
	if (match === 'none') return 'Not streaming, renting or selling in ' + allRegionsText();
	const kind = match === 'stream' ? 'stream' : 'rentBuy';
	return (match === 'stream' ? '' : 'Rent or buy: ') + CLUB_REGIONS.map(r => {
		const list = av.regions[r.tmdb] ? av.regions[r.tmdb][kind] : [];
		return '<b>' + r.label + '</b> ' + (list.length ? providerNames(list, 2) : '—');
	}).join(' · ');
}

function whereChipHtml(av) {
	const match = whereMatch(av);
	if (match === 'unknown') return '';
	const glyph = { stream: 'tv', rent: 'ticket', none: 'close' }[match];
	return '<span class="where_chip is_' + match + '">' + icon(glyph, 'small') + esc(whereShort(av)) + '</span>';
}

function voterStickers(key) {
	return votersOf(key).map(id =>
		'<span class="sticker st_' + id + '" role="img" aria-label="' + esc(memberName(id)) + '"></span>'
	).join('');
}



// O. Adding titles: search, results and custom titles
// The + button opens one dialog with its own search box. The page behind it is locked, so only
// the results scroll, and "More results" sits at the very end of the list. "Add a custom title"
// swaps the same dialog over to a short form, with whatever you typed already in it.
//
// Typing doesn't send a request on every key: it waits for a pause, and only once there are three
// letters. Typing on without a pause still searches every four letters, so long titles show results
// on the way, and Enter searches straight away. A newer search cancels the one in flight. Results
// arrive at once, then four workers fill in each card's details.

const SEARCH_PAUSE_MS = 450;
const SEARCH_MIN_CHARS = 3;
const SEARCH_EVERY_CHARS = 4;
const search = { query: '', page: 1, totalPages: 0, controller: null, token: 0, note: '', asked: null, results: new Map(), timer: 0 };

function showAddView(view) {
	$('addSearchView').hidden = view !== 'search';
	$('customForm').hidden = view !== 'custom';
}

function openAdd() {
	showAddView('search');
	openDialog($('addDialog'));
	$('addInput').focus();
	if (!$('addInput').value.trim()) {
		search.asked = null;
		$('addList').innerHTML = '';
		renderAddHint();
	}
}

function renderAddHint() {
	const key = Boolean(tmdbKey());
	$('addStatus').innerHTML = key
		? icon('search', 'small') + '<span>Type a title: films and TV come from TMDB, anime from AniList, both at once.</span>'
		: icon('key', 'small') + '<span>Searching AniList (anime) only. Add your own TMDB key in Settings to find films and TV too.</span>' +
			'<button class="gel_white small_btn" data-open-settings>' + icon('gear', 'small') + ' Settings</button>';
}

// now: search at once (Enter). Otherwise wait for the typing to settle.
function renderAddList(now) {
	clearTimeout(search.timer);
	const query = $('addInput').value.trim();
	if (now) {
		searchCatalogue(1);
		return;
	}
	if (query === search.asked) return; // the same words as the last search: nothing new to ask
	if (!query) {
		if (search.controller) search.controller.abort();
		search.asked = null;
		$('addList').innerHTML = '';
		renderAddHint();
		return;
	}
	if (query.length < SEARCH_MIN_CHARS) {
		$('addStatus').innerHTML = icon('search', 'small') + '<span>Keep typing: the search starts at ' + SEARCH_MIN_CHARS +
			' letters. Press Enter to search for "' + esc(query) + '" now.</span>';
		return;
	}
	const change = Math.abs(query.length - (search.asked || '').length); // backspaces count too
	if (change >= SEARCH_EVERY_CHARS) {
		searchCatalogue(1);
		return;
	}
	search.timer = setTimeout(() => searchCatalogue(1), SEARCH_PAUSE_MS);
}

// Searches TMDB (films and TV) and AniList (anime) at the same time. Either one can fail without
// sinking the other. Anime both of them know are shown once, as the TMDB entry.
async function catalogueSearch(query, page, signal) {
	const haveKey = Boolean(tmdbKey());
	const [movieSide, animeSide] = await Promise.allSettled([
		haveKey ? tmdb('/search/multi', { query, page, include_adult: 'false' }, signal) : Promise.resolve(null),
		anilistSearch(query, page, signal)
	]);
	[movieSide, animeSide].forEach(side => {
		if (side.status === 'rejected' && side.reason && side.reason.name === 'AbortError') throw side.reason;
	});
	if (movieSide.status === 'rejected' && animeSide.status === 'rejected') throw movieSide.reason;

	const tmdbJson = movieSide.status === 'fulfilled' ? movieSide.value : null;
	const fromTmdb = tmdbJson
		? tmdbJson.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').map(t => ({
			key: 'tmdb-' + t.media_type + '-' + t.id,
			info: infoFromTmdb(t, t.media_type, false)
		}))
		: [];
	const known = new Set();
	fromTmdb.forEach(r => {
		known.add(normTitle(r.info.title));
		if (r.info.originalTitle) known.add(normTitle(r.info.originalTitle));
	});
	const fromAnilist = animeSide.status === 'fulfilled'
		? animeSide.value.media
			.filter(a => ![a.title.english, a.title.romaji, a.title.native].some(t => t && known.has(normTitle(t))))
			.map(a => ({ key: 'anilist-' + a.id, info: infoFromAnilist(a, false) }))
		: [];

	// An exact title match comes first, whichever catalogue found it.
	const wanted = normTitle(query);
	const all = fromTmdb.concat(fromAnilist);
	const exact = all.filter(r => normTitle(r.info.title) === wanted || (r.info.originalTitle && normTitle(r.info.originalTitle) === wanted));
	const results = exact.concat(all.filter(r => !exact.includes(r)));
	const anilistMore = animeSide.status === 'fulfilled' && animeSide.value.hasNext;
	const note = !haveKey
		? ''
		: movieSide.status === 'rejected'
		? 'TMDB did not answer (' + movieSide.reason.message + '), so these are from AniList only.'
		: animeSide.status === 'rejected'
		? 'AniList did not answer (' + animeSide.reason.message + '), so these are from TMDB only.'
		: '';
	return {
		results,
		page,
		totalPages: Math.max(tmdbJson ? tmdbJson.total_pages : 0, anilistMore ? page + 1 : page),
		note
	};
}

function resultButtonHtml(key) {
	const t = titleByKey(key);
	if (t && t.status === 'listed') return '<button class="gel_white" disabled>' + icon('check', 'small') + ' On the list</button>';
	if (t && t.status === 'watched') return '<button class="gel" data-add="' + key + '">Add again</button>';
	return '<button class="gel" data-add="' + key + '">' + icon('plus', 'small') + ' Add</button>';
}

function resultHtml(r) {
	const info = r.info;
	const t = titleByKey(r.key);
	return '<li class="result" data-result="' + r.key + '" data-source="' + info.source + '" data-pending>' +
		'<span class="mini_poster">' + posterArt(info, 'w154') + '</span>' +
		'<span class="result_info"><b>' + esc(info.title) + '</b>' +
		'<small>' + (info.year || 'Year unknown') + ', ' + typeLabel(info) +
		(info.genres.length ? ', ' + esc(info.genres.slice(0, 3).join(', ')) : '') + sourceChip(info) + '</small>' +
		(t && t.status === 'watched' ? '<small>' + icon('ticket', 'small') + ' Already in the watch history</small>' : '') +
		'<small data-extra>Checking details…</small>' +
		'<small class="result_where" data-where>Checking where it streams…</small>' +
		'<span class="chips result_hints" data-hints></span></span>' +
		resultButtonHtml(r.key) +
		'</li>';
}

function fillResultDetails(key, info) {
	const card = $('addList').querySelector('[data-result="' + key + '"]');
	if (!card) return;
	const bits = [info.episodic ? formatFormat(info) : (info.runtime ? formatMinutes(info.runtime) : 'Runtime unknown'), certText(info)];
	if (info.ratings[0]) bits.push(formatRating(info.ratings[0]));
	card.querySelector('[data-extra]').innerHTML = bits.join(', ');
	const hints = hintsFor(info);
	card.querySelector('[data-hints]').innerHTML = hints.length
		? hints.map(h => '<span class="chip hint">' + esc(h.from) + ' ' + icon('arrow_right', 'small') + ' ' + HINT_LABELS[h.key] + '</span>').join('')
		: '<span class="fine">No comfort tags</span>';
	card.querySelector('[data-where]').innerHTML = info.source === 'anilist'
		? (info.anilistStreams.length ? 'AniList lists: ' + esc(joinList(info.anilistStreams)) : 'No streaming sites listed')
		: whereLine(info.availability);
	card.removeAttribute('data-pending');
}

function markResultFailed(key, message) {
	const card = $('addList').querySelector('[data-result="' + key + '"]');
	if (!card) return;
	card.querySelector('[data-extra]').textContent = 'Details failed: ' + message;
	card.querySelector('[data-where]').textContent = 'Could not check where it streams';
	card.removeAttribute('data-pending');
}

function updateAddStatus() {
	const cards = Array.from($('addList').querySelectorAll('.result'));
	const total = cards.length;
	const pending = cards.filter(c => c.hasAttribute('data-pending')).length;
	const anime = cards.filter(c => c.dataset.source === 'anilist').length;
	$('addStatus').innerHTML = icon('search', 'small') + '<span>' + plural(total, 'result') +
		(anime && anime < total ? ' (' + (total - anime) + ' from TMDB, ' + anime + ' more from AniList)' : '') +
		(pending ? '. Details ' + (total - pending) + ' of ' + total + ', four at a time…' : ', all details in.') +
		(search.page < search.totalPages ? ' More at the end of the list.' : '') +
		(search.note ? ' ' + esc(search.note) : '') +
		(!tmdbKey() ? ' Anime only: add your TMDB key in Settings for films and TV.' : '') + '</span>';
}

// "More results" is the last item of the list, and only while there is another page.
function renderMoreButton() {
	const old = $('addMoreItem');
	if (old) old.remove();
	if (search.page >= search.totalPages) return;
	$('addList').insertAdjacentHTML(
		'beforeend',
		'<li class="result_more" id="addMoreItem"><button class="gel_white" id="addMore">' + icon('chev_down') + ' More results</button></li>'
	);
}

async function searchCatalogue(page) {
	const query = $('addInput').value.trim();
	if (search.controller) search.controller.abort(); // a newer search makes the old one pointless
	const controller = new AbortController();
	search.controller = controller;
	const token = ++search.token;
	search.query = query;
	if (page === 1) {
		search.asked = query;
		$('addList').innerHTML = '';
		$('addBody').scrollTop = 0;
	}
	if (!query) {
		renderAddHint();
		return;
	}
	const more = $('addMore');
	if (more) {
		more.disabled = true;
		more.textContent = 'Loading more…';
	}
	$('addStatus').innerHTML = icon('search', 'small') + '<span>Searching for "' + esc(query) + '"…</span>';
	try {
		const answer = await catalogueSearch(query, page, controller.signal);
		if (token !== search.token) return;
		search.page = answer.page;
		search.totalPages = answer.totalPages;
		search.note = answer.note || '';
		answer.results.forEach(r => search.results.set(r.key, r.info));
		const fresh = answer.results.filter(r => !$('addList').querySelector('[data-result="' + r.key + '"]'));
		const oldMore = $('addMoreItem');
		if (oldMore) oldMore.remove();
		$('addList').insertAdjacentHTML('beforeend', fresh.map(resultHtml).join(''));
		if (!$('addList').children.length) {
			$('addStatus').innerHTML = icon('search', 'small') + '<span>Nothing found for "' + esc(query) + '"' +
				(tmdbKey() ? ' on TMDB or AniList' : ' on AniList') + '. Try another spelling, or add it as a custom title.' +
				(search.note ? ' ' + esc(search.note) : '') + '</span>';
			return;
		}
		renderMoreButton();
		updateAddStatus();
		await runPool(fresh, 4, async r => {
			try {
				const t = titleByKey(r.key);
				const info = t && t.info.full ? t.info : await fetchFullInfo(r.key, controller.signal);
				if (info) search.results.set(r.key, info);
				if (token === search.token) fillResultDetails(r.key, info || r.info);
			} catch (error) {
				if (error.name === 'AbortError') return;
				if (token === search.token) markResultFailed(r.key, error.message);
			}
			if (token === search.token) updateAddStatus();
		});
	} catch (error) {
		if (error.name === 'AbortError' || token !== search.token) return;
		$('addStatus').innerHTML = icon('warn', 'small') + '<span>The search failed: ' + esc(error.message) + '</span>';
		const again = $('addMore');
		if (again) {
			again.disabled = false;
			again.innerHTML = icon('chev_down') + ' More results';
		}
	}
}

async function addToList(key, button) {
	if (!requireMember(() => addToList(key, button))) return;
	const existing = titleByKey(key);
	if (existing && existing.status === 'listed') return;
	let info = existing && existing.info.full ? existing.info : search.results.get(key);
	if (button) {
		button.disabled = true;
		button.textContent = 'Adding…';
	}
	try {
		if ((!info || !info.full) && canFetch(key)) info = await fetchFullInfo(key);
	} catch (error) {
		if (!info) {
			if (button && button.isConnected) {
				button.disabled = false;
				button.textContent = 'Add';
			}
			toast('Could not add that title: ' + error.message);
			return;
		}
		// The short version from the search is enough for now; the details fill in later.
	}
	const fields = { status: 'listed', order: Date.now(), addedBy: state.memberId, info };
	if (!existing) {
		fields.progress = 0;
		fields.historyOrder = 0;
	}
	state.shelf.centerKey = key;
	state.store.putTitle(key, fields);
	state.refreshed.add(key);
	if (button && button.isConnected) {
		button.className = 'gel_white';
		button.innerHTML = icon('check', 'small') + ' On the list';
	}
	toast(info.title + ' is on the Master List.', state.memberId);
}

function customKind() {
	return $('customForm').querySelector('[name="ctype"]:checked').value;
}

function syncCustomFields() {
	const episodic = customKind().endsWith('series');
	$('cRuntimeLabel').textContent = episodic ? 'Minutes per episode' : 'Runtime in minutes';
	$('cEpisodesField').hidden = !episodic;
}

function openCustom() {
	$('customForm').reset();
	$('cTitle').value = $('addInput').value.trim().slice(0, 120);
	$('customError').hidden = true;
	$('customForm').querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
	$('customBy').textContent = state.memberId ? 'Added by ' + memberName(state.memberId) : '';
	syncCustomFields();
	showAddView('custom');
	fadeIn($('customForm'), 0, 160);
	$('cTitle').focus();
	$('cTitle').select(); // a filled-in title is selected, so typing replaces it
}

// Checks the form the way a server would (validate at the boundary). Returns { fields } or { error, el }.
function readCustomForm() {
	const title = $('cTitle').value.trim().replace(/\s+/g, ' ');
	if (!title) return { error: 'Give it a title.', el: $('cTitle') };
	if (listedTitles().some(t => normTitle(t.info.title) === normTitle(title)))
		return { error: title + ' is already on the Master List.', el: $('cTitle') };
	const kind = customKind();

	// Digits only: "-.e", "1e3" or "12.5" are turned down with a message, never quietly dropped.
	const whole = (el, min, max, what) => {
		const raw = el.value.trim();
		if (!raw) return { value: null };
		const n = /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
		return n >= min && n <= max
			? { value: n }
			: { error: what + ' has to be a whole number from ' + min + ' to ' + max + ', digits only.', el };
	};
	const year = whole($('cYear'), 1888, 2100, 'The year');
	if (year.error) return year;
	const runtime = whole($('cRuntime'), 1, 999, kind.endsWith('series') ? 'Minutes per episode' : 'The runtime');
	if (runtime.error) return runtime;
	const episodes = kind.endsWith('series') ? whole($('cEpisodes'), 1, 5000, 'Episodes') : { value: null };
	if (episodes.error) return episodes;
	return { fields: { title, kind, year: year.value, runtime: runtime.value, episodes: episodes.value } };
}

function saveCustom() {
	$('customForm').querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
	const form = readCustomForm();
	if (form.error) {
		$('customError').innerHTML = icon('warn') + '<span>' + esc(form.error) + '</span>';
		$('customError').hidden = false;
		form.el.setAttribute('aria-invalid', 'true');
		form.el.focus();
		return;
	}
	if (!requireMember(saveCustom)) return;
	const key = 'custom-' + randomLetters(10);
	state.store.putTitle(key, {
		status: 'listed',
		order: Date.now(),
		addedBy: state.memberId,
		progress: 0,
		historyOrder: 0,
		info: customInfo(form.fields)
	});
	state.shelf.centerKey = key;
	$('addInput').value = '';
	search.asked = null;
	$('addList').innerHTML = '';
	closeDialog($('addDialog'), () => {
		showAddView('search');
		focusCard(key);
	});
	toast(form.fields.title + ' is on the Master List as a custom title.', state.memberId);
}



// P. Votes and the tie-break
// Three votes each, on titles on the Master List. The leader (and any tie) only counts titles
// that suit tonight, so a show waiting for someone can't win a night they're away.

function picksOf(memberId) {
	return (club.votes[memberId] || []).filter(isListed).slice(0, VOTES_PER_MEMBER);
}

function votersOf(key) {
	return MEMBER_IDS.filter(id => picksOf(id).includes(key));
}

function voteCount(key) {
	return votersOf(key).length;
}

function votesLeft(memberId) {
	return VOTES_PER_MEMBER - picksOf(memberId).length;
}

function contenders() {
	return listedTitles().filter(suitsTonight);
}

function topTie() {
	const list = contenders();
	let top = 0;
	list.forEach(t => {
		top = Math.max(top, voteCount(t.key));
	});
	if (!top) return [];
	const tied = list.filter(t => voteCount(t.key) === top);
	return tied.length > 1 ? tied : [];
}

function leaderKey() {
	const tied = topTie();
	if (tied.length) return tied.some(t => t.key === club.tieWinner) ? club.tieWinner : null;
	let best = null, bestCount = 0;
	contenders().forEach(t => {
		const n = voteCount(t.key);
		if (n > bestCount) {
			best = t.key;
			bestCount = n;
		}
	});
	return best;
}

function toggleVote(key) {
	if (!requireMember(() => toggleVote(key))) return;
	const t = titleByKey(key);
	if (!t || t.status !== 'listed') return;
	const me = state.memberId;
	const picks = picksOf(me);
	const on = !picks.includes(key);
	if (on && picks.length >= VOTES_PER_MEMBER) {
		toast(memberName(me) + ' has no votes left. Take one back from another title first.', me);
		announce(memberName(me) + ' has no votes left.');
		return;
	}
	const next = on ? picks.concat(key) : picks.filter(k => k !== key);
	club.votes[me] = next; // straight away, so a quick second tap counts from here
	state.store.putVotes(me, next);
	toast(on ? memberName(me) + ' voted for ' + t.info.title + '.' : memberName(me) + ' took back a vote for ' + t.info.title + '.', me);
}

function renderVoteLead(tied) {
	const box = $('votesLead');
	box.classList.remove('is_tie');
	if (shelfLoading()) {
		box.innerHTML = '<p class="empty_note lead_empty">' + art('popcorn_empty') + 'Counting votes…</p>';
		return;
	}
	const leader = leaderKey();
	if (tied.length && !leader) {
		box.classList.add('is_tie');
		box.innerHTML = '<div class="lead_tie">' + tied.slice(0, 3).map(t =>
			'<span class="lead_art"><span class="lead_poster">' + posterArt(t.info, 'w342') + '</span></span>'
		).join('<span class="vs" aria-hidden="true">vs</span>') + '</div>' +
			'<div><p class="lead_kicker">It\'s a draw</p>' +
			'<h3 class="lead_title rimmed">' + joinList(tied.map(t => esc(t.info.title))) + '</h3>' +
			'<div class="lead_meta"><span>Level on ' + plural(voteCount(tied[0].key), 'vote') + ' each. Let the wheel settle it.</span></div>' +
			'<div class="lead_actions"><button class="start_pill rimmed" data-tie-spin>' + icon('wheel') + ' Spin to break the tie</button></div></div>';
		return;
	}
	if (!leader) {
		const asideVotes = listedTitles().some(t => voteCount(t.key) && !suitsTonight(t));
		box.innerHTML = '<p class="empty_note lead_empty">' + sticker('mayseph', 'boil') + '<span>' + (asideVotes
			? 'The titles with votes are set aside tonight. Vote for something that suits tonight.'
			: 'No votes yet. Vote from the Master List above, three each.') + '</span></p>';
		return;
	}
	const t = titleByKey(leader);
	box.innerHTML = '<span class="lead_art"><span class="lead_poster">' + posterArt(t.info, 'w342') + '</span>' + art('crown', 'crown') + '</span>' +
		'<div><p class="lead_kicker">' + (tied.length ? 'Won the tie' : 'Leading tonight') + '</p>' +
		'<h3 class="lead_title rimmed">' + esc(t.info.title) + '</h3>' +
		'<div class="lead_meta">' + badgeHtml(comfortOf(leader).result) +
		'<span>' + voteCount(leader) + ' of ' + MEMBERS.length + ' members</span><span class="voters">' + voterStickers(leader) + '</span></div>' +
		'<div class="lead_actions"><button class="start_pill rimmed" data-lead-open="' + leader + '">Open details</button>' +
		'<button class="gel_white" data-lead-trailer="' + leader + '">' + icon('play') + ' Trailer</button></div>' +
		'</div>';
}

function renderVotes() {
	$('votePills').innerHTML = MEMBERS.map(m =>
		'<li class="vote_pill m_' + m.id + (m.id === state.memberId ? ' is_you' : '') + '">' +
		sticker(m.id) +
		'<span class="vote_text"><b>' + votesLeft(m.id) + ' left</b><small>' + esc(m.name) +
		(m.id === state.memberId ? ' (you)' : '') + '</small></span></li>'
	).join('');
	const tied = topTie();
	renderVoteLead(tied);
	const box = $('drawBox');
	const winner = tied.length ? leaderKey() : null;
	box.innerHTML = winner
		? '<div class="draw_box"><p><b>Tie broken.</b> The wheel picked ' + esc(titleByKey(winner).info.title) + ' out of ' +
			joinList(tied.map(t => esc(t.info.title))) + '.</p><button class="gel_white" data-tie-spin>' + icon('wheel') + ' Spin again</button></div>'
		: '';
	renderBallot();
}

// The ballot: every title on the Master List, most votes first. Voting here and on the posters
// changes the same votes, so both always agree.
function renderBallot() {
	const leader = leaderKey();
	const me = state.memberId;
	$('ballotNote').textContent = me ? memberName(me) + ': ' + plural(votesLeft(me), 'vote') + ' left' : 'Pick who you are to vote';
	const listed = listedTitles();
	const ranked = listed.slice().sort((a, b) =>
		(b.key === leader) - (a.key === leader) || voteCount(b.key) - voteCount(a.key) || a.info.title.localeCompare(b.info.title)
	);
	if (!ranked.length) {
		$('ballot').innerHTML = '<li class="fine">' + (shelfLoading() ? 'Loading…' : 'The Master List is empty. Add a title with the + button.') + '</li>';
		return;
	}
	$('ballot').innerHTML = ranked.map(t => {
		const n = voteCount(t.key);
		const rank = t.key === leader ? art('crown') : n ? 1 + listed.filter(o => voteCount(o.key) > n).length : '–';
		const mine = Boolean(me) && votersOf(t.key).includes(me);
		const aside = asideFor(t);
		return '<li class="ballot_row' + (mine ? ' is_mine' : '') + (aside ? ' is_aside' : '') + '">' +
			'<span class="rank" aria-hidden="true">' + rank + '</span>' +
			miniPoster(t, 'w92') +
			'<span class="ballot_main"><button class="ballot_title" data-ballot-open="' + t.key + '">' + esc(t.info.title) +
			(aside ? '<span class="sr_only">, set aside tonight: ' + esc(aside.long) + '</span>' : '') + '</button>' +
			'<span class="bar" aria-hidden="true">' + MEMBERS.map(m =>
				'<span class="m_' + m.id + (votersOf(t.key).includes(m.id) ? ' on' : '') + '"></span>'
			).join('') + '</span></span>' +
			'<span class="count">' + (aside ? icon('moon', 'small') + ' ' : '') + plural(n, 'vote') + '</span>' +
			'<button class="gel_pink' + (mine ? ' is_on' : '') + '" data-ballot-vote="' + t.key + '" aria-pressed="' + mine +
			'" aria-label="' + (mine ? 'Take back your vote for ' : 'Vote for ') + esc(t.info.title) + ', ' + plural(n, 'vote') + ' so far">' +
			(mine ? icon('check', 'small') + ' Voted' : 'Vote') + '</button>' +
			'</li>';
	}).join('');
}




// Q. Details: everything about one title

function openDetails(key, tab) {
	const t = titleByKey(key);
	if (!t) return;
	state.openKey = key;
	renderFocusHead();
	renderFocusBar();
	selectTab(tab || 'details', false);
	openDialog($('detailsDialog'));
	$(state.activeTab + 'Tab').focus({ preventScroll: true });
	ensureDetails(key);
}

// Fetches a title's full details when they are missing or a week old, and saves them with the
// title, so everyone in the club sees them. One request per title, however many ask at once.
const detailRequests = new Map();

function ensureDetails(key) {
	const t = titleByKey(key);
	if (!t || !canFetch(key) || state.refreshed.has(key) || !infoIsStale(t)) return Promise.resolve(t ? t.info : null);
	if (detailRequests.has(key)) return detailRequests.get(key);
	const request = fetchFullInfo(key)
		.then(info => {
			state.refreshed.add(key);
			if (info && titleByKey(key)) state.store.putTitle(key, { info });
			return info;
		})
		.catch(error => {
			state.refreshed.add(key); // no retrying in a loop: the next visit tries again
			if (state.openKey === key && $('detailsDialog').open) announce('The details could not load: ' + error.message);
			return null;
		})
		.finally(() => detailRequests.delete(key));
	detailRequests.set(key, request);
	return request;
}

function renderFocusHead() {
	const t = titleByKey(state.openKey);
	if (!t) return;
	const info = t.info;
	const bg = backdropUrl(info);
	const aside = t.status === 'listed' ? asideFor(t) : null;
	$('focusHead').style.backgroundImage = bg
		? 'linear-gradient(90deg, rgba(4, 6, 13, .96) 30%, rgba(4, 6, 13, .55)), url("' + bg + '")'
		: '';
	$('focusHead').innerHTML = miniPoster(t, 'w185') +
		'<div><p class="kicker">' + typeLabel(info) + ', ' + yearText(info) + (info.cert ? ', rated ' + certText(info) : '') + '</p>' +
		'<h2 class="focus_title rimmed" id="focusTitle">' + esc(info.title) + '</h2>' +
		(info.originalTitle ? '<p class="fine">Original title: ' + esc(info.originalTitle) + '</p>' : '') +
		'<div class="focus_badges">' + badgeHtml(comfortOf(t.key).result) +
		(aside ? '<span class="badge aside">' + icon('moon') + 'Set aside tonight</span>' : '') +
		(t.status === 'watched' ? '<span class="badge aside">' + icon('ticket') + 'In the watch history</span>' : '') +
		'</div></div>';
}

function renderFocusBar() {
	const t = titleByKey(state.openKey);
	const button = $('focusVote');
	if (!t) return;
	if (t.status !== 'listed') {
		button.hidden = true;
		$('focusNote').textContent = t.status === 'watched' ? 'In the watch history' : 'Not on the Master List';
		return;
	}
	button.hidden = false;
	if (!state.memberId) {
		button.innerHTML = 'Vote for this';
		button.classList.remove('is_on');
		button.setAttribute('aria-pressed', 'false');
		$('focusNote').textContent = 'Pick who you are to vote';
		return;
	}
	const voted = votersOf(t.key).includes(state.memberId);
	button.innerHTML = voted ? icon('check') + ' Voted' : 'Vote for this';
	button.classList.toggle('is_on', voted);
	button.setAttribute('aria-pressed', String(voted));
	$('focusNote').textContent = voted
		? 'Press again to take your vote back'
		: memberName(state.memberId) + ' has ' + plural(votesLeft(state.memberId), 'vote') + ' left';
}

function selectTab(name, moveFocus) {
	state.activeTab = name;
	document.querySelectorAll('#detailsDialog [role="tab"]').forEach(tab => {
		const on = tab.dataset.tab === name;
		tab.setAttribute('aria-selected', String(on));
		tab.tabIndex = on ? 0 : -1;
		$(tab.dataset.tab + 'Panel').hidden = !on;
	});
	renderPanel(name);
	if (moveFocus) $(name + 'Tab').focus();
}

function renderPanel(name) {
	const t = titleByKey(state.openKey);
	if (!t) return;
	if (name === 'details') $('detailsPanel').innerHTML = detailsHtml(t);
	if (name === 'fit') $('fitPanel').innerHTML = fitPanelHtml(t);
	if (name === 'safe') renderQuiz(null);
}

// The club's own row: "we watched it", or how far through a show the club is.
function clubRowHtml(t) {
	const info = t.info;
	if (t.status === 'watched') {
		return '<div class="club_row"><div class="what">' + art('history') +
			'<div><b>In the watch history</b><span class="fine">' + esc(wordsSummary(t)) + '</span></div></div>' +
			'<div class="acts"><button class="gel_white" data-history-open="' + t.key + '">' + icon('ticket') + ' Watch history</button>' +
			'<button class="gel" data-put-back="' + t.key + '">' + icon('undo') + ' Put it back on the list</button></div></div>';
	}
	if (!info.episodic) {
		return '<div class="club_row"><div class="what">' + art('history') +
			'<div><b>Watched it together?</b><span class="fine">It moves to the watch history, where everyone says what they thought.</span></div></div>' +
			'<div class="acts"><button class="gel" data-watched="' + t.key + '">' + icon('check') + ' We watched it</button></div></div>';
	}
	const done = showFinished(t);
	return '<div class="club_row"><div class="what">' + art('tracker') +
		'<div><b>' + esc(progressText(t)) + '</b>' +
		(info.episodes ? '<span class="progress_bar" aria-hidden="true"><i style="width:' + (progressShare(t) * 100).toFixed(1) + '%"></i></span>' : '') +
		'</div></div>' + stepButtonsHtml(t) + '</div>';
}

function stepButtonsHtml(t) {
	const done = showFinished(t);
	const canFinish = done || (!t.info.episodes && t.progress > 0);
	return '<div class="acts">' +
		'<button class="gel_white step_btn" data-step="-1" data-key="' + t.key + '" aria-label="One episode back"' + (t.progress ? '' : ' disabled') + '>' + icon('minus') + '</button>' +
		'<button class="gel" data-step="1" data-key="' + t.key + '"' + (done ? ' disabled' : '') + '>' + icon('plus') + ' 1 episode</button>' +
		(canFinish ? '<button class="gel_pink" data-watched="' + t.key + '">' + icon('check') + ' We finished it</button>' : '') +
		'</div>';
}

function wordsSummary(t) {
	const said = MEMBERS.filter(m => t.words[m.id]).map(m => m.name + ': ' + WORDS.find(w => w.id === t.words[m.id]).label);
	return said.length ? said.join(', ') : 'Nobody has said what they thought yet.';
}

function youtubeWatchUrl(key) {
	return 'https://www.youtube.com/watch?v=' + encodeURIComponent(key);
}

function youtubeSearchUrl(info) {
	return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(info.title + ' ' + (info.year || '') + ' trailer');
}

// Every YouTube video worth showing, the chosen trailer first.
function playableVideos(info) {
	const order = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3 };
	const trailer = pickTrailer(info.videos);
	return info.videos.filter(v => v.type in order || v === trailer)
		.sort((a, b) =>
			(b === trailer) - (a === trailer) || (order[a.type] ?? 9) - (order[b.type] ?? 9) || (b.official - a.official)
		)
		.slice(0, 8);
}

function sceneArt(info) {
	const bg = backdropUrl(info);
	return bg
		? '<span class="poster_art" style="--h:' + info.hue + '"><img class="poster_img" src="' + esc(bg) + '" alt="" loading="lazy"></span>'
		: posterArt(info);
}

function trailerHtml(t) {
	const info = t.info;
	const loading = !info.full && canFetch(t.key);
	if (loading) return '<div class="trailer">' + sceneArt(info) + '<p class="trailer_msg">Loading the trailer…</p></div>';
	const trailer = pickTrailer(info.videos);
	if (!trailer) {
		return '<div class="trailer">' + sceneArt(info) +
			'<p class="trailer_msg">No trailer listed for this title. <a href="' + esc(youtubeSearchUrl(info)) +
			'" target="_blank" rel="noopener">Look one up on YouTube</a></p></div>';
	}
	return '<div class="trailer">' + sceneArt(info) +
		'<button class="play_btn" data-action="trailer" aria-label="Play the trailer: ' + esc(trailer.name || info.title) + '">' + icon('play') + '</button></div>' +
		'<p class="fine trailer_cap">' + esc(trailer.name || 'Trailer') + '. ' +
		(CAN_EMBED_VIDEO ? 'Plays in the built-in player.' : 'Opens the built-in player, which sends it to YouTube from a file on your computer.') + '</p>';
}

// TMDB's own where-to-watch page for a title in one country (it lists every service, with links).
function tmdbWatchUrl(info, region) {
	if (!info.ids.tmdb) return null;
	return 'https://www.themoviedb.org/' + (info.ids.tmdbType === 'tv' ? 'tv' : 'movie') + '/' +
		encodeURIComponent(info.ids.tmdb) + '/watch?locale=' + region;
}

function whereHtml(t) {
	const info = t.info;
	const av = info.availability;
	if (!av || !av.regions) {
		if (info.source === 'custom') return '<p class="fine">A custom title, so there is no streaming data for it.</p>';
		if (info.source === 'anilist') {
			return '<p class="fine">' + (info.anilistStreams.length
				? 'AniList lists these sites, without saying for which countries: ' + esc(joinList(info.anilistStreams)) +
					'. Check they work in ' + allRegionsText() + ' before the night.'
				: 'AniList lists no streaming sites for this title.') + '</p>';
		}
		return '<p class="fine">' + (info.full ? 'TMDB sent no streaming data for this title.' : 'Loading where it streams…') + '</p>';
	}
	const providers = list => list.slice(0, 5).map(p =>
		'<span class="prov">' +
		(p.logo ? '<img class="prov_logo" src="' + esc(TMDB_IMAGES + 'w45' + p.logo) + '" alt="" width="22" height="22" loading="lazy">' : '') +
		esc(p.name) + '</span>'
	).join('') + (list.length > 5 ? '<span class="fine">+' + (list.length - 5) + ' more</span>' : '');
	const rows = CLUB_REGIONS.map(r => {
		const x = av.regions[r.tmdb] || { stream: [], rentBuy: [], link: null };
		const url = x.link || tmdbWatchUrl(info, r.tmdb);
		const body = '<span class="where_region">' + r.label + '</span><div>' +
			(x.stream.length ? '<p>' + providers(x.stream) + '</p>' : '<p class="fine">Not on a streaming plan here</p>') +
			(x.rentBuy.length ? '<p><b>Rent or buy:</b> ' + providers(x.rentBuy) + '</p>' : '') + '</div>';
		return '<li>' + (url
			? '<a class="where_row" href="' + esc(url) + '" target="_blank" rel="noopener">' + body +
				'<span class="go">Open' + icon('external', 'small') + '<span class="sr_only"> where to watch in ' + r.label + ' on TMDB</span></span></a>'
			: '<div class="where_row">' + body + '<span></span></div>') + '</li>';
	}).join('');
	return '<ul class="where_list">' + rows + '</ul><p class="fine" style="margin-top:6px">Streaming data from JustWatch, through TMDB, last checked ' +
		dateFormat.format(new Date(av.checkedAt)) + ". Each row opens that country's page on TMDB. Catalogues change, so check again on the night.</p>";
}

function keywordChipsHtml(info) {
	if (!info.keywords.length) return '<span class="fine">' + (info.full ? 'No keywords listed.' : 'Loading the tags…') + '</span>';
	const hints = hintsFor(info);
	return info.keywords.map(word => {
		const hint = hints.find(h => h.from === word.toLowerCase());
		return hint
			? '<span class="chip hint">' + esc(word) + ' ' + icon('arrow_right', 'small') + ' ' + HINT_LABELS[hint.key] + '</span>'
			: '<span class="chip">' + esc(word) + '</span>';
	}).join('');
}

function sourceLine(t) {
	const info = t.info;
	if (info.source === 'custom') return 'A custom title' + (t.addedBy ? ', added by ' + esc(memberName(t.addedBy)) : '') + '.';
	const from = info.source === 'tmdb' ? 'TMDB' : 'AniList';
	return 'Details from ' + from + ', checked ' + dateFormat.format(new Date(info.checkedAt)) + '.' +
		(t.addedBy ? ' Added by ' + esc(memberName(t.addedBy)) + '.' : '');
}

function detailsHtml(t) {
	const info = t.info;
	const voters = voterStickers(t.key);
	return clubRowHtml(t) +
		'<div class="details_grid">' +
		'<div>' + trailerHtml(t) +
		(t.status === 'listed' ? '<div class="voters_row"><span>Votes:</span>' + (voters || 'none yet') + '</div>' : '') +
		'</div>' +
		'<div><p class="synopsis">' + (info.synopsis ? esc(info.synopsis) : (!info.full && canFetch(t.key) ? 'Loading the details…' : 'No synopsis yet.')) + '</p>' +
		'<dl class="facts">' +
		'<div><dt>Length</dt><dd>' + esc(formatLength(info)) + '</dd></div>' +
		'<div><dt>Format</dt><dd>' + esc(formatFormat(info)) + '</dd></div>' +
		'<div><dt>Certification</dt><dd>' + certText(info) + '</dd></div>' +
		'<div><dt>Seasonal fit</dt><dd>' + (info.seasonTags.length ? esc(info.seasonTags.join(', ')) : 'Not tagged') + '</dd></div>' +
		'</dl>' +
		(info.ratings.length
			? '<h3 class="sub_h">' + icon('star') + ' Ratings</h3><ul class="ratings">' +
				info.ratings.map(r => '<li><b>' + r.source + '</b><span class="score">' + r.value + ' / ' + r.scale + '</span><span class="fine">' + esc(r.note) + '</span></li>').join('') +
				'</ul><p class="fine" style="margin-top:6px">Each source keeps its own score. Ussy never blends them.</p>'
			: '') +
		'<h3 class="sub_h">' + icon('tv') + ' Where to watch</h3>' + whereHtml(t) +
		((info.genres.length || info.seasonTags.length)
			? '<h3 class="sub_h">' + icon('film') + ' Genres and season</h3><div class="chips">' +
				info.genres.map(g => '<span class="chip">' + esc(g) + '</span>').join('') +
				info.seasonTags.map(s => '<span class="chip season">' + esc(s) + '</span>').join('') + '</div>'
			: '') +
		(info.source !== 'custom'
			? '<h3 class="sub_h">' + icon('shield') + ' Tags</h3><p class="fine">Keywords from the catalogue. An arrow marks the ones that suggest a comfort answer; they never decide it.</p>' +
				'<div class="chips" style="margin-top:8px">' + keywordChipsHtml(info) + '</div>'
			: '') +
		'<p class="fine" style="margin-top:16px">' + sourceLine(t) + '</p>' +
		'</div></div>';
}



// R. The trailer player
// A big dialog with YouTube's own player and every video the catalogue lists for the title.
// YouTube only plays inside pages served from a web address (like the club's GitHub Pages
// site); a file opened straight from your computer gets a button to YouTube instead.

const CAN_EMBED_VIDEO = location.protocol === 'https:' || location.protocol === 'http:';

function embedHtml(video) {
	return '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(video.key) +
		'?autoplay=1&rel=0&playsinline=1" title="' + esc(video.name || 'Trailer') + '" ' +
		'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" ' +
		'referrerpolicy="strict-origin-when-cross-origin"></iframe>';
}

async function openPlayer(key, videoKey) {
	const t = titleByKey(key);
	if (!t) return;
	if (!t.info.full && canFetch(key)) {
		toast('Loading the trailer for ' + t.info.title + '…');
		await ensureDetails(key);
	}
	const info = (titleByKey(key) || t).info;
	const videos = playableVideos(info);
	if (!videos.length) {
		toast('No trailer listed for ' + info.title + '.');
		return;
	}
	const current = videos.find(v => v.key === videoKey) || videos[0];
	state.player = { key, video: current.key };
	$('playerTitle').textContent = info.title;
	$('playerYoutube').href = youtubeWatchUrl(current.key);
	$('videoPicks').innerHTML = videos.length > 1
		? videos.map(v =>
			'<button class="pick" data-video="' + esc(v.key) + '" aria-pressed="' + (v.key === current.key) + '">' +
			'<b>' + esc(v.type) + '</b> ' + esc(v.name) + '</button>'
		).join('')
		: '';
	if (CAN_EMBED_VIDEO) {
		$('playerFrame').innerHTML = embedHtml(current);
		$('playerNote').textContent = "Playing in YouTube's own player. The club music waits until you close this.";
		pauseMusicForTrailer();
	} else {
		const bg = backdropUrl(info);
		$('playerFrame').innerHTML = '<div class="player_fallback">' + (bg ? '<img class="poster_img" src="' + esc(bg) + '" alt="">' : '') +
			'<div><p>YouTube won\'t play inside a file opened from your computer. On the club\'s web address it plays right here.</p>' +
			'<a class="gel" href="' + esc(youtubeWatchUrl(current.key)) + '" target="_blank" rel="noopener">' + icon('play') + ' Watch it on YouTube</a></div></div>';
		$('playerNote').textContent = '';
	}
	openDialog($('playerDialog'));

	// Focus starts on the back button, not inside YouTube's player, so Esc still closes it.
	$('playerDialog').querySelector('[data-close]').focus({ preventScroll: true });
}

function closePlayer() {
	$('playerFrame').innerHTML = ''; // removing the iframe stops the video
	state.player = null;
	resumeMusicAfterTrailer();
}



// S. Safe for Mayseph
// One question at a time, like the first proof of concept. Every check is saved with who did it
// and when, older checks stay as history, and Mayseph can make her own call over the questions.
// It is a personal comfort recommendation, not an objective or medical guarantee.

function quizFor(key) {
	if (!state.quizzes.has(key)) state.quizzes.set(key, { screen: 'intro', answers: {}, stack: [], current: null, override: '', saved: false });
	return state.quizzes.get(key);
}

// The next question to ask, or null when the check is finished.
function nextQuestionId(answers) {
	const hardYes = QUESTIONS.some(q => q.hard && answers[q.id] === 'YES' && (!q.parent || answers[q.parent] === 'YES'));
	if (hardYes) return null; // a hard no ends the check early
	for (const q of QUESTIONS) {
		if (q.parent && answers[q.parent] !== 'YES') continue;
		if (!answers[q.id]) return q.id;
	}
	return null;
}

function questionById(id) {
	return QUESTIONS.find(q => q.id === id);
}

function goToNext(z, direction) {
	z.current = nextQuestionId(z.answers);
	z.screen = z.current ? 'question' : 'result';
	renderQuiz(z.screen === 'result' ? 'pop' : direction);
}

function startQuiz() {
	const z = quizFor(state.openKey);
	z.answers = {};
	z.stack = [];
	z.override = '';
	z.saved = false;
	goToNext(z, 'forward');
}

function answerQuestion(value) {
	if (!$('playerDialog').open) resumeMusicAfterTrailer(); // the question's own trailer stops with it
	const z = quizFor(state.openKey);
	if (z.screen !== 'question') return;
	z.answers[z.current] = value;
	z.stack.push(z.current);
	z.saved = false;
	goToNext(z, 'forward');
}

function quizBack() {
	if (!$('playerDialog').open) resumeMusicAfterTrailer();
	const z = quizFor(state.openKey);
	if (!z.stack.length) {
		z.screen = 'intro';
		renderQuiz('back');
		return;
	}
	const last = z.stack.pop();
	delete z.answers[last];
	z.saved = false;
	z.current = last;
	z.screen = 'question';
	renderQuiz('back');
}

function checkHistoryHtml(key) {
	const history = club.checks.filter(c => c.key === key).reverse();
	return '<h4 class="sub_h">' + icon('history') + ' Previous checks</h4>' + (history.length
		? '<ol class="check_history">' + history.map(c =>
			'<li>' + sticker(c.by) + '<span>' + esc(memberName(c.by)) + ', ' + (c.at ? dateFormat.format(new Date(c.at)) : 'date unknown') + '</span>' +
			badgeHtml(c.override || c.result) +
			(c.override ? '<span class="fine">Mayseph\'s own call; the questions said ' + resultName(c.result) + '</span>' : '') +
			'</li>'
		).join('') + '</ol>'
		: '<p class="fine">No checks yet for this title.</p>');
}

function quizIntroHtml(t) {
	const comfort = comfortOf(t.key);
	const hints = hintsFor(t.info);
	const tags = hints.length
		? hints.map(h => '<span class="chip hint">' + esc(h.from) + ' ' + icon('arrow_right', 'small') + ' ' + HINT_LABELS[h.key] + '</span>').join('')
		: '<span class="fine">No comfort-related tags in the catalogue. That does not mean there is nothing to check.</span>';
	return '<div class="q_block">' +
		'<h3 class="q_title" tabindex="-1" data-autofocus>Is ' + esc(t.info.title) + ' safe for Mayseph?</h3>' +
		'<p class="q_help">Yes or no, one question at a time. A hard no stops the check early. It takes about a minute.</p>' +
		(comfort.latest
			? '<p class="intro_latest">Last check: ' + badgeHtml(comfort.result) + ' by ' + esc(memberName(comfort.latest.by)) +
				(comfort.latest.at ? ', ' + dateFormat.format(new Date(comfort.latest.at)) : '') + '</p>'
			: '') +
		'<p class="fine">Tags from the catalogue that matter for comfort. Each one marks a suggested answer on its question; you still choose.</p>' +
		'<div class="chips" style="margin-top:8px">' + tags + '</div>' +
		'<div class="quiz_actions"><button class="start_pill rimmed" data-quiz="start">' + icon('shield') + ' ' +
		(comfort.latest ? 'Check again' : 'Start the check') + '</button></div>' +
		checkHistoryHtml(t.key) + '</div>';
}

// Question 1 asks how the trailer feels, so the trailer plays right inside the question.
function quizTrailerHtml(t) {
	const info = t.info;
	if (!info.full && canFetch(t.key)) return sceneArt(info) + '<p class="trailer_msg">Loading the trailer…</p>';
	const trailer = pickTrailer(info.videos);
	if (!trailer) {
		return sceneArt(info) + '<p class="trailer_msg">No trailer listed. <a href="' + esc(youtubeSearchUrl(info)) +
			'" target="_blank" rel="noopener">Look one up on YouTube</a></p>';
	}
	if (CAN_EMBED_VIDEO) {
		return sceneArt(info) + '<button class="play_btn" data-action="quiz-trailer" aria-label="Play the trailer here: ' +
			esc(trailer.name || info.title) + '">' + icon('play') + '</button>';
	}
	return sceneArt(info) + '<a class="play_btn" href="' + esc(youtubeWatchUrl(trailer.key)) +
		'" target="_blank" rel="noopener" aria-label="Watch the trailer on YouTube: ' + esc(trailer.name || info.title) + '">' + icon('play') + '</a>';
}

function refreshQuizTrailer() {
	const box = $('quizTrailer');
	const t = titleByKey(state.openKey);
	if (box && t && !box.querySelector('iframe')) box.innerHTML = quizTrailerHtml(t);
}

function playQuizTrailer() {
	const t = titleByKey(state.openKey);
	const trailer = t ? pickTrailer(t.info.videos) : null;
	if (!trailer || !CAN_EMBED_VIDEO || !$('quizTrailer')) return;
	$('quizTrailer').innerHTML = embedHtml(trailer);
	pauseMusicForTrailer();
}

function quizQuestionHtml(t, z) {
	const q = questionById(z.current);
	const hints = hintsFor(t.info);
	const hint = (q.hints || []).map(key => hints.find(h => h.key === key)).find(Boolean);
	const answers = '<div class="q_answers">' +
		'<button class="gel_blue answer_btn rimmed" data-answer="YES">Yes' + (hint ? '<small>Suggested</small>' : '') + '</button>' +
		'<button class="gel_blue answer_btn rimmed" data-answer="NO">No</button>' +
		'</div>';
	return '<div class="q_block">' +
		'<h3 class="q_title" tabindex="-1" data-autofocus>' + q.text + '</h3>' +
		(q.help ? '<p class="q_help">' + q.help + '</p>' : '') +
		(hint
			? '<p class="q_hint">' + icon('sparkle', 'small') + '<span class="chip hint">' + esc(hint.from) + '</span> The catalogue tags this title "' +
				esc(hint.from) + '", so Yes is suggested. Your call.</p>'
			: '') +
		(q.id === 'trailer'
			? '<div class="q_trailer_row"><div class="q_trailer" id="quizTrailer">' + quizTrailerHtml(t) + '</div>' + answers + '</div>'
			: answers) +
		'<div class="q_minor"><button class="link_btn" data-answer="UNKNOWN">Not sure</button><button class="link_btn" data-answer="NOT_APPLICABLE">Doesn\'t apply</button></div>' +
		'<div class="quiz_nav"><button class="link_btn" data-quiz="back">' + icon('chev_left', 'small') + ' Back</button><span class="fine">' +
		(state.memberId ? 'Checking as ' + esc(memberName(state.memberId)) : 'You pick who you are when you save') + '</span></div>' +
		'</div>';
}

function quizResultHtml(t, z) {
	const verdict = computeVerdict(z.answers);
	const isMayseph = state.memberId === 'mayseph';
	const shown = isMayseph && z.override ? z.override : verdict.result;
	const info = RESULT_INFO[shown];
	const answered = z.stack.map(id => '<li><span>' + questionById(id).text + '</span><b>' + ANSWER_LABELS[z.answers[id]] + '</b></li>').join('');
	return '<div class="q_block">' +
		'<div class="verdict r_' + shown + '"><span class="icon" aria-hidden="true">' + icon(info.icon) + '</span>' +
		'<div><h3 class="q_title" tabindex="-1" data-autofocus>' + resultName(shown) + '</h3><p>' + esc(verdict.why) +
		(isMayseph && z.override ? " Mayseph's own call replaces the questions: " + resultName(z.override) + '.' : '') +
		'</p></div></div>' +
		'<p class="fine">A personal comfort recommendation for Mayseph, not an objective or medical guarantee. Tags only ever suggested answers.</p>' +
		'<h4 class="sub_h">' + icon('check') + ' How it was answered</h4><ol class="answer_list">' + answered + '</ol>' +
		'<div class="save_box">' +
		(isMayseph
			? '<label class="field">Mayseph\'s own call<select class="text_in" data-field="override"><option value="">Go with the questions</option>' +
				OVERRIDE_RESULTS.map(r => '<option value="' + r + '"' + (z.override === r ? ' selected' : '') + '>' + resultName(r) + '</option>').join('') +
				'</select></label>'
			: '') +
		'<div class="save_row">' + (z.saved
			? '<button class="gel" disabled>' + icon('check') + ' Saved</button>'
			: '<button class="gel" data-action="save">' + icon('check') + ' ' +
				(state.memberId ? 'Save as ' + esc(memberName(state.memberId)) : 'Save') + '</button>') +
		'<span class="fine" id="saveStatus" role="status"></span></div>' +
		'</div>' +
		'<div class="quiz_nav"><button class="link_btn" data-quiz="back">' + icon('chev_left', 'small') + ' Change the last answer</button>' +
		'<button class="link_btn" data-quiz="restart">' + icon('refresh', 'small') + ' Start over</button></div>' +
		checkHistoryHtml(t.key) + '</div>';
}

function updateQuizProgress(z) {
	const box = $('quizProgress');
	box.hidden = z.screen === 'intro';
	if (z.screen === 'result') {
		$('quizCount').textContent = 'Done';
		$('quizBar').style.width = '100%';
		return;
	}
	if (z.screen !== 'question') return;
	const q = questionById(z.current);
	const base = q.parent ? questionById(q.parent) : q;
	const number = BASE_QUESTIONS.indexOf(base) + 1;
	$('quizCount').textContent = q.parent ? 'Follow-up to question ' + number : 'Question ' + number + ' of ' + BASE_QUESTIONS.length;
	$('quizBar').style.width = ((number - 1 + (q.parent ? 0.5 : 0)) / BASE_QUESTIONS.length * 100).toFixed(1) + '%';
}

// direction: 'forward', 'back' or 'pop' slides blocks in; null just draws (no animation, no focus move).
function renderQuiz(direction) {
	const t = titleByKey(state.openKey);
	if (!t) return;
	const z = quizFor(t.key);
	const html = z.screen === 'intro' ? quizIntroHtml(t) : z.screen === 'question' ? quizQuestionHtml(t, z) : quizResultHtml(t, z);
	const host = $('quizHost');
	const show = () => {
		host.innerHTML = html;
		updateQuizProgress(z);
		if (!direction) return;
		host.firstElementChild.classList.add('enter_' + direction);
		const heading = host.querySelector('[data-autofocus]');
		if (heading) heading.focus();
	};
	const old = host.firstElementChild;
	if (old && direction && !reduceMotion.matches) {
		old.classList.add('leave_' + direction);
		setTimeout(show, 170);
	} else {
		show();
	}
}

function saveCheck() {
	const key = state.openKey;
	if (!requireMember(saveCheck)) return;
	const t = titleByKey(key);
	if (!t) return;
	const z = quizFor(key);
	if (z.saved) return;
	const answers = Object.assign({}, z.answers);

	// Every answer is saved: a follow-up whose question was No is stored as "doesn't apply".
	QUESTIONS.forEach(q => {
		if (q.parent && answers[q.parent] === 'NO') answers[q.id] = 'NOT_APPLICABLE';
	});
	const verdict = computeVerdict(answers);
	const override = state.memberId === 'mayseph' && z.override ? z.override : null;
	state.store.addCheck({ key, by: state.memberId, answers, result: verdict.result, override, at: Date.now() });
	z.saved = true;
	renderQuiz(null);
	const message = 'Saved as ' + resultName(override || verdict.result) + ' by ' + memberName(state.memberId) + '.';
	if ($('saveStatus')) $('saveStatus').textContent = message;
	announce(message);
}

// The Safe for Mayseph tool starts by choosing the title.
function pickMatches() {
	const query = $('pickSearch').value.trim().toLowerCase();
	return listedTitles().filter(t => !query || [t.info.title, t.info.originalTitle || '', typeLabel(t.info)].join(' ').toLowerCase().includes(query));
}

function renderPickList() {
	const list = pickMatches();
	const query = $('pickSearch').value.trim();
	$('pickList').innerHTML = list.map(t =>
		'<li class="list_card">' + miniPoster(t, 'w154') +
		'<div><h3><button data-pick-title="' + t.key + '">' + esc(t.info.title) + '</button></h3>' +
		'<p class="fine">' + yearText(t.info) + ', ' + typeLabel(t.info) + '</p>' +
		'<div class="focus_badges">' + badgeHtml(comfortOf(t.key).result) + '</div></div></li>'
	).join('');
	$('pickStatus').textContent = list.length
		? plural(list.length, 'title') + (query ? ' match "' + query + '"' : ' on the Master List') + '.'
		: (listedTitles().length ? 'Nothing on the Master List matches "' + query + '".' : 'The Master List is empty. Add a title with the + button first.');
}

function openPickDialog() {
	$('pickSearch').value = '';
	renderPickList();
	openDialog($('pickDialog'));
	$('pickSearch').focus();
}

function pickTitle(key) {
	closeDialog($('pickDialog'), () => openDetails(key, 'safe'));
}



// T. Spin the wheel
// Every title gets an equal slice. The pick is made first, with the browser's secure random
// numbers (like Java's SecureRandom), then the wheel turns to land on it. When the vote is a draw,
// only the tied titles go on, and the winner is saved for everyone.

function wheelEligible() {
	if (state.wheel.pool) return state.wheel.pool.map(titleByKey).filter(t => t && t.status === 'listed');
	const tonightOnly = $('wheelTonightOnly').checked;
	const votedOnly = $('wheelVotedOnly').checked;
	return listedTitles().filter(t => (!tonightOnly || suitsTonight(t)) && (!votedOnly || voteCount(t.key) > 0));
}

function wheelSvgHtml(items) {
	const c = 125, r = 112;
	const n = items.length;
	let slices = '';
	items.forEach((t, i) => {
		const colour = WHEEL_COLOURS[i % WHEEL_COLOURS.length];
		if (n === 1) {
			slices += '<circle cx="125" cy="125" r="112" fill="' + colour + '"/>';
		} else {
			const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
			const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
			const large = a1 - a0 > Math.PI ? 1 : 0;
			slices += '<path d="M125 125L' + (c + r * Math.cos(a0)).toFixed(2) + ' ' + (c + r * Math.sin(a0)).toFixed(2) +
				'A112 112 0 ' + large + ' 1 ' + (c + r * Math.cos(a1)).toFixed(2) + ' ' + (c + r * Math.sin(a1)).toFixed(2) +
				'Z" fill="' + colour + '" stroke="#1b1530" stroke-width="2.6" stroke-linejoin="round"/>';
		}
		const mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
		slices += '<text class="wheel_num" x="' + (c + r * 0.7 * Math.cos(mid)).toFixed(1) + '" y="' + (c + r * 0.7 * Math.sin(mid)).toFixed(1) +
			'" text-anchor="middle" dominant-baseline="central">' + (i + 1) + '</text>';
	});
	return '<circle cx="125" cy="125" r="122" fill="#fff" stroke="#1b1530" stroke-width="3"/>' +
		'<g class="wheel_spin" id="wheelSpin">' + slices + '</g>' +
		'<circle cx="125" cy="125" r="112" fill="none" stroke="#1b1530" stroke-width="3"/>' +
		'<path d="M58 76a78 78 0 0 1 52-40" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="9" stroke-linecap="round"/>' +
		'<circle cx="125" cy="125" r="16" fill="#fff" stroke="#1b1530" stroke-width="3"/>';
}

function renderWheel() {
	const w = state.wheel;
	const items = wheelEligible();
	w.items = items;
	w.pickKey = null;
	w.angle = 0;
	w.spinning = false;
	$('wheelTitle').innerHTML = art('wheel') + (w.pool ? 'Break the tie' : 'Spin the wheel');
	$('wheelPoolNote').hidden = !w.pool;
	$('wheelFilters').hidden = Boolean(w.pool);
	$('wheelOpen').hidden = true;
	$('wheelResult').textContent = '';
	$('spinButton').textContent = 'Spin';
	$('wheelNote').textContent = items.length ? plural(items.length, 'title') + ' on the wheel' : '';
	if (!items.length) {
		$('wheelSvg').innerHTML = '<circle cx="125" cy="125" r="122" fill="#2a3352" stroke="#fff" stroke-width="3"/>';
		$('wheelLegend').innerHTML = '<li>' + (listedTitles().length ? 'No titles match. Change the options below.' : 'The Master List is empty.') + '</li>';
		$('spinButton').disabled = true;
		return;
	}
	$('spinButton').disabled = false;
	$('wheelSvg').innerHTML = wheelSvgHtml(items);
	$('wheelLegend').innerHTML = items.map((t, i) =>
		'<li data-wheel="' + t.key + '"><span class="sw" style="background:' + WHEEL_COLOURS[i % WHEEL_COLOURS.length] + '">' + (i + 1) + '</span>' +
		esc(t.info.title) + '</li>'
	).join('');
}

function openWheel(options) {
	state.wheel.pool = options && options.pool ? options.pool : null;
	renderWheel();
	openDialog($('wheelDialog'));
	if (options && options.autoSpin) setTimeout(spinWheel, reduceMotion.matches ? 0 : 560);
}

function spinWheel() {
	const w = state.wheel;
	if (w.spinning || !w.items.length || !$('wheelDialog').open) return;
	const index = secureRandomIndex(w.items.length);
	const pick = w.items[index];
	const slice = 360 / w.items.length;

	// Five full turns forward, then the picked slice stops under the pointer at the top.
	w.angle = w.angle - (w.angle % 360) + 360 * 5 + (360 - (index + 0.5) * slice);
	w.spinning = true;
	$('spinButton').disabled = true;
	$('wheelOpen').hidden = true;
	$('wheelResult').textContent = 'Spinning…';
	document.querySelectorAll('#wheelLegend li').forEach(li => li.classList.remove('picked'));
	const finish = () => {
		if (!w.spinning) return;
		w.spinning = false;
		w.pickKey = pick.key;
		$('spinButton').disabled = false;
		$('spinButton').textContent = 'Spin again';
		const li = document.querySelector('#wheelLegend [data-wheel="' + pick.key + '"]');
		if (li) li.classList.add('picked');
		$('wheelOpen').hidden = false;
		if (w.pool) {
			state.store.putState({ tieWinner: pick.key });
			$('wheelResult').textContent = 'The wheel picked ' + pick.info.title + '. It wins the tie.';
		} else {
			$('wheelResult').textContent = 'The wheel picked ' + pick.info.title + '.';
		}
	};
	const spinner = $('wheelSpin');
	spinner.style.transform = 'rotate(' + w.angle + 'deg)';
	if (reduceMotion.matches) {
		finish();
	} else {
		spinner.addEventListener('transitionend', finish, { once: true });
		setTimeout(finish, 4300);
	}
}



// U. Episode fit
// How many episodes fit in the time you have, from the club's next episode, skipping intros and
// credits if you like. The details' "Viewing fit" tab shows the same for one title.

function episodeLength(info, options) {
	let length = info.runtime;
	if (options.skipIntro) length -= info.intro || 0;
	if (options.skipCredits) length -= info.credits || 0;
	return Math.max(1, length);
}

function fitBarHtml(blockMinutes, pieceMinutes, count) {
	let pieces = '';
	for (let i = 0; i < Math.min(count, 60); i++)
		pieces += '<span style="width:calc(' + (pieceMinutes / blockMinutes * 100).toFixed(3) + '% - 2px)"></span>';
	return '<span class="fit_bar" aria-hidden="true">' + pieces + '</span>';
}

function rangeText(info, from, count) {
	if (!count) return '';
	const first = episodeLabel(info, from);
	return count === 1 ? first : first + ' to ' + episodeLabel(info, from + count - 1);
}

function fitPanelHtml(t) {
	const info = t.info;
	const o = state.fitOptions;
	if (!info.runtime) return '<p class="synopsis">There is no ' + (info.episodic ? 'episode length' : 'runtime') + ' for ' + esc(info.title) + ' yet, so there is nothing to fit.</p>';
	if (!info.episodic) {
		const slot = Math.ceil(info.runtime / 60);
		return '<p class="synopsis">' + esc(info.title) + ' runs ' + formatMinutes(info.runtime) + '. It fits a ' + slot + ' h slot with ' +
			formatMinutes(slot * 60 - info.runtime) + ' to spare.</p>' + fitBarHtml(slot * 60, info.runtime, 1);
	}
	const length = episodeLength(info, o);
	const from = Math.max(1, t.progress + 1);
	const left = info.episodes ? Math.max(0, info.episodes - from + 1) : Infinity;
	return '<label class="check"><input type="checkbox" data-fit="skipIntro"' + (o.skipIntro ? ' checked' : '') + '> Skip intros (' + (info.intro || 0) + ' min each)</label>' +
		'<label class="check"><input type="checkbox" data-fit="skipCredits"' + (o.skipCredits ? ' checked' : '') + '> Skip credits (' + (info.credits || 0) + ' min each)</label>' +
		'<p class="fit_summary">Each episode takes about ' + formatMinutes(length) + (o.skipIntro || o.skipCredits ? ' with skips' : '') +
		'. Counting from the club\'s next episode, ' + esc(episodeLabel(info, from)) + '.</p>' +
		'<ul class="fit_list">' + [1, 2, 3, 4, 6].map(hours => {
			const block = hours * 60;
			const count = Math.min(left, Math.floor(block / length + 1e-9));
			return '<li><span class="hrs">' + formatHours(hours) + '</span><span><b>' + plural(count, 'episode') + '</b>' +
				(count ? '<span class="fine"> · ' + esc(rangeText(info, from, count)) + '</span>' : '') + '</span>' +
				'<span class="left">' + formatMinutes(block - count * length) + ' left over</span>' +
				fitBarHtml(block, length, count) + '</li>';
		}).join('') + '</ul>' +
		(info.episodes ? '<p class="fit_summary fine">Whole show: ' + plural(info.episodes, 'episode') + ', about ' + formatMinutes(info.episodes * length) + '.</p>' : '');
}

function fitShows() {
	return listedTitles().filter(t => t.info.episodic);
}

function openFitDialog(key) {
	const shows = fitShows();
	$('fitSeries').innerHTML = shows.length
		? shows.map(t => '<option value="' + t.key + '">' + esc(t.info.title) + '</option>').join('')
		: '<option value="">No shows on the Master List yet</option>';
	if (key && shows.some(t => t.key === key)) $('fitSeries').value = key;
	$('fitSkipIntro').checked = state.fitOptions.skipIntro;
	$('fitSkipCredits').checked = state.fitOptions.skipCredits;
	resetFitFrom();
	renderFitDialog();
	openDialog($('fitDialog'));
}

function resetFitFrom() {
	const t = titleByKey($('fitSeries').value);
	$('fitFrom').value = t ? String(Math.max(1, t.progress + 1)) : '';
}

function renderFitDialog() {
	const t = titleByKey($('fitSeries').value);
	const hours = Number($('fitHours').value);
	$('fitHoursOut').textContent = formatHours(hours);
	$('fitOpenSeries').disabled = !t;
	if (!t) {
		$('fitResult').innerHTML = '<div class="empty_note">' + art('tracker') + '<span>Add a series or an anime series to the Master List first.</span></div>';
		return;
	}
	const info = t.info;
	if (!info.runtime) {
		$('fitResult').innerHTML = '<p>There is no episode length for ' + esc(info.title) + ' yet, so there is nothing to fit.</p>';
		return;
	}
	const from = clampInt($('fitFrom').value || t.progress + 1, 1, info.episodes || 20000);
	const length = episodeLength(info, state.fitOptions);
	const left = info.episodes ? Math.max(0, info.episodes - from + 1) : Infinity;
	const count = Math.min(left, Math.floor(hours * 60 / length + 1e-9));
	$('fitResult').innerHTML = '<p class="fit_big">' + plural(count, 'episode') + ' of ' + esc(info.title) + ' fit in ' + formatHours(hours) + '</p>' +
		(count ? '<p>' + esc(rangeText(info, from, count)) + '</p>' : '') +
		'<p class="fine" style="margin:6px 0 10px">' + formatMinutes(hours * 60 - count * length) + ' left over. Each episode takes about ' + formatMinutes(length) +
		(state.fitOptions.skipIntro || state.fitOptions.skipCredits ? ' with skips' : '') + '.' +
		(info.episodes && count && from + count - 1 >= info.episodes ? ' That reaches the last episode.' : '') + '</p>' +
		fitBarHtml(hours * 60, length, count);
}




// V. Show tracker
// One count per show for the whole club: how many episodes everyone has watched together.
// Press +1 after an episode. When the last one is done, "We finished it" moves the show to
// the watch history.

function trackedShows() {
	return listedTitles().filter(t => t.info.episodic)
		.sort((a, b) => (b.progress > 0) - (a.progress > 0) || a.order - b.order);
}

function showsInProgress() {
	return listedTitles().filter(t => t.info.episodic && t.progress > 0 && !showFinished(t)).length;
}

function renderTracker() {
	const shows = trackedShows();
	const away = awayMembers();
	$('trackerAside').hidden = !away.length || !shows.length;
	$('trackerAside').innerHTML = icon('moon') + '<span>' + esc(joinList(away.map(m => m.name))) +
		(away.length === 1 ? ' is' : ' are') + ' away tonight, so the shows wait. The counts are here for when everyone is back.</span>';
	if (!shows.length) {
		$('trackerList').innerHTML = '<li class="empty_note">' + sticker('vitamin', 'boil') +
			'<span>No shows on the Master List yet. Add a series or an anime series and it shows up here.</span></li>';
		return;
	}
	keepFocus($('trackerList'), () => {
		$('trackerList').innerHTML = shows.map(t => {
			const info = t.info;
			return '<li class="list_card" data-card="' + t.key + '">' + miniPoster(t, 'w154', ' data-open-key="' + t.key + '" aria-hidden="true"') +
				'<div><h3><button data-open-key="' + t.key + '">' + esc(info.title) + '</button></h3>' +
				'<p class="fine">' + typeLabel(info) + ', ' + yearText(info) + ', ' + esc(formatFormat(info)) + '</p>' +
				'<div class="track_line">' +
				(info.episodes ? '<span class="progress_bar" aria-hidden="true"><i style="width:' + (progressShare(t) * 100).toFixed(1) + '%"></i></span>' : '') +
				'<b>' + esc(progressText(t)) + '</b></div>' +
				stepButtonsHtml(t).replace('class="acts"', 'class="track_acts"') +
				'</div></li>';
		}).join('');
	});
}

function openTracker() {
	renderTracker();
	openDialog($('trackerDialog'));
}

function stepProgress(key, delta) {
	const t = titleByKey(key);
	if (!t || !t.info.episodic) return;
	let next = Math.max(0, t.progress + delta);
	if (t.info.episodes) next = Math.min(t.info.episodes, next);
	if (next === t.progress) return;
	t.progress = next; // straight away, so a quick second tap counts from here
	state.store.putTitle(key, { progress: next });
	if (delta > 0 && t.info.episodes && next === t.info.episodes) {
		toast('That was the last episode of ' + t.info.title + '. Press "We finished it" to move it to the watch history.');
	} else if (delta > 0) {
		announce(t.info.title + ': ' + next + ' watched.');
	}
}



// W. Watch history
// "We watched it" (a film) or "We finished it" (a show) moves a title here. Everyone gives it a
// word: Loved it, Liked it, It aight or Not for me, shown side by side. No dates, just the order
// things were watched in. "Put it back on the list" undoes a mistake.

function markWatched(key) {
	const t = titleByKey(key);
	if (!t || t.status !== 'listed') return;
	state.store.putTitle(key, { status: 'watched', historyOrder: Date.now() });
	state.store.dropVotesFor(key);
	if (club.tieWinner === key) state.store.putState({ tieWinner: null });
	toast(t.info.title + ' is in the watch history. What did you think?', state.memberId || null);
	const go = () => openHistory(key);
	if ($('detailsDialog').open) closeDialog($('detailsDialog'), go);
	else if ($('trackerDialog').open) closeDialog($('trackerDialog'), go);
	else go();
}

function putBack(key) {
	const t = titleByKey(key);
	if (!t || t.status !== 'watched') return;
	state.store.putTitle(key, { status: 'listed', order: Date.now() });
	state.shelf.centerKey = key;
	toast(t.info.title + ' is back on the Master List.');
}

function setMyWord(key, word) {
	if (!requireMember(() => setMyWord(key, word))) return;
	const t = titleByKey(key);
	if (!t) return;
	const same = t.words[state.memberId] === word;
	state.store.setWord(key, state.memberId, same ? null : word);
	announce(same ? 'Your word on ' + t.info.title + ' is cleared.' : 'You said ' + WORDS.find(w => w.id === word).label + ' about ' + t.info.title + '.');
}

function wordsHtml(t) {
	return '<ul class="words" aria-label="What everyone thought">' + MEMBERS.map(m => {
		const word = WORDS.find(w => w.id === t.words[m.id]);
		return '<li class="word m_' + m.id + (word ? '' : ' is_blank') + '">' +
			'<span class="who">' + sticker(m.id) + (word ? art(word.art) : '') + '</span>' +
			'<span class="name">' + esc(m.name) + '</span>' +
			'<span class="said">' + (word ? word.label : 'No word yet') + '</span></li>';
	}).join('') + '</ul>';
}

function wordPickerHtml(t) {
	const me = state.memberId;
	if (!me) return '<div class="word_pick"><button class="gel_white small_btn" data-who-for-words>' + icon('user', 'small') + ' Pick who you are to add your word</button></div>';
	return '<div class="word_pick" role="radiogroup" aria-label="Your word on ' + esc(t.info.title) + '"><span>Your word:</span>' +
		WORDS.map(w =>
			'<button class="word_btn" role="radio" aria-checked="' + (t.words[me] === w.id) + '" data-word="' + w.id + '" data-key="' + t.key + '">' +
			art(w.art) + w.label + '</button>'
		).join('') + '</div>';
}

function renderHistory() {
	const list = watchedTitles();
	$('historyNote').textContent = list.length ? plural(list.length, 'title') + ' watched together' : '';
	if (!list.length) {
		$('historyList').innerHTML = '<li class="empty_note">' + art('popcorn_empty') +
			'<span>Nothing watched yet. When the club finishes a film or a show, press "We watched it" on its details and it lands here.</span></li>';
		return;
	}
	keepFocus($('historyList'), () => {
		$('historyList').innerHTML = list.map(t =>
			'<li class="list_card" data-card="' + t.key + '">' + miniPoster(t, 'w154', ' data-open-key="' + t.key + '" aria-hidden="true"') +
			'<div><h3><button data-open-key="' + t.key + '">' + esc(t.info.title) + '</button></h3>' +
			'<p class="fine">' + typeLabel(t.info) + ', ' + yearText(t.info) + (t.info.episodic ? ', ' + esc(formatFormat(t.info)) : '') + '</p>' +
			wordsHtml(t) + wordPickerHtml(t) +
			'<div class="track_acts"><button class="link_btn" data-put-back="' + t.key + '">' + icon('undo', 'small') + ' Put it back on the list</button></div>' +
			'</div></li>'
		).join('');
	});
}

function openHistory(focusKey) {
	renderHistory();
	openDialog($('historyDialog'));
	const card = focusKey ? $('historyList').querySelector('[data-card="' + focusKey + '"]') : null;
	if (card) {
		card.scrollIntoView({ block: 'nearest' });
		const first = card.querySelector('.word_btn, [data-who-for-words]');
		if (first) first.focus({ preventScroll: true });
	}
}

// Redraws a list but keeps keyboard focus on "the same" button, found again by its data-* attributes.
function keepFocus(container, render) {
	const active = document.activeElement;
	let selector = null;
	if (active && container.contains(active)) {
		const attrs = Array.from(active.attributes).filter(a => a.name.startsWith('data-'));
		if (attrs.length) selector = active.tagName.toLowerCase() + attrs.map(a => '[' + a.name + '="' + CSS.escape(a.value) + '"]').join('');
	}
	render();
	if (selector) {
		const again = container.querySelector(selector);
		if (again) again.focus({ preventScroll: true });
	}
}



// X. Settings, the welcome, and connecting the club
// The club's data lives in one Firebase project (free), under a club code nobody can guess.
// Whoever sets Ussy up starts the club once and gets an invite link; everyone else opens the link
// and is in. "Make a new code" moves everything to a fresh code if a link ever gets out.

const SYNC_TEXT = {
	local: { icon: 'device', chip: 'This device', title: 'Kept on this device only', text: 'Connect the club to share the list, votes and checks live with everyone.' },
	connecting: { icon: 'cloud_up', chip: 'Connecting', title: 'Connecting to the club…', text: 'Changes made now are kept here and sent as soon as the club answers.' },
	synced: { icon: 'cloud_check', chip: 'Synced', title: 'Live with the club', text: 'Everything you change shows up for everyone straight away.' },
	saving: { icon: 'cloud_up', chip: 'Saving', title: 'Saving…', text: 'Sending your latest changes to the club.' },
	offline: { icon: 'cloud_off', chip: 'Offline', title: 'Offline', text: "Your changes are kept on this device and sync by themselves when you're back online." },
	error: { icon: 'warn', chip: 'Sync problem', title: 'Sync problem', text: '' }
};

function renderSyncChip() {
	const s = SYNC_TEXT[state.syncState] || SYNC_TEXT.local;
	const chip = $('syncChip');
	chip.dataset.state = state.syncState;
	chip.innerHTML = icon(s.icon) + '<span class="label">' + s.chip + '</span>';
	chip.setAttribute('aria-label', 'Club data: ' + s.chip + '. Open the settings.');
	chip.title = s.title;
}

function onSyncStatus(status) {
	const before = state.syncState;
	state.syncState = status;
	state.syncError = state.store && state.store.errorText ? state.store.errorText() : '';
	renderSyncChip();
	if ($('settingsDialog').open) {
		renderClubStatus();
		renderDiagnostics();
	}
	if (before !== status && (before === 'connecting' || status === 'connecting')) {
		renderShelf(false);
		renderVotes();
	}
}

let syncProblemShown = false;

function reportSyncProblem(message) {
	if (syncProblemShown || !message) return;
	syncProblemShown = true;
	toast(message);
}

function onClubData(raw) {
	const next = readClub(raw);
	const before = state.seen;
	club.titles = next.titles;
	club.votes = next.votes;
	club.checks = next.checks;
	club.tonight = next.tonight;
	club.tieWinner = next.tieWinner;
	club.closed = next.closed;
	club.loaded = true;
	state.lastChangeAt = new Date();
	if (before) announceChanges(before);
	state.seen = {
		listed: new Set(listedTitles().map(t => t.key)),
		votes: JSON.parse(JSON.stringify(club.votes)),
		count: club.titles.size
	};
	if (club.closed) showMovedNotice();
	renderAll();
	refreshStaleSoon();
}

// A little toast when someone else adds a title or votes, so the live sync can be felt.
// Big batches (the first load, a move to a new code) stay quiet.
function announceChanges(before) {
	if (!before.count) return;
	const added = listedTitles().filter(t => !before.listed.has(t.key) && t.addedBy && t.addedBy !== state.memberId);
	const votes = [];
	MEMBER_IDS.forEach(id => {
		if (id === state.memberId) return;
		picksOf(id).forEach(key => {
			if (!(before.votes[id] || []).includes(key)) votes.push({ id, key });
		});
	});
	if (added.length + votes.length > 2) return;
	if (added.length) toast(memberName(added[0].addedBy) + ' added ' + added[0].info.title + '.', added[0].addedBy);
	else if (votes.length) toast(memberName(votes[0].id) + ' voted for ' + titleByKey(votes[0].key).info.title + '.', votes[0].id);
}

// Switches to whichever club this browser belongs to (or a prepared store, when moving codes).
function connectClub(prepared) {
	if (state.store) state.store.disconnect();
	state.clubSetting = savedClub();
	club.loaded = false;
	state.seen = null;
	state.refreshed.clear();
	syncProblemShown = false;
	if (prepared) state.store = prepared;
	else if (state.clubSetting && state.clubSetting.mode === 'firebase')
		state.store = new FirestoreClub(state.clubSetting.config, state.clubSetting.code);
	else state.store = new LocalClub();
	try {
		state.store.connect(onClubData, onSyncStatus);
	} catch (error) {
		// The Firebase part could not start: carry on with this device, and say why.
		state.store = new LocalClub();
		state.store.connect(onClubData, onSyncStatus);
		state.syncError = error.message;
		toast("Couldn't start the club's sync (" + error.message + '). Using this device for now.');
	}
	if ($('settingsDialog').open) renderSettings(true);
	renderAll();
}

function joinClub(invite) {
	const current = state.clubSetting;
	if (current && current.mode === 'firebase' && current.code === invite.code) return 'same';
	Saved.setJson(STORAGE.club, { mode: 'firebase', code: invite.code, config: invite.config });
	connectClub();
	return 'joined';
}

// Starts a brand-new club in a Firebase project, bringing along anything already on this device.
function startClub(config) {
	const code = makeClubCode();
	const bring = state.store && state.store.kind === 'local' ? state.store.dump() : null;
	Saved.setJson(STORAGE.club, { mode: 'firebase', code, config });
	connectClub();
	if (bring && Object.keys(bring.titles).length && state.store.kind === 'firebase') state.store.load(bring);
	return code;
}

function useDeviceOnly() {
	Saved.setJson(STORAGE.club, { mode: 'local' });
	connectClub();
}

function currentInviteLink() {
	const c = state.clubSetting;
	return c && c.mode === 'firebase' ? inviteLink(c.code, c.config) : '';
}

async function copyInvite(statusEl) {
	const link = currentInviteLink();
	if (!link) return;
	const ok = await copyText(link);
	const message = ok
		? 'Invite link copied. Send it to the others in a private message. Anyone with it can see and change the club\'s list.'
		: 'Copying was blocked here. Select the link below and copy it yourself.';
	if (statusEl) showStatus(statusEl, ok ? 'good' : 'wait', message);
	if (!ok) showInviteText(link);
	else toast('Invite link copied.');
}

function showStatus(el, kind, message) {
	el.hidden = false;
	el.className = 'status_line is_' + kind;
	el.innerHTML = icon(kind === 'good' ? 'check' : kind === 'bad' ? 'warn' : 'info') + '<span>' + esc(message) + '</span>';
}

function showInviteText(link) {
	const box = $('connectBox');
	box.hidden = false;
	box.innerHTML = '<div class="invite_box"><input class="text_in" readonly value="' + esc(link) + '" aria-label="Invite link" data-select-all></div>';
	const input = box.querySelector('input');
	input.focus();
	input.select();
}

function connectFormsHtml(where) {
	const inClub = state.clubSetting && state.clubSetting.mode === 'firebase';
	return '<div class="choice_list" style="margin-top:0">' +
		'<div class="choice"><h3>' + icon('link') + ' Join with an invite link</h3>' +
		'<p class="fine">Paste the link someone in the club sent you.</p>' +
		'<div class="invite_box"><input class="text_in" data-join-input type="text" autocomplete="off" spellcheck="false" placeholder="https://…#join=…" aria-label="Invite link">' +
		'<button class="gel" data-join-go>' + icon('link', 'small') + ' Join</button></div></div>' +
		(where === 'moved' ? '' :
			'<div class="choice"><h3>' + icon('cloud_up') + ' Start the club</h3>' +
			'<p class="fine">Only once, on one browser. Whoever sets Ussy up makes a free Firebase project (the setup guide shows how) and pastes its web config here. Everyone else joins with the invite link.</p>' +
			'<textarea class="text_in" data-config-input rows="5" spellcheck="false" style="margin-top:10px" aria-label="Firebase web config" ' +
			'placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, authDomain: &quot;…&quot;, projectId: &quot;…&quot;, appId: &quot;…&quot; };"></textarea>' +
			'<div class="set_row"><button class="gel" data-start-go>' + icon('cloud_up', 'small') + ' Start the club</button></div></div>') +
		(where === 'welcome' || where === 'moved' || inClub
			? '<div class="choice"><h3>' + icon('device') + ' ' + (inClub && where === 'settings' ? 'Leave the club on this device' : 'Just looking?') + '</h3>' +
				'<p class="fine">' + (inClub && where === 'settings'
					? "Go back to a list kept on this device. The club's list stays safe online; open the invite link again to come back."
					: 'Use Ussy on this device only. You can connect the club later in Settings.') + '</p>' +
				'<div class="set_row"><button class="gel_white" data-device-only>' + icon('device', 'small') + ' Use this device only</button></div></div>'
			: '') +
		'</div><p class="form_error" data-connect-error hidden></p>';
}

function showConnectError(container, message) {
	const el = container.querySelector('[data-connect-error]');
	el.innerHTML = icon('warn') + '<span>' + esc(message) + '</span>';
	el.hidden = false;
}

// The join / start / device-only buttons, wherever their forms are (Settings or the welcome).
function onConnectClick(e, where) {
	const container = e.currentTarget;
	if (e.target.closest('[data-join-go]')) {
		const invite = parseInvite(container.querySelector('[data-join-input]').value);
		if (!invite) {
			showConnectError(container, "That doesn't look like a Ussy invite link. Copy the whole link, from https to the end, and try again.");
			return;
		}
		const result = joinClub(invite);
		if (result === 'same') {
			showConnectError(container, "You're already in this club.");
			return;
		}
		afterConnect(where, 'Joined the club. Everything syncs live now.');
		return;
	}
	if (e.target.closest('[data-start-go]')) {
		const config = parseFirebaseConfig(container.querySelector('[data-config-input]').value);
		if (!config) {
			showConnectError(container, "Ussy couldn't find apiKey, projectId and appId in that. Paste the whole firebaseConfig block from the Firebase console.");
			return;
		}
		startClub(config);
		if (where === 'welcome') openWelcome('invite');
		else afterConnect(where, 'The club is ready. Copy the invite link and send it to the others.');
		return;
	}
	if (e.target.closest('[data-device-only]')) {
		if (where === 'settings') {
			askConfirm({
				art: art('away'),
				title: 'Leave the club on this device?',
				text: "This browser goes back to a list kept on this device. The club's list stays safe online, and opening the invite link again brings you back.",
				yes: icon('door') + ' Leave',
				keep: 'Stay',
				action: () => closeDialog($('confirmDialog'), () => {
					useDeviceOnly();
					afterConnect('settings', 'This browser now keeps its own list.');
				})
			});
			return;
		}
		useDeviceOnly();
		afterConnect(where, '');
	}
}

function afterConnect(where, message) {
	if (where === 'welcome' || where === 'moved') {
		if (!state.memberId) openWelcome('who');
		else closeDialog($('welcomeDialog'));
		if (message) toast(message);
		return;
	}
	renderSettings(true);
	if (message) showStatus($('clubStatus'), 'good', message);
}

// Moves the whole club to a new code and empties the old one, for when an invite link got out.
function askRotate() {
	askConfirm({
		art: art('away'),
		title: 'Make a new club code?',
		text: 'Use this if the invite link got out. Everything moves to a new code and the old one is emptied, so the old link stops working. Everyone needs the new invite link afterwards.',
		yes: icon('refresh') + ' Make a new code',
		keep: 'Not now',
		action: rotateCode
	});
}

function rotateCode() {
	const old = state.store;
	if (!old || old.kind !== 'firebase') return;
	const dump = old.dump();
	const code = makeClubCode();
	const next = new FirestoreClub(old.config, code);
	try {
		next.load(dump);
		old.wipe();
	} catch (error) {
		$('confirmError').innerHTML = icon('warn') + '<span>The move did not work: ' + esc(error.message) + '</span>';
		$('confirmError').hidden = false;
		return;
	}
	Saved.setJson(STORAGE.club, { mode: 'firebase', code, config: old.config });
	connectClub(next);
	closeDialog($('confirmDialog'), () => {
		renderSettings(true);
		showStatus($('clubStatus'), 'good', 'New code made, and the old one is emptied. Copy the new invite link and send it to everyone.');
	});
}

function showMovedNotice() {
	if ($('welcomeDialog').open && state.welcomeStep === 'moved') return;
	openWelcome('moved');
}

function renderClubStatus() {
	const s = SYNC_TEXT[state.syncState] || SYNC_TEXT.local;
	const c = state.clubSetting;
	const inClub = c && c.mode === 'firebase';
	$('syncBig').innerHTML = icon(s.icon) + '<div><b>' + s.title + '</b><span class="fine">' +
		esc(state.syncState === 'error' ? state.syncError : s.text) +
		(inClub ? ' Club code ending in -' + esc(c.code.slice(-4)) + ', Firebase project "' + esc(c.config.projectId) + '".' : '') +
		'</span></div>';
}

// full: rebuild the buttons and forms too (only when the club itself changed, so nothing being
// typed in them is ever wiped by a redraw).
function renderSettings(full) {
	renderSlots($('settingsSlots'));
	$('musicSwitch').setAttribute('aria-checked', String(!music.mutedByChoice));
	renderClubStatus();
	const c = state.clubSetting;
	const inClub = c && c.mode === 'firebase';
	const mode = inClub ? 'firebase:' + c.code : 'local';
	if (full || $('clubActions').dataset.mode !== mode) {
		$('clubActions').dataset.mode = mode;
		$('clubActions').innerHTML = inClub
			? '<button class="gel" id="copyInvite">' + icon('copy', 'small') + ' Copy invite link</button>' +
				'<button class="gel_white" id="rotateCode">' + icon('refresh', 'small') + ' Make a new code</button>' +
				'<button class="link_btn" id="moreClub" aria-expanded="false">More club options</button>'
			: '<button class="gel" id="showConnect" aria-expanded="false">' + icon('cloud_up', 'small') + ' Connect the club</button>';
		$('connectBox').hidden = true;
		$('connectBox').innerHTML = connectFormsHtml('settings');
		$('clubStatus').hidden = true;
	}
	const key = tmdbKey();
	$('tmdbKeyRemove').hidden = !key;
	if (!$('tmdbKeyStatus').dataset.sticky) {
		showStatus($('tmdbKeyStatus'), key ? 'good' : 'wait', key
			? 'A key is saved in this browser. Search finds films and TV.'
			: 'No key yet: search finds anime (AniList) only.');
	}
	renderDiagnostics();
}

function openSettings(section) {
	$('tmdbKeyStatus').dataset.sticky = '';
	renderSettings(true);
	openDialog($('settingsDialog'));
	if (section === 'club') $('setClubTitle').scrollIntoView({ block: 'start' });
	if (section === 'key') {
		$('setKeyTitle').scrollIntoView({ block: 'start' });
		$('tmdbKeyInput').focus({ preventScroll: true });
	}
}

// Checks a TMDB key with one small request, then keeps it in this browser only.
async function saveTmdbKey() {
	const value = $('tmdbKeyInput').value.trim();
	const status = $('tmdbKeyStatus');
	status.dataset.sticky = '1';
	if (!value) {
		showStatus(status, 'bad', 'Paste your key into the box first.');
		return;
	}
	if (!/^[A-Za-z0-9._-]{20,400}$/.test(value)) {
		showStatus(status, 'bad', "That doesn't look like a TMDB key. Copy the API Read Access Token (or the API Key) from TMDB's settings.");
		return;
	}
	const previous = tmdbKey();
	Saved.set(STORAGE.tmdbKey, value);
	showStatus(status, 'wait', 'Checking the key with TMDB…');
	try {
		await tmdb('/configuration', {}, null);
		$('tmdbKeyInput').value = '';
		showStatus(status, 'good', 'Key saved in this browser. Search finds films and TV now.');
		state.refreshed.clear();
		refreshStaleSoon();
	} catch (error) {
		if (error.status === 401) {
			Saved.set(STORAGE.tmdbKey, previous || null);
			showStatus(status, 'bad', 'TMDB turned that key down. Check you copied all of it.');
		} else {
			showStatus(status, 'wait', 'Saved, but TMDB could not be reached to check it (' + error.message + ').');
		}
	}
	$('tmdbKeyRemove').hidden = !tmdbKey();
	renderDiagnostics();
}

function removeTmdbKey() {
	Saved.set(STORAGE.tmdbKey, null);
	$('tmdbKeyStatus').dataset.sticky = '1';
	showStatus($('tmdbKeyStatus'), 'good', 'Key removed from this browser.');
	$('tmdbKeyRemove').hidden = true;
	renderDiagnostics();
}

function renderDiagnostics() {
	if (!$('diagBox').open) return;
	const c = state.clubSetting;
	const s = SYNC_TEXT[state.syncState] || SYNC_TEXT.local;
	const rows = [
		['Version', APP_VERSION],
		['Club data', c && c.mode === 'firebase'
			? 'Firebase project "' + c.config.projectId + '", club code ending in -' + c.code.slice(-4)
			: 'This device only'],
		['Sync', s.title + (state.syncError ? ' (' + state.syncError + ')' : '')],
		['Offline saving', state.store && state.store.kind === 'firebase' ? (state.store.cacheKind === 'memory' ? 'Off in this browser (private window?)' : 'On') : 'Not needed'],
		['Last change seen', state.lastChangeAt ? state.lastChangeAt.toLocaleTimeString('en-GB') : 'None yet'],
		['Titles', club.titles.size + ' (' + listedTitles().length + ' listed, ' + watchedTitles().length + ' watched)'],
		['Connection', navigator.onLine ? 'Online' : 'Offline'],
		['TMDB key', tmdbKey() ? 'Saved in this browser' : 'None'],
		['Browser storage', Saved.works() ? 'Working' : 'Blocked: Ussy forgets on reload'],
		['Trailers', CAN_EMBED_VIDEO ? 'Play inside Ussy' : 'Open on YouTube (page opened as a file)']
	];
	$('diagList').innerHTML = rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('');
	$('apiLog').innerHTML = apiLog.length
		? apiLog.map(e =>
			'<li><span class="' + (e.status && e.status < 400 ? 'ok' : 'bad') + '">' + (e.status || 'fail') + '</span>' +
			'<span>' + esc(e.service + ' ' + e.method + ' ' + e.path) + '</span><span>' + e.ms + ' ms</span></li>'
		).join('')
		: '<li><span></span><span>No calls yet this visit.</span><span></span></li>';
}

// The welcome: the first visit on a browser. Steps: club, invite (after starting one), who, moved.
function welcomeCanClose() {
	return Boolean(state.clubSetting) && Boolean(state.memberId) && state.welcomeStep !== 'moved';
}

function openWelcome(step, options) {
	state.welcomeStep = step;
	renderWelcome(options || {});
	if (!$('welcomeDialog').open || $('welcomeDialog').dataset.closing) openDialog($('welcomeDialog'));
	const first = $('welcomeStep').querySelector('[data-member], [data-join-input], #welcomeNext');
	if (first) first.focus({ preventScroll: true });
}

function renderWelcome(options) {
	const box = $('welcomeStep');
	const step = state.welcomeStep;
	if (step === 'club') {
		$('welcomeTitle').textContent = 'Welcome to Ussy';
		box.innerHTML = '<p class="welcome_lead">The club\'s Master List, votes, Safe for Mayseph checks and watch history, live for all four of you.</p>' +
			'<div style="margin-top:18px">' + connectFormsHtml('welcome') + '</div>';
	} else if (step === 'invite') {
		$('welcomeTitle').textContent = 'The club is ready';
		box.innerHTML = '<p class="welcome_lead">Send this invite link to Mayseph, Folio and Vitamin in a private message. Opening it joins them, nothing to set up.</p>' +
			'<div class="invite_box"><input class="text_in" readonly data-select-all value="' + esc(currentInviteLink()) + '" aria-label="Invite link">' +
			'<button class="gel" data-copy-invite>' + icon('copy', 'small') + ' Copy</button></div>' +
			'<p class="status_line" id="welcomeCopyStatus" role="status" hidden></p>' +
			(location.protocol === 'file:' ? '<p class="fine" style="margin-top:10px">This page is open as a file, so the link points at a placeholder address. Put Ussy on GitHub Pages first (the setup guide shows how), open it there, and copy the link from Settings.</p>' : '') +
			'<p class="fine" style="margin-top:10px">Anyone with the link can see and change the club\'s list, so keep it inside the club. It is always in Settings too.</p>' +
			'<div class="set_row" style="justify-content:center"><button class="start_pill rimmed" id="welcomeNext">Next</button></div>';
	} else if (step === 'who') {
		$('welcomeTitle').textContent = options.joined ? "You're in the club" : 'Who are you?';
		box.innerHTML = '<p class="welcome_lead">' + (options.joined ? 'Last thing: who are you?' : 'Pick yourself. This browser remembers it, and the keys 1 to 4 switch later.') + '</p>' +
			'<div class="slots plain" id="welcomeSlots" role="radiogroup" aria-label="Who are you?" style="margin-top:16px">' + slotsHtml(false) + '</div>';
		renderSlots($('welcomeSlots'));
	} else if (step === 'moved') {
		$('welcomeTitle').textContent = 'The club has a new code';
		box.innerHTML = '<p class="welcome_lead">Someone made a new club code (that happens when an invite link gets out), so this one is empty now. Ask for the new invite link and paste it here.</p>' +
			'<div style="margin-top:18px">' + connectFormsHtml('moved') + '</div>';
	}
}

function onWelcomeClick(e) {
	if (e.target.closest('[data-join-go], [data-start-go], [data-device-only]')) {
		onConnectClick(e, state.welcomeStep === 'moved' ? 'moved' : 'welcome');
		return;
	}
	if (e.target.closest('[data-copy-invite]')) {
		copyText(currentInviteLink()).then(ok => {
			showStatus($('welcomeCopyStatus'), ok ? 'good' : 'wait', ok ? 'Copied. Paste it into a private message to the others.' : 'Copying was blocked here: select the link and copy it yourself.');
		});
		return;
	}
	if (e.target.closest('#welcomeNext')) {
		if (!state.memberId) openWelcome('who');
		else closeDialog($('welcomeDialog'));
		return;
	}
	const slot = e.target.closest('[data-member]');
	if (slot) pickMember(slot.dataset.member, 'welcome');
}

// Something needs to know who you are (a vote, a check, a word) and nobody is picked yet: ask,
// on top of whatever is open, then carry on with what you were doing.
function requireMember(then) {
	if (state.memberId) return true;
	state.afterWho = typeof then === 'function' ? then : null;
	renderSlots($('whoSlots'));
	openDialog($('whoDialog'));
	const first = $('whoSlots').querySelector('[data-member]');
	if (first) first.focus({ preventScroll: true });
	return false;
}

// Picking a member, from any of the places that offer it.
function pickMember(id, how) {
	selectMember(id, how);
	if (islandOpen()) setIslandOpen(false);
	if ($('whoDialog').open && !$('whoDialog').dataset.closing) {
		const then = state.afterWho;
		state.afterWho = null;
		closeDialog($('whoDialog'), then || undefined);
	}
	if ($('welcomeDialog').open && state.welcomeStep === 'who') {
		closeDialog($('welcomeDialog'));
		toast('Hi, ' + memberName(id) + '! Welcome to Ussy.', id);
	}
}

// Titles whose details are short or a week old are fetched again in the background (two at a
// time), and saved for everyone. Only browsers with a TMDB key do the TMDB ones.
let refreshTimer = 0;

function refreshStaleSoon() {
	clearTimeout(refreshTimer);
	refreshTimer = setTimeout(() => {
		const stale = listedTitles().filter(t => canFetch(t.key) && !state.refreshed.has(t.key) && infoIsStale(t)).slice(0, 6);
		runPool(stale, 2, t => ensureDetails(t.key));
	}, 2000);
}



// Y. Music: "Local Forecast - Elevator" by Kevin MacLeod (CC BY 4.0)
// The song is music/local_forecast_elevator.mp3. Browsers only allow sound after a tap or a
// key press, so it starts on the first one, unless this browser switched the music off.
// M switches it anywhere.

const music = {
	playing: false,
	started: false,
	mutedByChoice: Saved.get(STORAGE.muted) === '1',
	announced: false,
	pausedForTrailer: false,
	url: null
};

// The song is a file next to the page. Only the one-file preview carries it inside the page as
// text instead (in #musicData), which is turned into a sound file the first time it is needed.
const MUSIC_FILE = 'music/local_forecast_elevator.mp3';

function musicUrl() {
	if (music.url) return music.url;
	const holder = $('musicData');
	if (!holder) {
		music.url = MUSIC_FILE;
		return music.url;
	}
	const text = holder.textContent.trim();
	if (!text) return null;
	try {
		const binary = atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		music.url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
		holder.textContent = ''; // the text copy isn't needed any more
	} catch (error) {
		music.url = null;
	}
	return music.url;
}

function playMusic() {
	const audio = $('bgm');
	const url = musicUrl();
	if (!url) return;
	if (audio.src !== url) audio.src = url;
	audio.volume = 0.35; // background level, not a party
	const attempt = audio.play();
	if (!attempt) return;
	attempt.then(() => {
		music.playing = true;
		music.started = true;
		renderMusicUi();
		if (!music.announced) {
			music.announced = true;
			toast('Now playing: Local Forecast - Elevator, by Kevin MacLeod. M turns it off.');
		}
	}).catch(() => {
		music.playing = false;
		renderMusicUi();
	});
}

function pauseMusic() {
	$('bgm').pause();
	music.playing = false;
	renderMusicUi();
}

function setMusicOn(on) {
	music.mutedByChoice = !on;
	Saved.set(STORAGE.muted, on ? '0' : '1');
	if (on) playMusic();
	else pauseMusic();
	renderMusicUi();
}

function toggleMusic() {
	setMusicOn(music.mutedByChoice || !music.playing);
}

// The first tap or key press anywhere starts the music (the switch and M look after themselves).
function onFirstGesture(event) {
	if (event.target && event.target.closest && event.target.closest('#musicSwitch')) return;
	if (event.key === 'm' || event.key === 'M') return;
	document.removeEventListener('pointerdown', onFirstGesture, true);
	document.removeEventListener('keydown', onFirstGesture, true);
	if (!music.mutedByChoice && !music.started) playMusic();
}

// A trailer and the music shouldn't talk over each other.
function pauseMusicForTrailer() {
	if (music.playing) {
		pauseMusic();
		music.pausedForTrailer = true;
	}
}

function resumeMusicAfterTrailer() {
	if (music.pausedForTrailer) {
		music.pausedForTrailer = false;
		if (!music.mutedByChoice) playMusic();
	}
}

function renderMusicUi() {
	$('musicSwitch').setAttribute('aria-checked', String(!music.mutedByChoice));
}



// Z. Drawing everything, events, and start

function renderTonight() {
	keepFocus($('tonightPeople'), () => {
		$('tonightPeople').innerHTML = MEMBERS.map(m => {
			const here = club.tonight[m.id];
			return '<li><button class="here_btn m_' + m.id + '" data-here="' + m.id + '" aria-pressed="' + here + '" ' +
				'aria-label="' + esc(m.name) + ', ' + (here ? 'here' : 'away') + ' tonight">' +
				sticker(m.id) + art(here ? 'here' : 'away', 'mark') +
				'<span class="name">' + esc(m.name) + '</span>' +
				'<span class="state">' + icon(here ? 'check' : 'moon', 'small') + (here ? 'Here' : 'Away') + '</span></button></li>';
		}).join('');
	});
	$('tonightStatus').innerHTML = icon('sparkle') + '<span>' + esc(tonightSummary()) + '</span>';
}

function toggleHere(id) {
	const here = !club.tonight[id];
	club.tonight[id] = here; // straight away, so a quick second tap counts from here
	state.store.setHere(id, here);
}

function renderToolCounts() {
	const going = showsInProgress();
	$('trackerCount').hidden = !going;
	$('trackerCount').innerHTML = going ? going + '<span class="sr_only"> ' + (going === 1 ? 'show' : 'shows') + ' on the go</span>' : '';
	const watched = watchedTitles().length;
	$('historyCount').hidden = !watched;
	$('historyCount').innerHTML = watched + '<span class="sr_only"> watched</span>';
}

function renderAll() {
	renderTonight();
	renderShelf(false);
	renderVotes();
	renderIsland();
	renderToolCounts();
	renderSyncChip();
	if ($('detailsDialog').open && state.openKey) {
		if (!titleByKey(state.openKey)) {
			closeDialog($('detailsDialog'));
		} else {
			renderFocusHead();
			renderFocusBar();
			if (state.activeTab === 'details') keepFocus($('detailsPanel'), () => renderPanel('details'));
			if (state.activeTab === 'fit') keepFocus($('fitPanel'), () => renderPanel('fit'));
			if (state.activeTab === 'safe') {
				if (quizFor(state.openKey).screen === 'intro') renderQuiz(null);
				else refreshQuizTrailer();
			}
		}
	}
	if ($('trackerDialog').open) renderTracker();
	if ($('historyDialog').open) renderHistory();
	if ($('pickDialog').open) renderPickList();
	if ($('fitDialog').open) renderFitDialog();
	if ($('settingsDialog').open) renderSettings(false);
}

function runTool(tool) {
	if (tool === 'discover') openAdd();
	if (tool === 'mayseph') openPickDialog();
	if (tool === 'wheel') openWheel();
	if (tool === 'fit') openFitDialog(state.shelf.centerKey);
	if (tool === 'tracker') openTracker();
	if (tool === 'history') openHistory();
}

// One click handler for buttons that can appear in several places (details, tracker, history).
function onSharedClick(e) {
	const step = e.target.closest('[data-step]');
	if (step) {
		stepProgress(step.dataset.key || state.openKey, Number(step.dataset.step));
		return true;
	}
	const watched = e.target.closest('[data-watched]');
	if (watched) {
		markWatched(watched.dataset.watched);
		return true;
	}
	const back = e.target.closest('[data-put-back]');
	if (back) {
		putBack(back.dataset.putBack);
		return true;
	}
	const word = e.target.closest('[data-word]');
	if (word) {
		setMyWord(word.dataset.key, word.dataset.word);
		return true;
	}
	if (e.target.closest('[data-who-for-words]')) {
		requireMember(null);
		return true;
	}
	const open = e.target.closest('[data-open-key]');
	if (open) {
		const key = open.dataset.openKey;
		const dialog = open.closest('dialog');
		if (dialog) closeDialog(dialog, () => openDetails(key));
		else openDetails(key);
		return true;
	}
	const historyOpen = e.target.closest('[data-history-open]');
	if (historyOpen) {
		closeDialog($('detailsDialog'), () => openHistory(historyOpen.dataset.historyOpen));
		return true;
	}
	if (e.target.closest('[data-open-settings]')) {
		const dialog = e.target.closest('dialog');
		if (dialog) closeDialog(dialog, () => openSettings('key'));
		else openSettings('key');
		return true;
	}
	return false;
}

function wireEvents() {
	// A poster that fails to load just leaves the drawn poster behind.
	document.addEventListener('error', e => {
		if (e.target && e.target.classList && (e.target.classList.contains('poster_img') || e.target.classList.contains('prov_logo')))
			e.target.remove();
	}, true);

	document.querySelectorAll('dialog.isle').forEach(wireDialog);

	// The top band
	$('brandMark').addEventListener('click', () => {
		const mark = $('brandMark');
		mark.classList.remove('boing');
		void mark.offsetWidth; // restart the animation
		mark.classList.add('boing');
		window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
	});
	$('brandMark').addEventListener('animationend', e => {
		if (e.animationName === 'logo_boing') $('brandMark').classList.remove('boing');
	});
	$('settingsButton').addEventListener('click', () => openSettings());
	$('syncChip').addEventListener('click', () => openSettings('club'));

	// The island: open it, pick in it, and click anywhere else to close it.
	$('islandButton').addEventListener('click', () => setIslandOpen(!islandOpen()));
	$('islandSlots').addEventListener('click', e => {
		const slot = e.target.closest('[data-member]');
		if (slot) {
			pickMember(slot.dataset.member, 'island');
			$('islandButton').focus({ preventScroll: true });
		}
	});
	$('islandSlots').addEventListener('keydown', e => onSlotKeys(e, $('islandSlots'), id => selectMember(id, 'key')));
	document.addEventListener('pointerdown', e => {
		if (islandOpen() && !$('islandShell').contains(e.target)) setIslandOpen(false);
		if (!e.target.closest('.show_remove')) hideRemoveButtons();
	});
	window.addEventListener('scroll', onPageScroll, { passive: true });
	$('islandShell').addEventListener('animationend', e => {
		if (e.animationName === 'drop_in') $('islandShell').classList.remove('drop_in');
	});

	// Who's here tonight
	$('tonightPeople').addEventListener('click', e => {
		const b = e.target.closest('[data-here]');
		if (b) toggleHere(b.dataset.here);
	});

	// Searching the Master List, and the + button
	$('searchInput').addEventListener('input', () => renderShelf(true));
	$('addButton').addEventListener('click', openAdd);

	// The Master List
	const row = $('shelfRow');
	$('prevButton').addEventListener('click', () => stepShelf(-1));
	$('nextButton').addEventListener('click', () => stepShelf(1));
	row.addEventListener('scroll', onShelfScroll, { passive: true });
	if ('onscrollend' in window) row.addEventListener('scrollend', onShelfScrollEnd);
	window.addEventListener('resize', () => {
		measureShelf();
		scrollToLi(realLi(state.shelf.centerKey), false);
		updateCenter(true);
	});
	row.addEventListener('click', e => {
		const remove = e.target.closest('.remove_btn');
		if (remove) {
			askRemove(remove.dataset.remove, e.detail === 0); // detail 0: Enter or Space, not a mouse
			return;
		}
		const card = e.target.closest('.poster_card');
		if (!card) return;
		if (press.suppressClick) {
			press.suppressClick = false;
			return;
		}
		openDetails(card.dataset.key);
	});
	row.addEventListener('pointerdown', onShelfPointerDown);
	row.addEventListener('pointermove', onShelfPointerMove);
	['pointerup', 'pointercancel'].forEach(type => row.addEventListener(type, cancelLongPress));
	row.addEventListener('pointerdown', onDragDown);
	row.addEventListener('pointermove', onDragMove);
	row.addEventListener('pointerup', onDragUp);
	row.addEventListener('pointercancel', onDragUp);
	row.addEventListener('dragstart', e => e.preventDefault()); // no ghost image of a poster
	row.addEventListener('contextmenu', e => {
		if (press.suppressClick || press.timer) e.preventDefault();
	});
	row.addEventListener('focusin', e => {
		const card = e.target.closest('.poster_card');
		if (!card || card.hasAttribute('data-clone')) return;

		// A mouse press focuses the poster too. Centring it then would slide it out from under the
		// pointer before the click lands, and the click would be lost.
		if (card === press.downCard && performance.now() - press.downAt < 600) return;
		state.shelf.heading = null;
		scrollToLi(nearestLi(card.dataset.key), true);
	});
	row.addEventListener('keydown', e => {
		const card = e.target.closest && e.target.closest('.poster_card');
		if (!card || e.altKey || e.ctrlKey || e.metaKey) return;
		const key = card.dataset.key;
		const keys = state.shelf.keys;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			moveFocus(key, 1);
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			moveFocus(key, -1);
		}
		if (e.key === 'Home') {
			e.preventDefault();
			focusCard(keys[0]);
		}
		if (e.key === 'End') {
			e.preventDefault();
			focusCard(keys[keys.length - 1]);
		}
		if (e.key === 'Delete') {
			e.preventDefault();
			askRemove(key, true);
		}
	});
	$('spotOpen').addEventListener('click', () => openDetails(state.shelf.centerKey));
	$('spotTrailer').addEventListener('click', () => openPlayer(state.shelf.centerKey));
	$('spotVote').addEventListener('click', () => {
		toggleVote(state.shelf.centerKey);
		$('spotVote').focus();
	});

	// Votes
	$('ballot').addEventListener('click', e => {
		const vote = e.target.closest('[data-ballot-vote]');
		if (vote) {
			toggleVote(vote.dataset.ballotVote);
			return;
		}
		const open = e.target.closest('[data-ballot-open]');
		if (open) openDetails(open.dataset.ballotOpen);
	});
	const tieSpin = e => {
		if (e.target.closest('[data-tie-spin]')) openWheel({ pool: topTie().map(t => t.key), autoSpin: true });
	};
	$('votesLead').addEventListener('click', e => {
		tieSpin(e);
		const open = e.target.closest('[data-lead-open]');
		if (open) openDetails(open.dataset.leadOpen);
		const trailer = e.target.closest('[data-lead-trailer]');
		if (trailer) openPlayer(trailer.dataset.leadTrailer);
	});
	$('drawBox').addEventListener('click', tieSpin);

	// Tools (tiles and footer links)
	document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => runTool(b.dataset.tool)));

	// Number boxes keep digits only, as you type or paste.
	document.querySelectorAll('[data-digits]').forEach(input =>
		input.addEventListener('input', () => {
			const digits = input.value.replace(/[^0-9]+/g, '');
			if (digits !== input.value) input.value = digits;
		})
	);

	// Read-only link boxes select everything on focus, ready to copy.
	document.addEventListener('focusin', e => {
		if (e.target.matches && e.target.matches('[data-select-all]')) e.target.select();
	});

	// Adding a title
	$('addInput').addEventListener('input', () => renderAddList(false));
	$('addInput').addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			e.preventDefault();
			renderAddList(true);
		}
	});
	$('addList').addEventListener('click', e => {
		const b = e.target.closest('[data-add]');
		if (b) addToList(b.dataset.add, b);
		if (e.target.closest('#addMore')) searchCatalogue(search.page + 1);
	});
	$('addStatus').addEventListener('click', e => onSharedClick(e));
	$('customOpen').addEventListener('click', openCustom);
	$('customBack').addEventListener('click', () => {
		showAddView('search');
		$('addInput').focus();
	});
	$('customForm').addEventListener('submit', e => {
		e.preventDefault();
		saveCustom();
	});
	$('customForm').addEventListener('change', e => {
		if (e.target.name === 'ctype') syncCustomFields();
	});
	$('addDialog').addEventListener('close', () => showAddView('search'));

	// Details
	const tabs = Array.from(document.querySelectorAll('#detailsDialog [role="tab"]'));
	tabs.forEach(tab => {
		tab.addEventListener('click', () => selectTab(tab.dataset.tab, true));
		tab.addEventListener('keydown', e => {
			const i = tabs.indexOf(tab);
			let next = null;
			if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
			if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
			if (e.key === 'Home') next = tabs[0];
			if (e.key === 'End') next = tabs[tabs.length - 1];
			if (next) {
				e.preventDefault();
				selectTab(next.dataset.tab, true);
			}
		});
	});
	$('focusVote').addEventListener('click', () => toggleVote(state.openKey));
	$('detailsDialog').addEventListener('click', e => {
		if (e.target.closest('.q_block[class*="leave_"]')) return; // a block sliding away ignores clicks
		if (onSharedClick(e)) return;
		const answer = e.target.closest('[data-answer]');
		if (answer) {
			answerQuestion(answer.dataset.answer);
			return;
		}
		const quiz = e.target.closest('[data-quiz]');
		if (quiz) {
			if (quiz.dataset.quiz === 'start' || quiz.dataset.quiz === 'restart') startQuiz();
			if (quiz.dataset.quiz === 'back') quizBack();
			return;
		}
		const action = e.target.closest('[data-action]');
		if (!action) return;
		if (action.dataset.action === 'trailer') openPlayer(state.openKey);
		if (action.dataset.action === 'quiz-trailer') playQuizTrailer();
		if (action.dataset.action === 'save') saveCheck();
	});
	$('detailsDialog').addEventListener('change', e => {
		const fitToggle = e.target.dataset.fit;
		if (fitToggle) {
			state.fitOptions[fitToggle] = e.target.checked;
			keepFocus($('fitPanel'), () => renderPanel('fit'));
			return;
		}
		if (e.target.dataset.field === 'override') {
			const z = quizFor(state.openKey);
			z.override = e.target.value;
			z.saved = false;
			renderQuiz(null);
			$('quizHost').querySelector('[data-field="override"]').focus();
		}
	});
	$('detailsDialog').addEventListener('close', () => {
		state.openKey = null;
		resumeMusicAfterTrailer();
	});

	// The player
	$('playerDialog').addEventListener('close', closePlayer);
	$('videoPicks').addEventListener('click', e => {
		const b = e.target.closest('[data-video]');
		if (b && state.player) openPlayer(state.player.key, b.dataset.video);
	});

	// Safe for Mayseph picker
	$('pickSearch').addEventListener('input', renderPickList);
	$('pickSearch').addEventListener('keydown', e => {
		const list = pickMatches();
		if (e.key === 'Enter' && list.length === 1) {
			e.preventDefault();
			pickTitle(list[0].key);
		}
	});
	$('pickList').addEventListener('click', e => {
		const b = e.target.closest('[data-pick-title]');
		if (b) pickTitle(b.dataset.pickTitle);
	});

	// The wheel
	$('spinButton').addEventListener('click', spinWheel);
	$('wheelTonightOnly').addEventListener('change', renderWheel);
	$('wheelVotedOnly').addEventListener('change', renderWheel);
	$('wheelUseAll').addEventListener('click', () => {
		state.wheel.pool = null;
		renderWheel();
		$('spinButton').focus();
	});
	$('wheelOpen').addEventListener('click', () => {
		const key = state.wheel.pickKey;
		closeDialog($('wheelDialog'), () => {
			if (key) openDetails(key);
		});
	});
	$('wheelDialog').addEventListener('close', () => {
		state.wheel.pool = null;
		state.wheel.spinning = false;
	});

	// Episode fit
	$('fitSeries').addEventListener('change', () => {
		resetFitFrom();
		renderFitDialog();
	});
	['fitHours', 'fitFrom'].forEach(id => $(id).addEventListener('input', renderFitDialog));
	$('fitSkipIntro').addEventListener('change', e => {
		state.fitOptions.skipIntro = e.target.checked;
		renderFitDialog();
	});
	$('fitSkipCredits').addEventListener('change', e => {
		state.fitOptions.skipCredits = e.target.checked;
		renderFitDialog();
	});
	$('fitOpenSeries').addEventListener('click', () => {
		const key = $('fitSeries').value;
		closeDialog($('fitDialog'), () => {
			if (key) openDetails(key, 'fit');
		});
	});

	// Tracker and history
	$('trackerList').addEventListener('click', onSharedClick);
	$('historyList').addEventListener('click', onSharedClick);

	// Who's watching? (asked on top of other dialogs)
	$('whoSlots').addEventListener('click', e => {
		const slot = e.target.closest('[data-member]');
		if (slot) pickMember(slot.dataset.member, 'who');
	});
	$('whoSlots').addEventListener('keydown', e => onSlotKeys(e, $('whoSlots'), id => selectMember(id, 'key')));
	$('whoDialog').addEventListener('close', () => {
		state.afterWho = null;
	});

	// Settings
	$('settingsSlots').addEventListener('click', e => {
		const slot = e.target.closest('[data-member]');
		if (slot) selectMember(slot.dataset.member, 'settings');
	});
	$('settingsSlots').addEventListener('keydown', e => onSlotKeys(e, $('settingsSlots'), id => selectMember(id, 'settings')));
	$('musicSwitch').addEventListener('click', () => setMusicOn(music.mutedByChoice));
	$('clubActions').addEventListener('click', e => {
		if (e.target.closest('#copyInvite')) copyInvite($('clubStatus'));
		if (e.target.closest('#rotateCode')) askRotate();
		const toggle = e.target.closest('#moreClub, #showConnect');
		if (toggle) {
			const show = $('connectBox').hidden;
			if (!$('connectBox').querySelector('[data-join-input]')) $('connectBox').innerHTML = connectFormsHtml('settings');
			$('connectBox').hidden = !show;
			toggle.setAttribute('aria-expanded', String(show));
			if (show) fadeIn($('connectBox'), 0, 160);
		}
	});
	$('connectBox').addEventListener('click', e => onConnectClick(e, 'settings'));
	$('tmdbKeySave').addEventListener('click', saveTmdbKey);
	$('tmdbKeyInput').addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveTmdbKey();
		}
	});
	$('tmdbKeyRemove').addEventListener('click', removeTmdbKey);
	$('diagBox').addEventListener('toggle', renderDiagnostics);

	// The welcome
	$('welcomeStep').addEventListener('click', onWelcomeClick);
	$('welcomeStep').addEventListener('keydown', e => {
		if (e.target.closest('#welcomeSlots')) onSlotKeys(e, $('welcomeSlots'), id => selectMember(id, 'welcome'));
	});

	// The confirm dialog
	$('confirmYes').addEventListener('click', () => {
		if (confirmAction) confirmAction();
	});

	// Music
	document.addEventListener('pointerdown', onFirstGesture, true);
	document.addEventListener('keydown', onFirstGesture, true);

	// Keys that work from anywhere (not while typing):
	//   /      jump to the search box
	//   ← →    move the Master List (posters and tabs handle their own arrows first)
	//   Enter  open the title in the middle, when nothing else has focus
	//   1-4    switch who is watching
	//   M      music on or off
	//   Esc    close the island; in the search box, clear it, then go back to the posters
	document.addEventListener('keydown', e => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return; // Alt+← is the browser's Back
		const el = document.activeElement || document.body;
		const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
		if (el === $('searchInput') && e.key === 'Escape') {
			e.preventDefault();
			if ($('searchInput').value) {
				$('searchInput').value = '';
				renderShelf(true);
			} else {
				focusCard(state.shelf.centerKey);
			}
			return;
		}
		if (typing) return;
		if ((e.key === 'm' || e.key === 'M') && !e.shiftKey) {
			e.preventDefault();
			toggleMusic();
			return;
		}
		if (/^[1-4]$/.test(e.key) && !e.shiftKey) {
			e.preventDefault();
			pickMember(MEMBERS[Number(e.key) - 1].id, 'key');
			return;
		}
		if (openDialogs().length) return; // dialogs handle their own keys (Esc closes them)
		const onPage = el === document.body || el === document.documentElement;
		if (e.key === '/') {
			e.preventDefault();
			$('searchInput').focus();
			return;
		}
		if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !el.closest('[role="tablist"], [role="radiogroup"]')) {
			e.preventDefault();
			stepShelf(e.key === 'ArrowRight' ? 1 : -1);
			return;
		}
		if (e.key === 'Enter' && onPage && state.shelf.centerKey) {
			e.preventDefault();
			openDetails(state.shelf.centerKey);
			return;
		}
		if (e.key === 'Escape' && islandOpen()) {
			setIslandOpen(false);
			$('islandButton').focus();
		}
	});

	// The section links highlight the section in view.
	const links = Array.from(document.querySelectorAll('[data-spy]'));
	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting) return;
			links.forEach(a => {
				const on = a.dataset.spy === entry.target.id;
				a.classList.toggle('is_active', on);
				if (on) a.setAttribute('aria-current', 'true');
				else a.removeAttribute('aria-current');
			});
		});
	}, { rootMargin: '-45% 0px -50% 0px' });
	['shelf', 'votes', 'tools'].forEach(id => observer.observe($(id)));

	// The bottom dock (wide screens)
	document.addEventListener('mousemove', onDockMouse, { passive: true });
	document.documentElement.addEventListener('mouseleave', () => {
		if (dock.near) {
			dock.near = false;
			hideDockSoon(DOCK_LEAVE_MS);
		}
	});
	$('dock').addEventListener('focusin', showDock);
	$('dock').addEventListener('focusout', () => hideDockSoon(DOCK_LEAVE_MS));
	$('dock').addEventListener('click', e => {
		if (e.target.closest('a')) {
			dock.holdUntil = performance.now() + 1400;
			showDock();
		}
	});
	$('dockHandle').addEventListener('click', () => {
		showDock();
		hideDockSoon(DOCK_LEAVE_MS * 3);
	});

	// The phone menu
	thumbLayout.addEventListener('change', applyLayout);
	$('menuButton').addEventListener('click', openSheet);
	const sheet = $('menuSheet');
	sheet.addEventListener('cancel', e => {
		e.preventDefault();
		closeSheet();
	});
	sheet.addEventListener('pointerdown', e => {
		sheet._pressOnBackdrop = e.target === sheet;
	});
	sheet.addEventListener('click', e => {
		const onBackdrop = e.target === sheet && sheet._pressOnBackdrop;
		sheet._pressOnBackdrop = false;
		if (onBackdrop || e.target.closest('[data-sheet-close]') || e.target.closest('[data-sheet-go]')) closeSheet();
	});
}

// The bottom dock (wide screens). It stays tucked away until you go looking for it: the mouse
// comes down to the bottom edge, you click the small handle, or the keyboard reaches one of its
// links. Scrolling never brings it out. Narrow and touch screens use the Menu button instead.
const DOCK_LEAVE_MS = 1200;
const DOCK_NEAR_PX = 90;
const dock = { timer: 0, near: false, holdUntil: 0 };

function setDockShown(shown) {
	$('dock').classList.toggle('is_tucked', !shown);
	$('dockHandle').classList.toggle('is_shown', !shown);
	document.body.classList.toggle('dock_tucked', !shown);
}

function dockBusy() {
	return dock.near || $('dock').contains(document.activeElement) || performance.now() < dock.holdUntil;
}

function showDock() {
	clearTimeout(dock.timer);
	setDockShown(true);
}

function hideDockSoon(ms) {
	clearTimeout(dock.timer);
	dock.timer = setTimeout(function tuckWhenFree() {
		if (dockBusy()) {
			dock.timer = setTimeout(tuckWhenFree, 400);
			return;
		}
		setDockShown(false);
	}, ms);
}

function onDockMouse(e) {
	if (thumbLayout.matches || openDialogs().length) return;
	const box = $('dock').getBoundingClientRect();
	const near = e.clientY > window.innerHeight - DOCK_NEAR_PX && e.clientX > box.left - 80 && e.clientX < box.right + 80;
	if (near === dock.near) return;
	dock.near = near;
	if (near) showDock();
	else hideDockSoon(DOCK_LEAVE_MS);
}

// The thumb layout (phones, tablets, narrow windows): one Menu button at the bottom centre, in
// reach of either thumb, opening a sheet with the three sections.
const thumbLayout = window.matchMedia('(max-width: 760px), (pointer: coarse)');

function applyLayout() {
	document.body.classList.toggle('thumb_layout', thumbLayout.matches);
	$('searchInput').placeholder = window.innerWidth < 520 ? 'Search the list' : 'Search the Master List';
	if (thumbLayout.matches) {
		clearTimeout(dock.timer);
		dock.near = false;
		setDockShown(false);
	} else if ($('menuSheet').open) {
		closeSheet();
	}
}

function openSheet() {
	const sheet = $('menuSheet');
	if (sheet.open) return;
	sheet.showModal();
	syncPageLock();
	if (!reduceMotion.matches && sheet.animate) {
		sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)' });
	}
}

function closeSheet() {
	const sheet = $('menuSheet');
	if (!sheet.open || sheet.dataset.closing) return;
	const finish = anim => {
		delete sheet.dataset.closing;
		sheet.close();
		syncPageLock();
		if (anim) anim.cancel(); // drop the held last frame, or the next opening starts off screen
	};
	if (reduceMotion.matches || !sheet.animate) {
		finish(null);
		return;
	}
	sheet.dataset.closing = '1';
	const anim = sheet.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
	anim.finished.then(() => finish(anim), () => finish(null));
}

function start() {
	$('islandSlots').innerHTML = slotsHtml(true);
	$('settingsSlots').innerHTML = slotsHtml(false);
	$('whoSlots').innerHTML = slotsHtml(false);
	$('footMembers').innerHTML = MEMBERS.map(m =>
		'<li>' + sticker(m.id) + '<span>' + esc(m.name) + '<small>' + esc(m.place) + '</small></span></li>'
	).join('');

	wireEvents();
	applyLayout();
	setDockShown(false);
	renderMusicUi();

	// An invite link: remember the club, then wipe the code from the address bar straight away.
	const invite = parseInvite(location.hash);
	if (/join=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
	if (invite) {
		const current = savedClub();
		if (!current || current.mode !== 'firebase' || current.code !== invite.code)
			Saved.setJson(STORAGE.club, { mode: 'firebase', code: invite.code, config: invite.config });
	}

	connectClub();
	renderIsland();
	tickClocks();
	setInterval(tickClocks, 10000);
	islandPhysics.lastY = window.scrollY;
	islandPhysics.lastT = performance.now();
	if (!reduceMotion.matches) $('islandShell').classList.add('drop_in');

	if (!state.clubSetting) openWelcome('club');
	else if (!state.memberId) openWelcome('who', { joined: Boolean(invite) });
	else if (invite) toast('Joined the club. Everything syncs live now.');
}

start();
