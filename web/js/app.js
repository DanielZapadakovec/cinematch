/* CineMatch prototype app. Plain JS, no build step. Works in a browser and inside Capacitor. */
{
const CFG = window.CINEMATCH_CONFIG || {}, DATA = window.CM_DATA, TMDB = window.TMDB || { enabled: false };
const N = window.Native || { native: false, haptic() {}, onBack() {}, exit() {}, statusBar() {}, hideSplash() {} };
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;
const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => dkey(new Date());
const midnight = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const nextDow = dow => { const t = midnight(); return dkey(addDays(t, (dow - t.getDay() + 7) % 7)); };
const nextSat = () => { const d = new Date(); return dkey(addDays(d, ((6 - d.getDay() + 7) % 7) || 7)); };
const fmtDate = k => new Date(k + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const GOAL = CFG.DAILY_GOAL || 10;
const CL = window.Cloud || { configured: false };
let CLOUD = false, TMDB_LIVE = false;
const bg = f => { if (!CLOUD) return; Promise.resolve().then(f).catch(e => { console.warn(e); toast('Sync error: ' + (e.message || e)); }); };
const XP = { swipe: 5, explore: 10, goal: 50, friend: 20, send: 5, keep: 10, watch: 15, rate: 10, plan: 25, vote: 5, onboard: 50 };

/* ---------- device preferences: theme + CRT effect ---------- */
const PKEY = 'cinematch-prefs';
let prefs = { theme: 'system', crt: true };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PKEY) || '{}') }; } catch (e) {}
function applyPrefs() {
  const r = document.documentElement;
  if (prefs.theme === 'system') delete r.dataset.theme; else r.dataset.theme = prefs.theme;
  r.classList.toggle('crt-off', !prefs.crt);
  try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {}
}
applyPrefs();

/* ---------- catalog ---------- */
let CATALOG = [], M = {};
const setCatalog = list => { CATALOG = list; M = Object.fromEntries(list.map(m => [m.id, m])); };
setCatalog(DATA.MOVIES);
async function loadCatalog() {
  if (!TMDB.enabled) return;
  try { const list = await TMDB.loadCatalog(); if (list.length) { setCatalog(list); TMDB_LIVE = true; } }
  catch (e) { setTimeout(() => toast('TMDB unavailable, using the demo catalog'), 2200); }
}

/* ---------- icons: icons/*.svg override the inline fallback sprite ---------- */
async function loadIcons() {
  const NS = 'http://www.w3.org/2000/svg';
  let sprite = $('#sprite');
  if (!sprite) { sprite = document.createElementNS(NS, 'svg'); sprite.id = 'sprite'; sprite.style.display = 'none'; document.body.prepend(sprite); }
  try {
    const names = await (await fetch('icons/manifest.json')).json();
    await Promise.all(names.map(async n => {
      const r = await fetch(`icons/${n}.svg`); if (!r.ok) return;
      const svg = new DOMParser().parseFromString(await r.text(), 'image/svg+xml').documentElement;
      if (svg.nodeName !== 'svg') return;
      svg.querySelectorAll('script,foreignObject').forEach(x => x.remove());
      const sym = document.createElementNS(NS, 'symbol'), g = document.createElementNS(NS, 'g');
      sym.id = 'i-' + n; sym.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 24 24');
      for (const a of svg.attributes) if (!/^(xmlns|viewBox|width|height|class|id|on)/i.test(a.name)) g.setAttribute(a.name, a.value);
      [...svg.childNodes].forEach(c => g.appendChild(document.importNode(c, true)));
      g.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => /^on/i.test(a.name) && el.removeAttribute(a.name)));
      sym.appendChild(g);
      const old = document.getElementById('i-' + n); old ? old.replaceWith(sym) : sprite.appendChild(sym);
    }));
  } catch (e) { /* opened from disk: the inline sprite in index.html is used */ }
}

/* ---------- store (stands in for the database) ---------- */
const KEY = 'cinematch-proto-v3';
let DB;
try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!DB || !DB.users) DB = { users: {}, session: null };
DATA.MOCK.forEach(u => { DB.users[u.id] = { ...u, mock: true, skips: [], hist: {}, friends: [] }; });
const save = () => { if (CLOUD) return; try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };
const me = () => DB.users[DB.session];
const U = id => DB.users[id];
const first = u => u === me() ? 'you' : u.name.split(' ')[0];
const initials = n => n.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const av = (u, cls = '') => `<span class="av ${cls}" style="background:${esc(u.color)}">${esc(initials(u.name))}</span>`;
const names = list => { const n = list.map(first); return n.length <= 2 ? n.join(' & ') : n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1]; };

function seedExchange(u, fid) {
  const f = U(fid); u.ex = u.ex || {}; u.inboxDone = u.inboxDone || {};
  const days = u.ex[fid] = {}, all = DATA.MOVIES.map(m => m.id);
  for (let i = 1; i <= (f.pair || 0); i++) {
    const k = dkey(addDays(new Date(), -i)), them = f.likes[hash(fid + k + 't') % f.likes.length];
    days[k] = { me: [all[hash(fid + k + 'm') % all.length]], them: [them] };
    u.inboxDone[fid + ':' + k + ':' + them] = 1;
  }
  if (f.today) days[today()] = { me: [], them: [f.likes[hash(fid + today()) % f.likes.length]] };
}
function createUser(name, email, pass, provider) {
  let id; do { id = 'CM-' + (1000 + Math.floor(Math.random() * 9000)); } while (DB.users[id]);
  const hist = {}; for (let i = 1; i <= 4; i++) hist[dkey(addDays(new Date(), -i))] = GOAL + (i % 3);
  const u = DB.users[id] = {
    id, name, email: (email || '').toLowerCase(), pass, provider, color: '#9D0208', genres: [],
    likes: [], skips: [], hist, friends: ['CM-2048', 'CM-7731', 'CM-5190', 'CM-3307'], watched: {}, seen: {}, ratings: {}, xp: 0, xpKeys: {}, ex: {}, inboxDone: {},
    events: [{ id: 'e' + Date.now(), title: 'Saturday movie night', date: nextSat(), host: id, guests: ['CM-2048', 'CM-7731', 'CM-5190'], cands: ['m1', 'm5'], votes: { 'CM-2048': 'm1', 'CM-7731': 'm5', 'CM-5190': 'm1' }, winner: null }]
  };
  u.friends.forEach(f => seedExchange(u, f));
  save(); return id;
}

/* ---------- XP & levels ---------- */
const need = l => 100 + (l - 1) * 50;
function lvl(xp) { let l = 1; while (xp >= need(l)) { xp -= need(l); l++; } return { l, cur: xp, need: need(l), title: DATA.LEVELS[Math.min(l - 1, DATA.LEVELS.length - 1)] }; }
const claimed = key => !!(me().xpKeys || {})[key];
function gain(n, key) {
  const u = me(); u.xpKeys = u.xpKeys || {};
  if (key) { if (u.xpKeys[key]) return 0; u.xpKeys[key] = 1; }
  if (!n) return 0;
  if (CLOUD && key) bg(() => CL.gainXp(key, n).then(t => { if (typeof t === 'number' && me()) { me().xp = t; renderPills(); } }));
  const before = lvl(u.xp).l; u.xp = (u.xp || 0) + n; save(); floatXP(n); renderPills();
  const after = lvl(u.xp); if (after.l > before) setTimeout(() => levelUp(after), 450);
  return n;
}
function floatXP(n) {
  if (RM.matches) return;
  const el = document.createElement('div'); el.className = 'xpf'; el.textContent = `+${n} XP`;
  Object.assign(el.style, { position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 190px)', zIndex: 25 });
  document.body.appendChild(el); setTimeout(() => el.remove(), 950);
}
let lvT;
function levelUp(L) {
  $('#lvNum').textContent = L.l; $('#lvTitle').textContent = `Level ${L.l}`; $('#lvSub').textContent = `You're now a ${L.title}`;
  $('#lvup').classList.add('on'); N.haptic('HEAVY'); const m = $('#medal');
  clearTimeout(lvT); lvT = setTimeout(() => $('#lvup').classList.remove('on'), 2600);
  spring({ from: .3, to: 1, velocity: 0, damping: .6, response: .5, eps: .002, onUpdate: v => { m.style.transform = `scale(${v})`; } });
}
$('#lvup').onclick = () => $('#lvup').classList.remove('on');

/* ---------- personal daily streak (swipe goal) ---------- */
const todayCount = u => u.hist[today()] || 0;
function runOf(test) { let d = test(0) ? 0 : 1, n = 0; while (test(d) && n < 999) { n++; d++; } return n; }
const streak = u => runOf(d => (u.hist[dkey(addDays(new Date(), -d))] || 0) >= GOAL);
const matches = (a, b) => a.likes.filter(x => b.likes.includes(x) && M[x]);

/* ---------- friend streaks: both send a film on the same day (Snapchat-style) ---------- */
const exDay = (u, fid, k) => ((u.ex || {})[fid] || {})[k] || { me: [], them: [] };
function exGet(u, fid, k) { u.ex = u.ex || {}; u.ex[fid] = u.ex[fid] || {}; return u.ex[fid][k] = u.ex[fid][k] || { me: [], them: [] }; }
const both = (u, fid, ago) => { const e = exDay(u, fid, dkey(addDays(new Date(), -ago))); return e.me.length > 0 && e.them.length > 0; };
const fstreak = (u, fid) => runOf(d => both(u, fid, d));
function fstate(u, fid) {
  const f = U(fid), e = exDay(u, fid, today()), s = fstreak(u, fid), mine = e.me.length > 0, theirs = e.them.length > 0, done = mine && theirs;
  const who = first(f);
  const label = done ? 'Streak kept today' : theirs ? `${who} sent you a film · your turn` : mine ? `Sent · waiting for ${who}` : s ? 'Send a film today to keep it' : 'Send a film to start a streak';
  return { s, done, risk: s > 0 && !done, mine, theirs, label, cls: done ? 'done' : theirs || (!mine) ? 'turn' : 'wait' };
}
const fsPill = st => `<span class="fs ${st.s ? (st.risk ? 'risk' : 'hot') : ''}" aria-label="Friend streak ${st.s} days${st.risk ? ', expires tonight' : ''}">${st.risk ? ic('hourglass', 'hg') : ''}${ic('flame')}${st.s}</span>`;
function inbox(u) {
  const out = [];
  for (const fid of u.friends) {
    const f = U(fid); if (!f) continue;
    for (let i = 0; i < 3; i++) {
      const k = dkey(addDays(new Date(), -i));
      exDay(u, fid, k).them.forEach(id => { if (M[id] && !(u.inboxDone || {})[fid + ':' + k + ':' + id]) out.push({ f, id, k, ago: i }); });
    }
  }
  return out;
}
const replying = {};
function scheduleReply(fid) {
  const u = me(), f = U(fid); if (!f || !f.mock || replying[fid] || exDay(u, fid, today()).them.length) return;
  replying[fid] = 1;
  setTimeout(() => {
    replying[fid] = 0; if (me() !== u) return;
    const k = today(), e = exGet(u, fid, k); if (e.them.length) return;
    const pool = f.likes.filter(id => M[id] && !e.me.includes(id)), id = pool[hash(fid + k + 'r') % pool.length] || f.likes[0];
    e.them.push(id); save();
    const kept = e.me.length > 0; if (kept) gain(XP.keep, 'keep:' + fid + ':' + k);
    toast(kept ? `${first(f)} sent back ${M[id].t} · streak ${fstreak(u, fid)}` : `${first(f)} sent you ${M[id].t}`);
    N.haptic('LIGHT'); renderFriends(); renderBadge();
  }, 2400 + hash(fid) % 1800);
}
function sendTo(fids, id) {
  const u = me(), k = today(), kept = [], rewards = [];
  bg(() => CL.send(fids, id, k));
  fids.forEach(fid => {
    const e = exGet(u, fid, k), had = e.me.length > 0;
    if (!e.me.includes(id)) e.me.push(id);
    if (!had && e.them.length) kept.push(U(fid));
    rewards.push(['send:' + fid + ':' + k, XP.send]);
    if (!had && e.them.length) rewards.push(['keep:' + fid + ':' + k, XP.keep]);
    scheduleReply(fid);
  });
  save(); rewards.forEach(([key, n]) => gain(n, key)); N.haptic('MEDIUM');
  const ppl = fids.map(U).filter(Boolean);
  toast(kept.length ? `Streak kept with ${names(kept)} · ${fstreak(u, kept[0].id)} ${fstreak(u, kept[0].id) === 1 ? 'day' : 'days'}` : `Sent ${M[id].t} to ${names(ppl)}`);
  renderFriends(); renderBadge();
}

/* ---------- spring (semi-implicit Euler, Apple-style damping / response) ---------- */
function spring({ from, to, velocity = 0, damping = 1, response = .4, eps = .4, onUpdate, onDone }) {
  if (RM.matches) { onUpdate(to, 0); onDone && onDone(); return { stop() {} }; }
  const k = (2 * Math.PI / response) ** 2, c = 4 * Math.PI * damping / response;
  let x = from, v = velocity, last = performance.now(), raf, dead = false;
  const step = t => {
    if (dead) return; const dt = Math.min((t - last) / 1000, 1 / 30); last = t;
    for (let i = 0; i < 4; i++) { const h = dt / 4; v += (-k * (x - to) - c * v) * h; x += v * h; }
    if (Math.abs(v) < eps * 10 && Math.abs(x - to) < eps) { onUpdate(to, 0); onDone && onDone(); return; }
    onUpdate(x, v); raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop() { dead = true; cancelAnimationFrame(raf); } };
}
const rubber = (x, d) => Math.sign(x) * (1 - 1 / (Math.abs(x) * .55 / d + 1)) * d;
function tracker() {
  let s = [];
  return {
    add(x, y) { const t = performance.now(); s.push({ t, x, y }); s = s.filter(p => t - p.t < 90); },
    vel() { if (s.length < 2) return { x: 0, y: 0 }; const a = s[0], b = s[s.length - 1], dt = (b.t - a.t) / 1000 || 1 / 60; return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }; }
  };
}
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.btn,.chip,.cb,.tab,.pill,.cand,.gtile,.together,.add,.seen,.row[data-f],.cal .d,.strip button,.rec[data-pick]');
  if (!el || el.disabled) return; el.classList.add('press');
  const off = () => { el.classList.remove('press'); removeEventListener('pointerup', off); removeEventListener('pointercancel', off); };
  addEventListener('pointerup', off); addEventListener('pointercancel', off);
});

/* ---------- posters ---------- */
const PAL = [['#DC2F02', '#03071E'], ['#9D0208', '#03071E'], ['#DC2F02', '#370617'], ['#6A040F', '#03071E'], ['#9D0208', '#370617']];
const tones = m => PAL[hash(m.id) % PAL.length];
function svgPoster(m) {
  const [a, b] = tones(m), g = 'g' + m.id; let shape = '';
  if (m.s === 0) shape = `<circle cx="150" cy="190" r="96" fill="${a}" opacity=".9"/><rect y="235" width="300" height="200" fill="${b}"/><path d="M0 250 Q75 225 150 245 T300 238 V420 H0Z" fill="#000" opacity=".35"/>`;
  if (m.s === 1) shape = [0, 1, 2, 3, 4, 5].map(i => `<circle cx="150" cy="170" r="${30 + i * 34}" fill="none" stroke="${a}" stroke-width="${10 - i}" opacity="${.9 - i * .13}"/>`).join('');
  if (m.s === 2) shape = [0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${-120 + i * 70}" y="-60" width="26" height="560" fill="${a}" opacity="${.25 + i * .09}" transform="rotate(24 150 210)"/>`).join('');
  if (m.s === 3) shape = `<path d="M0 300 L90 150 L150 230 L210 120 L300 280 V420 H0Z" fill="${a}" opacity=".85"/><path d="M0 340 L110 230 L190 320 L300 250 V420 H0Z" fill="#000" opacity=".4"/><circle cx="230" cy="80" r="22" fill="#fff" opacity=".85"/>`;
  return `<svg class="poster" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}" stop-opacity=".55"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="420" fill="${b}"/><rect width="300" height="420" fill="url(#${g})"/>${shape}</svg>`;
}
const poster = m => m.poster ? `<img class="poster" src="${esc(m.poster)}" alt="" draggable="false">` : svgPoster(m);
const fit = m => m.g.filter(g => (me().genres || []).includes(g));
function fitTag(m) {
  if (!(me().genres || []).length) return '';
  const ov = fit(m);
  return ov.length ? `<span class="tag fit">${ic('check')}Your taste · ${esc(ov[0])}</span>` : `<span class="tag new">${ic('star-fill')}New genre for you · ${esc(m.g[0])}</span>`;
}

/* ---------- screens & routing ---------- */
const show = s => $$('.screen').forEach(x => x.classList.toggle('on', x.id === 's-' + s));
const VIEWS = ['discover', 'friends', 'plan', 'profile'];
let cur = 'discover';
function go(v) {
  if (!VIEWS.includes(v)) v = 'discover'; cur = v;
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  if (v === 'discover') maybeHint(); else { clearTimeout(hintT); if (hinting) { hinting = false; hintRun++; $('#hint').classList.remove('on'); animateTo(0, 0, 0, 0, 1, .4); } }
}
$$('.tab').forEach(t => t.onclick = () => go(t.dataset.v));
addEventListener('hashchange', () => me() && go(location.hash.slice(1)));
function route() {
  const u = me();
  if (!u) return show('auth');
  if (!(u.genres || []).length) return showOnboard(false);
  show('main'); buildQueue(); renderAll(); go((location.hash || '#discover').slice(1));
}

/* ---------- auth ---------- */
let mode = 'in';
function setMode(m) {
  mode = m; $('#segIn').classList.toggle('on', m === 'in'); $('#segUp').classList.toggle('on', m === 'up');
  $('#fName').style.display = m === 'up' ? '' : 'none'; $('#authBtn').textContent = m === 'up' ? 'Create account' : 'Sign in'; $('#authErr').textContent = '';
}
$('#segIn').onclick = () => setMode('in'); $('#segUp').onclick = () => setMode('up');
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const mail = $('#fMail').value.trim().toLowerCase(), pass = $('#fPass').value, name = $('#fName').value.trim(), err = $('#authErr');
  if (CLOUD) {
    const btn = $('#authBtn'); btn.disabled = true; err.textContent = '';
    try {
      if (mode === 'up') {
        if (!name) throw new Error('Please enter your name.');
        const r = await CL.signUp(mail, pass, name);
        if (!r.session) err.textContent = 'Almost done: open the confirmation link we emailed you, then sign in.';
      } else await CL.signIn(mail, pass);
    } catch (x) { err.textContent = x.message === 'Invalid login credentials' ? 'Wrong email or password.' : x.message; }
    btn.disabled = false; return;
  }
  const found = Object.values(DB.users).find(u => u.email === mail);
  if (mode === 'up') {
    if (!name) return err.textContent = 'Please enter your name.';
    if (found) return err.textContent = 'This email already has an account.';
    login(createUser(name, mail, pass, 'email'));
  } else {
    if (!found || found.pass !== pass) return err.textContent = found && found.provider === 'google' ? 'This account uses Google sign-in.' : 'Wrong email or password.';
    login(found.id);
  }
});
$('#demoBtn').onclick = () => {
  const f = Object.values(DB.users).find(u => u.email === 'demo@cinematch.app');
  login(f ? f.id : createUser('Demo Viewer', 'demo@cinematch.app', 'demo', 'email'));
};
function login(id) { DB.session = id; save(); route(); }
function logout() {
  closeSheet();
  if (CLOUD) { CL.signOut().catch(() => {}); DB = { users: {}, session: null }; show('auth'); return; }
  DB.session = null; save(); show('auth');
}

/* Google: Supabase OAuth on the web, native Google sign-in (Credential Manager) inside the Android app */
async function nativeGoogle() {
  const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SocialLogin;
  if (!P) throw new Error('Google sign-in is missing from this build.');
  if (!CFG.GOOGLE_WEB_CLIENT_ID) throw new Error('Google sign-in is not set up yet (GOOGLE_WEB_CLIENT_ID in config.js).');
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  await P.initialize({ google: { webClientId: CFG.GOOGLE_WEB_CLIENT_ID } });
  const r = await P.login({ provider: 'google', options: { scopes: ['email', 'profile'], nonce: hashed } });
  const token = r && r.result && r.result.idToken;
  if (!token) throw new Error('Google did not return a sign-in token.');
  await CL.googleIdToken(token, raw);
}
function googleLogin(sub, name, email) {
  let u = Object.values(DB.users).find(x => x.googleSub === sub || (email && x.email === email.toLowerCase()));
  if (!u) u = U(createUser(name, email, null, 'google'));
  u.googleSub = sub; save(); closeSheet(); login(u.id);
}
$('#gBtn').onclick = async () => {
  if (CLOUD) {
    $('#authErr').textContent = '';
    try { if (N.native) await nativeGoogle(); else await CL.googleWeb(); }
    catch (x) { $('#authErr').textContent = /cancel/i.test(x.message || '') ? '' : (x.message || 'Google sign-in failed'); }
    return;
  }
  openSheet(`<div class="shead"><b>Continue with Google</b></div>
   <p class="sub">Offline demo: the server isn't reachable from here, so this creates a local demo account. Choose the name your friends will see.</p>
   <label class="l" for="gName">Display name</label><input class="field" id="gName" value="Alex Morgan" autocomplete="name">
   <button class="btn wide" id="gGo" style="margin-top:16px">${ic('google')}Continue</button>`, () => {
    $('#gGo').onclick = () => { const n = $('#gName').value.trim() || 'Google User'; googleLogin('demo-' + norm(n).replace(/\W+/g, '-'), n, norm(n).replace(/\W+/g, '.') + '@example.com'); };
  });
};

/* ---------- cloud session: load from Supabase into the same in-memory model ---------- */
function hydrate(b, user) {
  const uid = b.me.id, users = {};
  const mk = p => ({ id: p.id, handle: p.handle, name: p.name, color: p.color, genres: p.genres || [], likes: [], skips: [], hist: {}, seen: {}, ratings: {}, friends: [] });
  b.profiles.forEach(p => { users[p.id] = mk(p); });
  const prov = user && user.app_metadata && user.app_metadata.provider;
  const u = users[uid] = Object.assign(mk(b.me), {
    email: (user && user.email) || '', provider: prov === 'google' ? 'google' : 'email', xp: b.me.xp, hintDone: b.me.hint_done,
    friends: b.friends.slice(), xpKeys: Object.fromEntries(b.xpKeys.map(k => [k, 1])), ex: {}, inboxDone: {}, events: []
  });
  b.swipes.forEach(x => { const o = users[x.user_id]; if (!o) return; (x.dir > 0 ? o.likes : o.skips).push(x.movie_id); o.hist[x.day] = (o.hist[x.day] || 0) + 1; });
  b.watched.forEach(w => { const o = users[w.user_id]; if (!o) return; if (w.seen) o.seen[w.movie_id] = true; if (w.rating) o.ratings[w.movie_id] = w.rating; });
  b.sends.forEach(x => { const out = x.from_id === uid, fid = out ? x.to_id : x.from_id, e = exGet(u, fid, x.day); (out ? e.me : e.them).push(x.movie_id); if (!out && x.handled) u.inboxDone[fid + ':' + x.day + ':' + x.movie_id] = 1; });
  u.events = b.events.map(e => ({ id: e.id, title: e.title, date: e.date, host: e.host_id, guests: e.event_guests.map(g => g.user_id), cands: e.cands, votes: Object.fromEntries(e.votes.map(v => [v.user_id, v.movie_id])), winner: e.winner }));
  DB = { users, session: uid };
}
async function fillMissingTitles() {
  if (!TMDB_LIVE) return;
  const u = me(), ids = new Set();
  Object.values(DB.users).forEach(x => [...x.likes, ...x.skips, ...Object.keys(x.seen || {})].forEach(i => ids.add(i)));
  Object.values(u.ex || {}).forEach(d => Object.values(d).forEach(e => [...e.me, ...e.them].forEach(i => ids.add(i))));
  u.events.forEach(e => e.cands.forEach(i => ids.add(i)));
  const miss = [...ids].filter(i => !M[i]);
  if (miss.length) { const extra = await TMDB.byIds(miss); if (extra.length) setCatalog([...CATALOG, ...extra]); }
}
async function loadCloud(user) {
  const b = await CL.load(dkey(addDays(new Date(), -60)), dkey(addDays(new Date(), -14)));
  hydrate(b, user);
  await fillMissingTitles().catch(() => {});
  CL.subscribe({
    sent: async row => {
      const u = me(); if (!u) return;
      if (!U(row.from_id)) return reloadCloud();
      const e = exGet(u, row.from_id, row.day); if (!e.them.includes(row.movie_id)) e.them.push(row.movie_id);
      if (!M[row.movie_id] && TMDB_LIVE) { const extra = await TMDB.byIds([row.movie_id]); if (extra.length) setCatalog([...CATALOG, ...extra]); }
      toast(`${first(U(row.from_id))} sent you ${M[row.movie_id] ? M[row.movie_id].t : 'a film'}`); N.haptic('LIGHT');
      renderFriends(); renderBadge();
    },
    votes: p => {
      const row = p.new && p.new.event_id ? p.new : p.old, ev = me() && me().events.find(x => x.id === row.event_id); if (!ev) return;
      if (p.eventType === 'DELETE') delete ev.votes[row.user_id]; else ev.votes[row.user_id] = row.movie_id;
      renderPlan();
    },
    friends: () => reloadCloud()
  });
}
let reloading = null, lastReload = 0;
function reloadCloud() {
  if (!CLOUD) return Promise.resolve();
  if (reloading) return reloading;
  reloading = (async () => {
    const s = await CL.session(); if (!s) return;
    await loadCloud(s.user); lastReload = Date.now();
    renderPills(); renderFriends(); renderPlan(); renderProfile(); renderBadge();
  })().catch(e => toast('Could not refresh: ' + e.message)).finally(() => { reloading = null; });
  return reloading;
}
document.addEventListener('visibilitychange', () => { if (CLOUD && me() && document.visibilityState === 'visible' && Date.now() - lastReload > 30000) reloadCloud(); });
let loadingFor = null;
async function onCloudAuth(ev, s) {
  const id = s && s.user && s.user.id;
  if (!id) { if (ev === 'SIGNED_OUT' || ev === 'INITIAL_SESSION') { DB = { users: {}, session: null }; show('auth'); } return; }
  if (DB.session === id || loadingFor === id) return;
  loadingFor = id;
  try { await loadCloud(s.user); lastReload = Date.now(); route(); }
  catch (e) { show('auth'); $('#authErr').textContent = 'Could not load your account: ' + e.message + (/relation|does not exist|schema/i.test(e.message) ? ' (run the SQL setup in Supabase)' : ''); }
  finally { loadingFor = null; }
}

/* ---------- onboarding: favourite genres ---------- */
let obSel = new Set(), obEdit = false;
function showOnboard(edit) {
  obEdit = edit; obSel = new Set(edit ? me().genres : []);
  $('.steps').style.display = edit ? 'none' : '';
  $('#obTitle').textContent = edit ? 'Edit your genres' : `Hi ${me().name.split(' ')[0]}, what do you love to watch?`;
  $('#gen').innerHTML = DATA.GENRES.map(g => { const n = CATALOG.filter(m => m.g.includes(g)).length;
    return `<button class="gtile ${obSel.has(g) ? 'on' : ''}" data-g="${esc(g)}">${ic('check')}<span>${esc(g)}</span><small>${pl(n, 'title', 'titles')}</small></button>`; }).join('');
  $$('#gen .gtile').forEach(b => b.onclick = () => { const g = b.dataset.g; obSel.has(g) ? obSel.delete(g) : obSel.add(g); b.classList.toggle('on'); obBtn(); });
  obBtn(); show('onboard'); $('#s-onboard .auth').scrollTop = 0;
}
function obBtn() { const n = obSel.size, b = $('#obGo'); b.disabled = n < 3; b.textContent = n < 3 ? `Pick ${3 - n} more` : obEdit ? 'Save genres' : `Continue with ${n} genres`; }
$('#obGo').onclick = () => {
  const u = me(); u.genres = [...obSel]; save(); bg(() => CL.updateProfile({ genres: u.genres }));
  route(); if (!obEdit) { gain(XP.onboard, 'onboard'); toast('Welcome bonus: +50 XP'); } else { go('profile'); toast('Genres updated'); }
};

/* ---------- discover: deck & swipe ---------- */
const deck = $('#deck');
let queue = [], undoStack = [], anim = null, cx = 0, cy = 0, rotSign = 1, drag = null, busy = false;
function buildQueue() { const u = me(), seen = new Set([...u.likes, ...u.skips]); queue = CATALOG.filter(m => !seen.has(m.id)).map(m => m.id); }
function cardHTML(m) {
  return `<div class="face">${poster(m)}<div class="dim"></div><div class="meta">
  <div>${fitTag(m)}</div>
  <div class="ttl" style="margin-top:10px">${esc(m.t)}</div>
  <div class="attrs">${ic(m.k === 'Series' ? 'tv' : 'film')} <b>${esc(m.k)}</b> · ${esc(m.g.join(' / '))} · ${esc(m.y)}${m.len ? ' · ' + esc(m.len) : ''} · ${ic('star-fill')} <b>${esc(m.r)}</b></div>
  <div class="dsc">${esc(m.d)}</div></div>
  <span class="stamp yes">WANT</span><span class="stamp no">SKIP</span></div>`;
}
function depth(el, i, p) { const d = Math.max(0, i - p); el.style.transform = `translate3d(0,0,0) scale(${1 - d * .06})`; el.querySelector('.dim').style.opacity = Math.min(1, d) * .6; }
function renderDeck() {
  deck.innerHTML = ''; cx = cy = 0; anim && anim.stop(); anim = null; busy = false;
  const ids = queue.slice(0, 2);
  $('#bSend').disabled = !ids.length; $('#bUndo').disabled = !undoStack.length;
  if (!ids.length) {
    deck.innerHTML = `<div class="empty">${ic('popcorn')}<b>End of the reel</b><span class="muted">You've seen the whole deck. Send a pick to a friend or plan a movie night.</span><button class="btn" id="eGo">${ic('group-plus')}Watch together</button></div>`;
    $('#eGo').onclick = () => openTogether(); return renderPills();
  }
  ids.slice().reverse().forEach((id, ri) => { const i = ids.length - 1 - ri, el = document.createElement('div'); el.className = 'card'; el.dataset.id = id; el.innerHTML = cardHTML(M[id]); depth(el, i, 0); deck.appendChild(el); });
  renderPills(); maybeHint();
}
function renderPills() {
  const u = me(); if (!u) return; const n = todayCount(u), L = lvl(u.xp || 0);
  $('#lvPill').innerHTML = `${ic('bolt')}Lv ${L.l}`;
  $('#stPill').innerHTML = `${ic('flame')}${streak(u)}`;
  $('#dSub').textContent = n >= GOAL ? `Daily goal done · ${n} swiped today` : `${n}/${GOAL} today · ${GOAL - n} to go`;
}
$('#lvPill').onclick = $('#stPill').onclick = () => progressSheet();
const topCard = () => deck.querySelector('.card:last-child');
function paint() {
  const el = topCard(); if (!el) return; const W = deck.clientWidth;
  el.style.transform = `translate3d(${cx}px,${cy}px,0) rotate(${cx / W * 12 * rotSign}deg) scale(${1 - Math.min(Math.abs(cx) / W, 1) * .06})`;
  el.classList.toggle('lifted', Math.abs(cx) + Math.abs(cy) > 1);
  if (hinting) $('#hand').style.transform = `translateX(${cx * .9}px) rotate(${cx / W * 20}deg)`;
  const p = Math.min(1, Math.abs(cx) / (W * .4));
  el.querySelector('.stamp.yes').style.opacity = cx > 0 ? p : 0; el.querySelector('.stamp.no').style.opacity = cx < 0 ? p : 0;
  [...deck.querySelectorAll('.card')].reverse().slice(1).forEach((c, i) => depth(c, i + 1, Math.min(1, Math.abs(cx) / (W * .9))));
}
function animateTo(tx, ty, vx, vy, damping, response, done) {
  anim && anim.stop(); let fin = false;
  const finish = () => { if (fin) return; fin = true; a.stop(); b.stop(); done && done(); };
  const a = spring({ from: cx, to: tx, velocity: vx, damping, response, onUpdate: v => { cx = v; paint(); if (done && Math.abs(cx) > deck.clientWidth * 1.15) finish(); }, onDone: finish });
  const b = spring({ from: cy, to: ty, velocity: vy, damping, response, onUpdate: v => { cy = v; paint(); } });
  anim = { stop() { a.stop(); b.stop(); } };
}
function commit(dir, vx = 0, vy = 0) {
  const el = topCard(); if (!el) return; busy = true; const W = deck.clientWidth; N.haptic('LIGHT');
  if (RM.matches) { el.style.transition = 'opacity .2s'; el.style.opacity = 0; setTimeout(() => record(el.dataset.id, dir), 200); return; }
  animateTo(dir * (W * 1.5 + 80), cy + vy * .12, vx || dir * 1600, vy, 1, .45, () => record(el.dataset.id, dir));
}
function like(id, dir, viaDeck) {
  const u = me(), m = M[id];
  if (!viaDeck) { u.likes = u.likes.filter(x => x !== id); u.skips = u.skips.filter(x => x !== id); queue = queue.filter(x => x !== id); }
  (dir > 0 ? u.likes : u.skips).push(id);
  bg(() => CL.swipe(id, dir, today()));
  const before = todayCount(u); u.hist[today()] = before + 1; save();
  let xp = claimed('sw:' + id) ? 0 : XP.swipe, msg = '';
  if (dir > 0 && !fit(m).length && !claimed('ex:' + id)) { xp += XP.explore; u.xpKeys['ex:' + id] = 1; msg = `Explorer bonus: new genre ${m.g[0]}`; }
  if (xp) gain(xp, 'sw:' + id);
  if (before + 1 === GOAL) { gain(XP.goal, 'goal:' + today()); msg = `Daily goal done! Streak: ${pl(streak(u), 'day', 'days')}`; }
  else if (dir > 0) { const f = u.friends.map(U).find(f => f && f.likes.includes(id)); if (f) msg = `It's a match with ${first(f)}: ${m.t}`; }
  return msg;
}
function record(id, dir) {
  const msg = like(id, dir, true);
  undoStack.push({ id, dir }); queue.shift(); renderDeck();
  if (msg) toast(msg);
  renderFriends(); renderProfile();
}
function undo() {
  const h = undoStack.pop(); if (!h) return; const u = me(), arr = h.dir > 0 ? u.likes : u.skips;
  arr.splice(arr.lastIndexOf(h.id), 1); bg(() => CL.unswipe(h.id)); u.hist[today()] = Math.max(0, todayCount(u) - 1); save();
  queue.unshift(h.id); renderDeck(); rotSign = 1; cx = h.dir * deck.clientWidth * 1.3; cy = -20; paint();
  animateTo(0, 0, 0, 0, .85, .45); renderFriends(); renderProfile();
}
deck.addEventListener('pointerdown', e => {
  const el = e.target.closest('.card'); if (!el || el !== topCard()) return;
  stopHint(); anim && anim.stop(); anim = null; busy = false; el.setPointerCapture(e.pointerId);
  const r = el.getBoundingClientRect(); rotSign = (e.clientY - r.top) < r.height * .6 ? 1 : -1;
  drag = { ox: e.clientX, oy: e.clientY, sx: e.clientX - cx, sy: e.clientY - cy, moved: false, t: tracker(), el }; drag.t.add(e.clientX, e.clientY);
});
deck.addEventListener('pointermove', e => {
  if (!drag) return; drag.t.add(e.clientX, e.clientY);
  if (!drag.moved) { if (Math.hypot(e.clientX - drag.ox, e.clientY - drag.oy) < 10) return; drag.moved = true; drag.sx = e.clientX - cx; drag.sy = e.clientY - cy; drag.el.classList.remove('info'); }
  cx = e.clientX - drag.sx; cy = rubber(e.clientY - drag.sy, deck.clientHeight * .5); paint();
});
const up = e => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.moved) { if (e.type === 'pointerup') d.el.classList.toggle('info'); if (cx || cy) animateTo(0, 0, 0, 0, 1, .4); return; }
  const v = d.t.vel(), W = deck.clientWidth, proj = cx + v.x * .2;
  if (Math.abs(proj) > W * .45 && Math.sign(proj) === Math.sign(cx || proj)) commit(Math.sign(proj), v.x, v.y);
  else animateTo(0, 0, v.x, v.y, Math.hypot(v.x, v.y) > 600 ? .75 : 1, .4);
};
deck.addEventListener('pointerup', up); deck.addEventListener('pointercancel', up);
$('#bUndo').onclick = undo;
$('#bSend').onclick = () => topCard() && sendSheet(topCard().dataset.id);

/* first-run hint: if the user hasn't touched the deck within 3 s, nudge the card both ways once */
let hintT = 0, hinting = false, hintRun = 0;
function setHintDone(v) { const u = me(); if (!u) return; u.hintDone = v; save(); bg(() => CL.updateProfile({ hint_done: v })); }
const wait = ms => new Promise(r => setTimeout(r, ms));
function maybeHint() {
  const u = me(); clearTimeout(hintT);
  if (!u || u.hintDone || !topCard() || cur !== 'discover') return;
  hintT = setTimeout(playHint, 3000);
}
function stopHint() {
  clearTimeout(hintT); const u = me();
  if (u && !u.hintDone) setHintDone(true);
  if (!hinting) return; hinting = false; hintRun++;
  $('#hint').classList.remove('on'); $('#hand').style.transform = '';
}
async function playHint() {
  const u = me(); if (!u || u.hintDone || drag || busy || sheetOpen || cur !== 'discover' || !topCard() || !$('#s-main').classList.contains('on')) return;
  setHintDone(true); hinting = true; const run = ++hintRun, W = deck.clientWidth;
  $('#hint').classList.add('on');
  if (RM.matches) { await wait(3200); if (run === hintRun) stopHint(); return; }
  for (let loop = 0; loop < 2 && run === hintRun; loop++) {
    for (const x of [W * .34, -W * .34, 0]) {
      if (run !== hintRun) return; rotSign = 1;
      animateTo(x, 0, 0, 0, x ? .8 : 1, x ? .5 : .4); await wait(x ? 750 : 550);
    }
    await wait(250);
  }
  if (run === hintRun) stopHint();
}
addEventListener('keydown', e => {
  if (!me() || cur !== 'discover' || sheetOpen || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (/Arrow(Left|Right)/.test(e.key)) stopHint();
  if (e.key === 'ArrowRight' && !busy) { rotSign = 1; commit(1); }
  if (e.key === 'ArrowLeft' && !busy) { rotSign = 1; commit(-1); }
  if (e.key === 'Backspace') undo();
});

/* ---------- sheet (draggable, interruptible) ---------- */
const sheet = $('#sheet'), scrim = $('#scrim'); let sy = 0, sAnim = null, sheetOpen = false, sDrag = null;
const sH = () => sheet.offsetHeight || 500;
function sPaint() { sheet.style.transform = `translateY(${sy}px)`; scrim.style.opacity = Math.max(0, 1 - sy / sH()); }
function sTo(t, v = 0, d = .8, r = .3) { sAnim && sAnim.stop(); sAnim = spring({ from: sy, to: t, velocity: v, damping: d, response: r, onUpdate: x => { sy = x; sPaint(); } }); }
function openSheet(html, mount) {
  $('#sheetBody').innerHTML = html; const was = sheetOpen; sheetOpen = true; scrim.style.pointerEvents = 'auto';
  mount && mount(); $('#sheetBody').scrollTop = 0;
  if (!was) { sheet.style.transform = ''; sy = sH(); sPaint(); } sTo(0);
}
function closeSheet(v = 0) { if (!sheetOpen) return; sheetOpen = false; scrim.style.pointerEvents = 'none'; sTo(sH() + 40, v, 1, .3); }
scrim.onclick = () => closeSheet();
const grab = $('#grab');
grab.addEventListener('pointerdown', e => { sAnim && sAnim.stop(); grab.setPointerCapture(e.pointerId); sDrag = { s: e.clientY - sy, t: tracker() }; sDrag.t.add(0, e.clientY); });
grab.addEventListener('pointermove', e => { if (!sDrag) return; sDrag.t.add(0, e.clientY); const raw = e.clientY - sDrag.s; sy = raw < 0 ? rubber(raw, 120) : raw; sPaint(); });
const sUp = () => { if (!sDrag) return; const v = sDrag.t.vel().y; sDrag = null; if (sy + v * .2 > sH() * .4) closeSheet(v); else sTo(0, v, .8, .3); };
grab.addEventListener('pointerup', sUp); grab.addEventListener('pointercancel', sUp);
addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); $('#lvup').classList.remove('on'); } });

let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2800); }
const copy = t => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast('Copied ' + t), () => toast('Copying is blocked here')) : toast('Copying is blocked here');

/* ---------- send a film ---------- */
function sendSheet(id) {
  const u = me(), m = M[id], sel = new Set();
  const fr = u.friends.map(U).filter(Boolean).map(f => ({ f, st: fstate(u, f.id) })).sort((a, b) => (b.st.risk - a.st.risk) || (b.st.theirs - a.st.theirs) || b.st.s - a.st.s);
  openSheet(`<div class="shead"><b>Send to friends</b></div>
  <div class="rec" style="padding:8px 0"><span class="mini">${poster(m)}</span><div><div class="t">${esc(m.t)}</div><div class="s">${esc(m.k)} · ${esc(m.g.join(' · '))}</div></div></div>
  <p class="small" style="margin:4px 4px 10px">Send each other a film every day to grow your streak.</p>
  <div class="group">${fr.map(({ f, st }) => `<button class="row" data-sf="${esc(f.id)}">${av(f)}<div class="grow"><div class="t">${esc(f.name)}</div><div class="status ${st.cls}">${esc(st.label)}</div></div>${fsPill(st)}<span class="add" data-box>${ic('plus')}</span></button>`).join('') || '<div class="row muted">Add friends first.</div>'}</div>
  <div class="stick"><button class="btn wide" id="sendGo" disabled>${ic('send')}Pick friends</button></div>`, () => {
    $$('[data-sf]').forEach(b => b.onclick = () => {
      const fid = b.dataset.sf; sel.has(fid) ? sel.delete(fid) : sel.add(fid);
      const box = b.querySelector('[data-box]'); box.classList.toggle('on', sel.has(fid)); box.innerHTML = ic(sel.has(fid) ? 'check' : 'plus');
      const g = $('#sendGo'); g.disabled = !sel.size; g.innerHTML = `${ic('send')}${sel.size ? `Send to ${names([...sel].map(U))}` : 'Pick friends'}`;
    });
    $('#sendGo').onclick = () => { closeSheet(); sendTo([...sel], id); };
  });
}
function pickFilmSheet(fid) {
  const u = me(), f = U(fid), st = fstate(u, fid), sent = new Set(Object.values((u.ex || {})[fid] || {}).flatMap(d => d.me));
  const sugg = recommend([f], new Set([...sent])).map(r => ({ m: r.m, why: r.why.replace('Liked by ' + first(f), `On ${first(f)}'s list`) }));
  const mine = u.likes.filter(id => M[id] && !sent.has(id)).slice(0, 10).map(id => ({ m: M[id], why: 'On your list' }));
  let q = '';
  const row = ({ m, why }) => `<button class="rec" data-pick="${m.id}"><span class="mini">${poster(m)}</span><div><div class="t">${esc(m.t)}</div><div class="s">${esc(why)}</div></div><span class="add">${ic('send')}</span></button>`;
  openSheet(`<div class="shead"><button class="back" id="pfBack" aria-label="Back">${ic('back')}</button><b>Send to ${esc(first(f))}</b><span class="grow"></span>${fsPill(st)}</div>
  <p class="status ${st.cls}" style="margin:6px 4px 12px">${esc(st.label)}</p>
  <h2 style="margin-top:6px">${esc(first(f))} would like</h2><div class="group">${sugg.map(row).join('')}</div>
  ${mine.length ? `<h2>From your list</h2><div class="group">${mine.map(row).join('')}</div>` : ''}
  <h2>Search</h2><div class="searchbox" style="margin-top:0">${ic('search')}<input class="field" id="pfQ" placeholder="Search titles" autocomplete="off"></div><div class="group" id="pfRes" style="margin-top:8px;display:none"></div>`, () => {
    const bind = root => root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { closeSheet(); sendTo([fid], b.dataset.pick); });
    bind($('#sheetBody'));
    $('#pfBack').onclick = () => friendSheet(fid);
    $('#pfQ').addEventListener('input', e => { q = norm(e.target.value.trim()); const box = $('#pfRes');
      box.style.display = q ? '' : 'none'; box.innerHTML = CATALOG.filter(m => norm(m.t).includes(q)).slice(0, 8).map(m => row({ m, why: m.g.join(' · ') })).join('') || '<div class="row muted">Nothing found.</div>'; bind(box); });
  });
}
function renderBadge() { const u = me(), n = u ? inbox(u).length : 0, d = $('#inboxDot'); d.hidden = !n; d.textContent = n; }

/* ---------- progress sheet: streak + level ---------- */
function levelBlock(u) {
  const L = lvl(u.xp || 0);
  return `<div class="lvl"><span class="badge">${ic('shield')}<b>${L.l}</b></span><div class="grow"><div class="t">Level ${L.l} · ${esc(L.title)}</div>
  <div class="xpbar"><i style="width:${L.cur / L.need * 100}%"></i></div><div class="small" style="margin-top:6px">${L.cur} / ${L.need} XP to level ${L.l + 1} · ${u.xp || 0} XP total</div></div></div>`;
}
function progressSheet() {
  const u = me(), n = todayCount(u), s = streak(u), p = Math.min(1, n / GOAL), C = 2 * Math.PI * 48;
  const week = [...Array(7)].map((_, i) => { const d = addDays(new Date(), i - 6), full = (u.hist[dkey(d)] || 0) >= GOAL;
    return `<div class="day">${d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}<span class="dot ${full ? 'full' : ''} ${i === 6 ? 'today' : ''}">${full ? ic('flame') : ''}</span></div>`; }).join('');
  const fr = u.friends.map(U).filter(Boolean).map(f => ({ f, st: fstate(u, f.id) })).sort((a, b) => b.st.s - a.st.s).slice(0, 3);
  openSheet(`<div class="shead"><b>Your progress</b></div>
  <div class="group" style="margin-top:10px"><div class="ringbox">
   <svg class="ring" viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="var(--surface2)" stroke-width="11"/><circle cx="56" cy="56" r="48" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 56 56)"/><text x="56" y="56" text-anchor="middle" font-size="26" font-weight="800" fill="currentColor">${n}</text><text x="56" y="75" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6">of ${GOAL}</text></svg>
   <div><div class="big">${pl(s, 'day', 'days')}</div><div class="sub">${n >= GOAL ? 'Swipe goal done. See you tomorrow.' : `Swipe ${GOAL - n} more to keep your streak.`}</div></div>
  </div><div class="week">${week}</div></div>
  <div class="group" style="margin-top:12px">${levelBlock(u)}</div>
  <h2>Friend streaks</h2>
  <div class="group">${fr.map(({ f, st }) => `<div class="row">${av(f)}<div class="grow"><div class="t">${esc(f.name)}</div><div class="status ${st.cls}">${esc(st.label)}</div></div>${fsPill(st)}</div>`).join('') || '<div class="row muted">Add friends to start streaks.</div>'}</div>
  <button class="btn alt wide" id="toFr" style="margin-top:12px">See all friends</button>
  <h2>How to earn XP</h2>
  <div class="group rules">${[['Swipe a title', XP.swipe], ['Like a title from a new genre', XP.explore], ['Hit the daily swipe goal', XP.goal], ['Send a film to a friend', XP.send], ['Keep a friend streak for the day', XP.keep], ['Add a friend', XP.friend], ['Mark a title as watched', XP.watch], ['Rate a title', XP.rate], ['Create a movie night', XP.plan], ['Vote in a plan', XP.vote]].map(([t, x]) => `<div class="row"><span class="grow">${t}</span><b>+${x}</b></div>`).join('')}</div>`,
  () => { $('#toFr').onclick = () => { closeSheet(); go('friends'); }; });
}

/* ---------- friends ---------- */
let fq = '';
function renderFriends() {
  const u = me(); if (!u) return;
  const focused = document.activeElement && document.activeElement.id === 'fq';
  $('#v-friends').innerHTML = `<div class="top"><h1>Friends</h1></div>
  <button class="together" id="wtBtn"><span class="orb">${ic('group-plus')}</span><span class="grow"><span class="tt">Watch together</span><span class="s">Pick friends, add titles and get 5 picks for your group</span></span>${ic('chevron')}</button>
  <div class="searchbox">${ic('search')}<input class="field" id="fq" placeholder="Find friends by name or ID" autocomplete="off" value="${esc(fq)}"></div>
  <div class="results" id="fres"></div>
  <div class="myid">Your ID <code>${esc(u.handle || u.id)}</code><button id="cpId">${ic('copy')}Copy</button></div>
  <div id="fin"></div>
  <div id="flist"></div>`;
  $('#wtBtn').onclick = () => openTogether();
  $('#cpId').onclick = () => copy(u.handle || u.id);
  $('#fq').addEventListener('input', e => { fq = e.target.value; renderResults(); });
  if (focused) { const f = $('#fq'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  renderResults(); renderInbox(); renderFriendList(); renderBadge();
}
let fqT = 0;
function renderResults() {
  const u = me(), q = norm(fq.trim()), box = $('#fres'); if (!box) return;
  clearTimeout(fqT);
  if (!q) { box.innerHTML = ''; return; }
  if (CLOUD) {
    box.innerHTML = '<div class="group"><div class="row muted">Searching…</div></div>';
    fqT = setTimeout(() => CL.search(fq).then(res => { if (norm(fq.trim()) === q) paintResults(res); })
      .catch(e => { box.innerHTML = `<div class="group"><div class="row muted">${esc(e.message)}</div></div>`; }), 300);
    return;
  }
  paintResults(Object.values(DB.users).filter(x => x.id !== u.id && (norm(x.name).includes(q) || norm(x.id).includes(q))).slice(0, 6));
}
function paintResults(res) {
  const u = me(), box = $('#fres'); if (!box || !u) return;
  box.innerHTML = `<div class="group">${res.map(x => `<div class="row">${av(x)}<div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.handle || x.id)}</div></div>${u.friends.includes(x.id) ? '<span class="small">Friend</span>' : `<button class="btn sm" data-add="${esc(x.handle || x.id)}">${ic('plus')}Add</button>`}</div>`).join('') || `<div class="row muted">No one found for “${esc(fq)}”. ${CLOUD ? 'Ask your friend for their ID (CM-1234).' : 'Try Nina or CM-6612.'}</div>`}</div>`;
  box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { b.disabled = true; addFriend(b.dataset.add); });
}
function renderInbox() {
  const u = me(), items = inbox(u), box = $('#fin'); if (!box) return;
  if (!items.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<h2>${ic('inbox')}<span class="grow">Sent to you</span><span class="small" style="font-weight:500">${items.length} new</span></h2>
  <div class="group inbox">${items.map(({ f, id, k, ago }) => { const m = M[id];
    return `<div class="rec"><span class="mini">${poster(m)}</span><div><div class="t">${esc(m.t)}</div><div class="s">from ${esc(first(f))} · ${ago ? ago === 1 ? 'yesterday' : ago + ' days ago' : 'today'}</div></div>
    <div class="acts"><button class="add" data-ib="no" data-f="${esc(f.id)}" data-k="${k}" data-id="${id}" aria-label="Not for me">${ic('x')}</button><button class="add" data-ib="yes" data-f="${esc(f.id)}" data-k="${k}" data-id="${id}" aria-label="Want to watch">${ic('heart')}</button><button class="add on" data-ib="reply" data-f="${esc(f.id)}" data-k="${k}" data-id="${id}" aria-label="Send one back">${ic('reply')}</button></div></div>`; }).join('')}</div>`;
  box.querySelectorAll('[data-ib]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const { ib, f, k, id } = b.dataset;
    if (ib === 'reply') return pickFilmSheet(f);
    u.inboxDone[f + ':' + k + ':' + id] = 1; bg(() => CL.handled(f, id, k));
    const msg = like(id, ib === 'yes' ? 1 : -1, false); save();
    toast(ib === 'yes' ? msg || `${M[id].t} added to your list` : 'Skipped');
    renderInbox(); renderBadge(); renderDeck(); renderProfile();
  });
}
function renderFriendList() {
  const u = me(), fr = u.friends.map(U).filter(Boolean).map(f => ({ f, st: fstate(u, f.id), m: matches(u, f).length })).sort((a, b) => (b.st.risk - a.st.risk) || b.st.s - a.st.s || b.m - a.m);
  $('#flist').innerHTML = `<h2>Your friends · ${fr.length}<span class="small" style="font-weight:500">Streak</span></h2>
  <div class="group">${fr.map(({ f, st, m }) => `<div class="row" data-f="${esc(f.id)}" role="button" tabindex="0">${av(f)}<div class="grow"><div class="t">${esc(f.name)}</div><div class="status ${st.cls}">${esc(st.label)}</div></div>${fsPill(st)}<button class="add ${st.mine ? '' : 'on'}" data-send="${esc(f.id)}" aria-label="Send a film to ${esc(first(f))}">${ic('send')}</button></div>`).join('') || '<div class="row muted">No friends yet. Search above to add someone.</div>'}</div>
  <p class="small" style="margin:10px 4px">Send each other at least one film every day and the flame grows. The hourglass means the streak ends at midnight unless you both send. ${CLOUD ? '' : 'Friends here are demo accounts and reply after a few seconds.'}</p>`;
  $$('#flist [data-f]').forEach(b => b.onclick = () => friendSheet(b.dataset.f));
  $$('#flist [data-send]').forEach(b => b.onclick = e => { e.stopPropagation(); pickFilmSheet(b.dataset.send); });
}
async function addFriend(handle) {
  if (CLOUD) {
    try { const f = await CL.addFriend(handle); await reloadCloud(); gain(XP.friend, 'fr:' + f.id); toast(`${f.name} added. Send a film to start a streak`); renderResults(); }
    catch (e) { toast(e.message); renderResults(); }
    return;
  }
  const id = handle, u = me(); if (u.friends.includes(id) || id === u.id || !U(id)) return;
  u.friends.push(id); save(); gain(XP.friend, 'fr:' + id); toast(`${U(id).name} added. Send a film to start a streak`);
  renderResults(); renderFriendList();
}
function friendSheet(fid) {
  const u = me(), f = U(fid); u.seen = u.seen || {};
  const draw = () => {
    const ms = matches(u, f), st = fstate(u, fid);
    const week = [...Array(7)].map((_, i) => { const d = addDays(new Date(), i - 6), ok = both(u, fid, 6 - i), e = exDay(u, fid, dkey(d)), half = !ok && (e.me.length || e.them.length);
      return `<div class="day">${d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}<span class="dot ${ok ? 'full' : ''} ${i === 6 ? 'today' : ''}" style="${half ? 'background:var(--accent-soft)' : ''}">${ok ? ic('flame') : half ? ic('send', 'muted') : ''}</span></div>`; }).join('');
    $('#sheetBody').innerHTML = `<div style="display:flex;align-items:center;gap:14px">${av(f, 'lg')}<div class="grow"><div class="pn" style="font-size:34px">${esc(f.name)}</div><div class="small">${esc(f.handle || f.id)} · ${pl(ms.length, 'shared title', 'shared titles')}</div></div></div>
    <div class="group" style="margin-top:16px"><div class="ringbox" style="grid-template-columns:1fr auto;padding-bottom:12px"><div><div class="big">${pl(st.s, 'day', 'days')}</div><div class="status ${st.cls}" style="margin-top:4px">${esc(st.label)}</div></div>${fsPill(st)}</div><div class="week">${week}</div></div>
    <button class="btn wide" id="sendF" style="margin-top:12px">${ic('send')}Send ${esc(first(f))} a film</button>
    <div class="chips" style="margin-top:14px">${(f.genres || []).map(g => `<span class="chip" style="min-height:30px">${esc(g)}</span>`).join('')}</div>
    <h2>You both want to see</h2>
    <p class="small" style="margin:-4px 4px 10px">Tick when you've watched it. Ticked by both = watched together.</p>
    <div class="group">${ms.map(id => { const k = fid + ':' + id, w = { me: !!u.seen[id], them: f.mock ? hash(k) % 3 === 0 : !!(f.seen || {})[id] }, m = M[id];
      return `<div class="row"><span class="mini">${poster(m)}</span><div class="grow"><div class="t">${esc(m.t)}</div><div class="s">${esc(m.k)} · ${esc(m.g[0])}</div>${w.me && w.them ? `<div class="okb">Watched together</div>` : ''}</div>
      <button class="chk ${w.me ? 'on' : ''}" data-w="${id}"><span>${ic('check')}</span>You</button><div class="chk ${w.them ? 'on' : ''}"><span>${ic('check')}</span>${esc(first(f))}</div></div>`; }).join('') || '<div class="row muted">No matches yet. Keep swiping.</div>'}</div>
    <button class="btn alt wide" id="planWith" style="margin-top:16px">${ic('group-plus')}Watch together with ${esc(first(f))}</button>
    <button class="btn alt wide" id="rmF" style="margin-top:10px">Remove friend</button>`;
    $$('[data-w]').forEach(b => b.onclick = () => { setSeen(b.dataset.w, !u.seen[b.dataset.w]); draw(); renderProfile(); });
    $('#sendF').onclick = () => pickFilmSheet(fid);
    $('#planWith').onclick = () => openTogether([fid]);
    $('#rmF').onclick = () => { u.friends = u.friends.filter(x => x !== fid); save(); bg(() => CL.removeFriend(fid)); closeSheet(); renderFriends(); };
  };
  openSheet('', draw);
}

/* ---------- custom calendar ---------- */
function calendar(host, value, onPick) {
  const t0 = midnight(), evDates = new Set(me().events.map(e => e.date));
  let sel = value, view = new Date(value + 'T00:00'); view.setDate(1);
  const quick = () => [['Tonight', dkey(t0)], ['Friday', nextDow(5)], ['Saturday', nextDow(6)], ['Sunday', nextDow(0)], ['Next weekend', dkey(addDays(new Date(nextDow(6) + 'T00:00'), 7))]];
  const draw = () => {
    const y = view.getFullYear(), m = view.getMonth(), lead = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    const atMin = y === t0.getFullYear() && m === t0.getMonth();
    let cells = ''; for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const dt = new Date(y, m, d), k = dkey(dt), dw = dt.getDay();
      cells += `<button type="button" class="d ${dw === 0 || dw === 6 ? 'we' : ''} ${k === dkey(t0) ? 'today' : ''} ${k === sel ? 'sel' : ''} ${evDates.has(k) ? 'ev' : ''}" data-k="${k}" ${dt < t0 ? 'disabled' : ''} aria-label="${fmtDate(k)}">${d}</button>`;
    }
    host.innerHTML = `<div class="cal"><div class="quick">${quick().map(([l, k]) => `<button type="button" class="chip ${k === sel ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="mh"><button type="button" class="nav" data-m="-1" ${atMin ? 'disabled' : ''} aria-label="Previous month">${ic('back')}</button><b>${view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><button type="button" class="nav" data-m="1" aria-label="Next month">${ic('chevron')}</button></div>
    <div class="wd">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(x => `<span>${x}</span>`).join('')}</div><div class="grid">${cells}</div>
    <div class="pick">${ic('calendar')}<span class="grow">${fmtDate(sel)}</span><span class="muted">${countdown(sel)}</span></div></div>`;
    host.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { sel = b.dataset.k; const d = new Date(sel + 'T00:00'); view = new Date(d.getFullYear(), d.getMonth(), 1); onPick(sel); N.haptic('LIGHT'); draw(); });
    host.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + +b.dataset.m, 1); draw(); });
  };
  draw();
  /* horizontal swipe on the grid changes month */
  let sx = null;
  host.addEventListener('pointerdown', e => { if (e.target.closest('.grid')) sx = e.clientX; });
  host.addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) < 50) return;
    const back = dx > 0; if (back && view.getFullYear() === t0.getFullYear() && view.getMonth() === t0.getMonth()) return;
    view = new Date(view.getFullYear(), view.getMonth() + (back ? -1 : 1), 1); draw(); });
}

/* ---------- watch together: friends → titles (+5 picks) → date ---------- */
let wt = null;
function recommend(people, exclude) {
  return CATALOG.filter(m => !exclude.has(m.id)).map(m => {
    const likers = people.filter(p => p.likes.includes(m.id));
    const fans = people.filter(p => (p.genres || []).some(g => m.g.includes(g)));
    const score = likers.length * 3 + fans.length * 1.2 + m.r / 10 - (me().skips.includes(m.id) ? 2 : 0);
    const g = m.g.find(g => fans.some(p => p.genres.includes(g)));
    const why = likers.length ? `Liked by ${names(likers)}` : fans.length ? `${g} · fits ${fans.length === people.length && people.length > 1 ? 'all of you' : names(fans)}` : `Highly rated ${m.g[0]}`;
    return { m, score, why };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
}
function openTogether(pre = [], date) {
  wt = { step: pre.length ? 2 : 1, friends: new Set(pre), titles: new Set(), q: '', title: 'Movie night', date: date || nextSat() };
  openSheet('', drawWT);
}
function titleRow(m, why) {
  const on = wt.titles.has(m.id);
  return `<div class="rec"><span class="mini">${poster(m)}</span><div><div class="t">${esc(m.t)}</div><div class="s">${esc(why)}</div></div><button class="add ${on ? 'on' : ''}" data-t="${m.id}" aria-label="${on ? 'Remove' : 'Add'} ${esc(m.t)}">${ic(on ? 'check' : 'plus')}</button></div>`;
}
function bindAdds(root) {
  root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const id = b.dataset.t; wt.titles.has(id) ? wt.titles.delete(id) : wt.titles.add(id);
    $$(`#sheetBody [data-t="${id}"]`).forEach(x => { const on = wt.titles.has(id); x.classList.toggle('on', on); x.innerHTML = ic(on ? 'check' : 'plus'); });
    const n = wt.titles.size, nx = $('#wtNext'); nx.disabled = n < 2; nx.textContent = n < 2 ? `Add ${2 - n} more` : `Next · ${n} titles`;
  });
}
function drawWT() {
  const u = me(), b = $('#sheetBody');
  const head = t => `<div class="shead">${wt.step > 1 ? `<button class="back" id="wtBack" aria-label="Back">${ic('back')}</button>` : ''}<b>${t}</b></div><div class="steps">${[1, 2, 3].map(i => `<i class="${i <= wt.step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (wt.step === 1) {
    const fr = u.friends.map(U).filter(Boolean);
    b.innerHTML = head("Who's watching?") + `<p class="sub" style="margin-top:0">Pick the friends for this movie night.</p>
    <div class="chips">${fr.map(f => `<button class="chip ${wt.friends.has(f.id) ? 'on' : ''}" data-p="${esc(f.id)}">${av(f, 'sm')}${esc(f.name.split(' ')[0])}</button>`).join('') || '<span class="small">Add friends first.</span>'}</div>
    <button class="btn wide" id="wtNext" style="margin-top:20px" ${wt.friends.size ? '' : 'disabled'}>Next</button>`;
    $$('[data-p]').forEach(c => c.onclick = () => { const id = c.dataset.p; wt.friends.has(id) ? wt.friends.delete(id) : wt.friends.add(id); c.classList.toggle('on'); $('#wtNext').disabled = !wt.friends.size; });
    $('#wtNext').onclick = () => { wt.step = 2; drawWT(); $('#sheetBody').scrollTop = 0; };
    return;
  }
  const people = [u, ...[...wt.friends].map(U).filter(Boolean)];
  if (wt.step === 2) {
    const mutual = CATALOG.filter(m => people.filter(p => p.likes.includes(m.id)).length >= 2);
    const recs = recommend(people, new Set(mutual.map(m => m.id)));
    const n = wt.titles.size;
    b.innerHTML = head('What could you watch?') + `<div class="avs" style="margin:-2px 0 8px">${people.map(p => av(p, 'sm')).join('')}</div>
    <h2 style="margin-top:8px">${ic('sparkle')}<span class="grow">Picked for your group</span></h2>
    <div class="group">${recs.map(r => titleRow(r.m, r.why)).join('')}</div>
    <h2>You already want these</h2>
    <div class="group">${mutual.map(m => titleRow(m, 'Wanted by ' + names(people.filter(p => p.likes.includes(m.id))))).join('') || '<div class="row muted">No shared likes in this group yet.</div>'}</div>
    <h2>Search everything</h2>
    <div class="searchbox" style="margin-top:0">${ic('search')}<input class="field" id="wtQ" placeholder="Search titles" value="${esc(wt.q)}" autocomplete="off"></div>
    <div class="group" id="wtRes" style="margin-top:8px"></div>
    <div class="stick"><button class="btn wide" id="wtNext" ${n < 2 ? 'disabled' : ''}>${n < 2 ? `Add ${2 - n} more` : `Next · ${n} titles`}</button></div>`;
    const res = () => { const q = norm(wt.q.trim()), box = $('#wtRes');
      box.innerHTML = q ? CATALOG.filter(m => norm(m.t).includes(q) || m.g.some(g => norm(g).includes(q))).slice(0, 8).map(m => titleRow(m, m.g.join(' · '))).join('') || '<div class="row muted">Nothing found.</div>' : '';
      box.style.display = q ? '' : 'none'; bindAdds(box); };
    $('#wtQ').addEventListener('input', e => { wt.q = e.target.value; res(); });
    bindAdds(b); res();
    $('#wtNext').onclick = () => { wt.step = 3; drawWT(); $('#sheetBody').scrollTop = 0; };
  } else {
    b.innerHTML = head('When?') + `<label class="l" for="wtT">Name</label><input class="field" id="wtT" value="${esc(wt.title)}">
    <label class="l">Date</label><div id="wtCal"></div>
    <label class="l">Guests</label><div class="chips">${people.slice(1).map(p => `<span class="chip">${av(p, 'sm')}${esc(p.name.split(' ')[0])}</span>`).join('')}</div>
    <label class="l">Up for a vote</label><div class="group">${[...wt.titles].map(id => `<div class="row"><span class="mini">${poster(M[id])}</span><span class="grow t">${esc(M[id].t)}</span></div>`).join('')}</div>
    <p class="small" style="margin:10px 4px">Everyone votes until the day. A tie is settled by a coin flip.</p>
    <button class="btn wide" id="wtGo">${ic('calendar')}Create movie night</button>`;
    $('#wtT').oninput = e => wt.title = e.target.value;
    calendar($('#wtCal'), wt.date, k => wt.date = k);
    $('#wtGo').onclick = () => {
      const cands = [...wt.titles], guests = [...wt.friends], votes = {};
      if (CLOUD) {
        const btn = $('#wtGo'); btn.disabled = true;
        CL.createEvent(wt.title.trim() || 'Movie night', wt.date || nextSat(), cands, guests)
          .then(async id => { await reloadCloud(); closeSheet(); go('plan'); gain(XP.plan, 'plan:' + id); toast('Movie night created. Friends can vote now'); })
          .catch(e => { btn.disabled = false; toast(e.message); });
        return;
      }
      guests.forEach(g => { const p = U(g); votes[g] = cands.map(id => ({ id, s: (p.likes.includes(id) ? 3 : 0) + M[id].g.filter(x => (p.genres || []).includes(x)).length + (hash(g + id) % 10) / 10 })).sort((a, b) => b.s - a.s)[0].id; });
      u.events.push({ id: 'e' + Date.now(), title: wt.title.trim() || 'Movie night', date: wt.date || nextSat(), host: u.id, guests, cands, votes, winner: null });
      save(); closeSheet(); renderPlan(); go('plan'); gain(XP.plan, 'plan:' + u.events[u.events.length - 1].id); toast('Movie night created, friends are voting');
    };
  }
  const bk = $('#wtBack'); if (bk) bk.onclick = () => { wt.step--; drawWT(); };
}

/* ---------- weekend plans ---------- */
function countdown(date) { const n = Math.round((new Date(date + 'T00:00') - midnight()) / 864e5); return n < 0 ? 'Past' : n === 0 ? 'Tonight' : n === 1 ? 'Tomorrow' : `In ${n} days`; }
function tally(ev) { const c = Object.fromEntries(ev.cands.map(id => [id, 0])); Object.values(ev.votes).forEach(v => { if (v in c) c[v]++; }); return c; }
function renderPlan() {
  const u = me(); if (!u) return;
  const byDate = {}; u.events.forEach(e => (byDate[e.date] = byDate[e.date] || []).push(e));
  const strip = [...Array(14)].map((_, i) => { const d = addDays(midnight(), i), k = dkey(d), dw = d.getDay();
    return `<button class="${dw === 0 || dw === 6 ? 'we' : ''} ${byDate[k] ? 'has' : ''}" data-day="${k}" aria-label="${fmtDate(k)}${byDate[k] ? ', has a plan' : ''}">${d.toLocaleDateString('en-GB', { weekday: 'short' })}<b>${d.getDate()}</b><i></i></button>`; }).join('');
  $('#v-plan').innerHTML = `<div class="top"><div><h1>Weekend</h1><div class="sub">Suggest, vote, watch.</div></div><button class="btn sm" id="newEv">${ic('plus')}New</button></div>
  <div class="strip" id="strip">${strip}</div>
  ${u.events.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(ev => {
    const c = tally(ev), total = Object.values(c).reduce((a, b) => a + b, 0) || 1, people = [ev.host, ...ev.guests].map(U).filter(Boolean);
    return `<article class="ev" id="ev-${ev.id}" data-ev="${ev.id}"><div class="head"><div><div class="et">${esc(ev.title)}</div><div class="when">${fmtDate(ev.date)} · hosted by ${esc(first(U(ev.host)))}</div></div><span class="cd">${countdown(ev.date)}</span></div>
    <div class="avs" style="margin-top:10px">${people.map(p => av(p, 'sm')).join('')}</div>
    ${ev.cands.filter(id => M[id]).map(id => { const m = M[id], n = c[id], voters = Object.entries(ev.votes).filter(([, v]) => v === id).map(([k]) => U(k)).filter(Boolean);
      return `<button class="cand ${ev.votes[u.id] === id ? 'mine' : ''}" data-vote="${id}"><span class="mini">${poster(m)}</span><div><div style="font-weight:600">${esc(m.t)}</div><div class="avs" style="margin-top:4px;min-height:26px">${voters.map(p => av(p, 'sm')).join('')}</div><div class="bar"><i style="width:${n / total * 100}%"></i></div></div><span class="votes">${n}</span></button>`; }).join('')}
    ${ev.winner && M[ev.winner] ? `<div class="winner">${ic('trophy')}You're watching ${esc(M[ev.winner].t)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn wide" data-decide="${ev.id}">${ic('coin')}${ev.winner ? 'Decide again' : 'Decide'}</button>${ev.host === u.id ? `<button class="btn alt" data-del="${ev.id}">Delete</button>` : ''}</div>
    <p class="small" style="margin:8px 2px 0">${ev.votes[u.id] ? 'Tap another title to change your vote.' : 'Tap a title to vote.'} A tie is settled by a coin flip.</p></article>`;
  }).join('') || '<div class="group"><div class="row muted">No plans yet. Tap a day above or New.</div></div>'}
  ${CLOUD ? '' : `<p class="small" style="margin:10px 4px">Friends' votes are simulated in demo mode.</p>`}`;
  $('#newEv').onclick = () => openTogether();
  $$('#strip [data-day]').forEach(b => b.onclick = () => { const k = b.dataset.day; if (byDate[k]) $('#ev-' + byDate[k][0].id).scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }); else openTogether([], k); });
  $$('[data-vote]').forEach(b => b.onclick = () => { const ev = u.events.find(e => e.id === b.closest('.ev').dataset.ev); ev.votes[u.id] = b.dataset.vote; ev.winner = null; save(); bg(() => CL.vote(ev.id, b.dataset.vote)); renderPlan(); gain(XP.vote, 'vote:' + ev.id); });
  $$('[data-decide]').forEach(b => b.onclick = () => decide(u.events.find(e => e.id === b.dataset.decide)));
  $$('[data-del]').forEach(b => b.onclick = () => { const did = b.dataset.del; u.events = u.events.filter(e => e.id !== did); save(); bg(() => CL.deleteEvent(did)); renderPlan(); toast('Plan deleted'); });
}
async function decide(ev) {
  const c = tally(ev), max = Math.max(...Object.values(c)); let tied = ev.cands.filter(id => c[id] === max && M[id]);
  while (tied.length > 1) { const w = await flip(tied[0], tied[1]); tied = [w, ...tied.slice(2)]; }
  ev.winner = tied[0]; save(); bg(() => CL.setWinner(ev.id, ev.winner)); renderPlan(); toast(`Winner: ${M[ev.winner].t}`);
}
function flip(a, b) {
  return new Promise(res => {
    const A = M[a], B = M[b], w = Math.random() < .5 ? a : b;
    const face = (el, m) => { const [c1, c2] = tones(m); el.style.background = `radial-gradient(circle at 40% 35%,${c1},${c2})`; el.textContent = m.t; };
    face($('#cfA'), A); face($('#cfB'), B); $('#coinTitle').textContent = `It's a tie: ${A.t} vs ${B.t}`; $('#cres').innerHTML = ''; $('#cOk').style.visibility = 'hidden';
    $('#coinwrap').classList.add('on'); const coin = $('#coin'), sh = $('#cshadow');
    const target = (6 + Math.floor(Math.random() * 3)) * 360 + (w === a ? 0 : 180), t0 = performance.now();
    const end = () => { N.haptic('MEDIUM'); $('#cres').innerHTML = `<span style="opacity:.8">The coin picked</span><b>${esc(M[w].t)}</b>`; $('#cOk').style.visibility = 'visible'; $('#cOk').onclick = () => { $('#coinwrap').classList.remove('on'); res(w); }; };
    coin.style.transform = 'rotateX(0deg)';
    setTimeout(() => spring({ from: 0, to: target, velocity: 2600, damping: 1, response: 1.15, eps: .5,
      onUpdate: v => { const t = (performance.now() - t0 - 150) / 1000, T = .95, h = t > 0 && t < T ? 4 * (t / T) * (1 - t / T) : 0;
        coin.style.transform = `translateY(${-h * 170}px) rotateX(${v}deg)`; sh.style.transform = `scale(${1 - h * .55})`; sh.style.opacity = 1 - h * .6; },
      onDone: () => { coin.style.transform = `rotateX(${target}deg)`; end(); } }), 150);
  });
}

/* ---------- profile ---------- */
let libF = 'all';
function renderProfile() {
  const u = me(); if (!u) return; u.seen = u.seen || {}; u.ratings = u.ratings || {};
  const liked = u.likes.filter(id => M[id]), seenN = liked.filter(id => u.seen[id]).length;
  const rated = Object.entries(u.ratings).filter(([, r]) => r), avg = rated.length ? (rated.reduce((a, [, r]) => a + r, 0) / rated.length).toFixed(1) : '–';
  const pass = id => libF === 'all' || (libF === 'seen' ? u.seen[id] : !u.seen[id]);
  const groups = {}; liked.filter(pass).forEach(id => { const g = M[id].g[0]; (groups[g] = groups[g] || []).push(id); });
  const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const best = u.friends.map(U).filter(Boolean).reduce((b, f) => { const s = fstreak(u, f.id); return s > b.s ? { f, s } : b; }, { f: null, s: 0 });
  $('#v-profile').innerHTML = `<div class="top"><h1>Profile</h1></div>
  <div class="phead">${av(u, 'lg')}<div><div class="pn">${esc(u.name)}</div><div class="small">${esc(u.email || '')}${u.provider === 'google' ? ' · Google' : ''}</div></div></div>
  <button class="group" id="pLvl" style="width:100%;text-align:left;display:block">${levelBlock(u)}</button>
  <div class="stats" style="margin-top:10px"><div class="stat"><b>${liked.length}</b><span class="small">want to see</span></div><div class="stat"><b>${seenN}</b><span class="small">watched</span></div><div class="stat"><b>${avg}</b><span class="small">avg rating</span></div></div>
  ${best.f ? `<div class="group" style="margin-top:10px"><div class="row">${ic('flame', 'muted')}<span class="grow">Longest friend streak</span><b>${esc(first(best.f))} · ${pl(best.s, 'day', 'days')}</b></div></div>` : ''}
  <h2>Your genres <button class="btn sm alt" id="edG">${ic('edit')}Edit</button></h2>
  <div class="chips">${(u.genres || []).map(g => `<span class="chip on">${esc(g)}</span>`).join('')}</div>
  <h2>Your library</h2>
  <div class="seg" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">${[['all', 'All'], ['todo', 'To watch'], ['seen', 'Watched']].map(([k, t]) => `<button data-lf="${k}" class="${libF === k ? 'on' : ''}">${t}</button>`).join('')}</div>
  ${order.length ? order.map(g => `<div class="gh" style="margin:18px 4px 8px"><b>${esc(g)}</b><span class="small">${groups[g].length}</span>${(u.genres || []).includes(g) ? '' : `<span class="newg">${ic('star-fill')}New</span>`}</div>
    <div class="group lib">${groups[g].map(id => { const m = M[id], s = !!u.seen[id], r = u.ratings[id] || 0;
      return `<div class="row"><span class="mini">${poster(m)}</span><div class="grow"><div class="t">${esc(m.t)}</div><div class="s">${esc(m.k)} · ${esc(m.y)}</div>
      <div class="stars ${s ? '' : 'off'}" aria-label="Rating">${[1, 2, 3, 4, 5].map(i => `<button data-r="${id}" data-n="${i}" aria-label="${i} stars">${ic(i <= r ? 'star-fill' : 'star')}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><button class="seen ${s ? 'on' : ''}" data-s="${id}">${ic(s ? 'check' : 'eye')}${s ? 'Watched' : 'Seen it?'}</button><button class="seen" data-sendm="${id}">${ic('send')}Send</button></div></div>`; }).join('')}</div>`).join('')
    : `<div class="group"><div class="row muted">${liked.length ? 'Nothing in this filter.' : 'Swipe right on titles to build your library.'}</div></div>`}
  <h2>Appearance</h2>
  <div class="seg" style="grid-template-columns:repeat(3,1fr)">${[['system', 'monitor', 'Auto'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([k, i, t]) => `<button data-th="${k}" class="${prefs.theme === k ? 'on' : ''}">${ic(i)}${t}</button>`).join('')}</div>
  <div class="group" style="margin-top:10px"><button class="row" id="crtT">${ic('crt', 'muted')}<span class="grow"><span class="t" style="display:block">CRT effect</span><span class="s">Scanlines, glow and the rolling refresh bar</span></span><span class="switch ${prefs.crt ? 'on' : ''}" role="switch" aria-checked="${prefs.crt}"></span></button>
  <button class="row" id="hintR">${ic('hand', 'muted')}<span class="grow">Show the swipe tip again</span></button></div>
  <h2>Account</h2>
  <div class="group">
   <button class="row" id="pId">${ic('copy', 'muted')}<span class="grow">Your ID</span><code style="font-weight:600">${esc(u.handle || u.id)}</code></button>
   <div class="row">${ic(u.provider === 'google' ? 'google' : 'mail', 'muted')}<span class="grow">Sign-in method</span><span class="muted">${u.provider === 'google' ? 'Google' : 'Email'}</span></div>
   <div class="row">${ic('key', 'muted')}<span class="grow">Your data</span><span class="muted">${CLOUD ? 'Synced to the cloud' : 'This device only (demo)'}</span></div>
   <div class="row">${ic('film', 'muted')}<span class="grow">Catalog</span><span class="muted">${TMDB_LIVE ? 'TMDB live' : 'Demo catalog'}</span></div>
   <div class="row">${ic('tv', 'muted')}<span class="grow">Running as</span><span class="muted">${N.native ? 'Android app' : 'Web app'}</span></div>
   <button class="row" id="pOut">${ic('logout')}<span class="grow">Sign out</span></button>
  </div>
  <details style="margin-top:14px"><summary class="small" style="cursor:pointer;min-height:32px">Developer setup</summary>
   <p class="small">Setup steps are in SETUP.md in the GitHub repo. Replace any icon in <code>icons/</code>.</p>
   <div class="cfg">SUPABASE_URL:         ${CFG.SUPABASE_URL ? 'set' : '–'}\nServer reachable:     ${CLOUD ? 'yes' : 'no'}\nTMDB catalog:         ${TMDB_LIVE ? 'live' : 'demo'}\nGOOGLE_WEB_CLIENT_ID: ${CFG.GOOGLE_WEB_CLIENT_ID ? 'set' : '–'}\nDEMO_MODE:            ${!!CFG.DEMO_MODE}</div>
  </details>`;
  $('#pLvl').onclick = progressSheet; $('#edG').onclick = () => showOnboard(true);
  $$('[data-th]').forEach(b => b.onclick = () => { prefs.theme = b.dataset.th; applyPrefs(); renderProfile(); });
  $('#crtT').onclick = () => { prefs.crt = !prefs.crt; applyPrefs(); renderProfile(); };
  $('#hintR').onclick = () => { setHintDone(false); go('discover'); toast('Tip shows if you wait 3 seconds'); };
  $('#pId').onclick = () => copy(u.handle || u.id); $('#pOut').onclick = logout;
  $$('[data-lf]').forEach(b => b.onclick = () => { libF = b.dataset.lf; renderProfile(); });
  $$('[data-sendm]').forEach(b => b.onclick = () => sendSheet(b.dataset.sendm));
  $$('[data-s]').forEach(b => b.onclick = () => { setSeen(b.dataset.s, !u.seen[b.dataset.s]); renderProfile(); });
  $$('[data-r]').forEach(b => b.onclick = () => {
    const id = b.dataset.r, n = +b.dataset.n; if (!u.seen[id]) return toast('Mark it as watched first, then rate it');
    u.ratings[id] = u.ratings[id] === n ? 0 : n; save(); bg(() => CL.setWatched(id, true, u.ratings[id])); if (u.ratings[id]) gain(XP.rate, 'rate:' + id); renderProfile();
  });
}

function setSeen(id, v) {
  const u = me(); u.seen = u.seen || {}; u.ratings = u.ratings || {};
  if (v) u.seen[id] = true; else { delete u.seen[id]; delete u.ratings[id]; }
  save(); bg(() => CL.setWatched(id, v, u.ratings[id])); if (v) gain(XP.watch, 'seen:' + id);
}
function renderAll() { renderDeck(); renderFriends(); renderPlan(); renderProfile(); renderBadge(); }

/* ---------- native (Capacitor) integration ---------- */
N.onBack(() => {
  if ($('#coinwrap').classList.contains('on')) return;
  if ($('#lvup').classList.contains('on')) return $('#lvup').classList.remove('on');
  if (sheetOpen) return closeSheet();
  const scr = ($$('.screen.on')[0] || {}).id;
  if (scr === 's-onboard' && obEdit) { route(); return go('profile'); }
  if (scr === 's-main' && cur !== 'discover') return go('discover');
  N.exit();
});
N.statusBar();

/* ---------- boot: splash while icons, catalog and server check load ---------- */
const t0 = performance.now();
let splashGone = false;
function hideSplash() { if (splashGone) return; splashGone = true; const s = $('#splash'); s.classList.add('out'); setTimeout(() => s.remove(), 500); }
$('#splash').addEventListener('click', hideSplash);
(async () => {
  const [, , up] = await Promise.all([loadIcons(), loadCatalog(), CL.configured ? CL.reachable() : Promise.resolve(false)]);
  CLOUD = !!up;
  $('#demoBtn').hidden = CLOUD;
  $('#authNote').textContent = CLOUD ? 'Your account syncs across all your devices.' : 'Offline demo: accounts are stored only on this device.';
  $('#fPass').minLength = CLOUD ? 6 : 4;
  if (CL.configured && !CLOUD) setTimeout(() => toast('Server unreachable · running the offline demo'), 2600);
  if (CLOUD) {
    DB = { users: {}, session: null };
    await new Promise(res => { let first = true; CL.onAuth((ev, s) => { const p = onCloudAuth(ev, s); if (first) { first = false; p.then(res, res); } }); });
  } else route();
  N.hideSplash();
  setTimeout(hideSplash, Math.max(0, (RM.matches ? 300 : 2300) - (performance.now() - t0)));
})();
}
