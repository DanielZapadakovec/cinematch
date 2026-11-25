/*
 * Supabase data layer. Every call is used only when the app runs in cloud mode
 * (SUPABASE_URL + SUPABASE_KEY set, DEMO_MODE false, server reachable).
 * Table / RPC definitions: supabase/migrations/0001_cinematch.sql
 */
window.Cloud = (() => {
  const C = window.CINEMATCH_CONFIG || {};
  const configured = !C.DEMO_MODE && !!(C.SUPABASE_URL && C.SUPABASE_KEY) && !!window.supabase;
  let sb = null, uid = null, channel = null;

  const client = () => sb || (sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  }));
  const ok = ({ data, error }) => { if (error) throw new Error(error.message || String(error)); return data; };
  const redirect = () => location.origin + location.pathname;

  async function reachable() {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(C.SUPABASE_URL + '/auth/v1/health', { headers: { apikey: C.SUPABASE_KEY }, signal: ctl.signal });
      clearTimeout(t); return r.status < 500;
    } catch (e) { return false; }
  }

  /* ---------- auth ---------- */
  async function session() { const { data } = await client().auth.getSession(); uid = data.session?.user?.id || null; return data.session; }
  function onAuth(cb) { client().auth.onAuthStateChange((ev, s) => { uid = s?.user?.id || null; setTimeout(() => cb(ev, s), 0); }); }
  async function signUp(email, password, name) {
    return ok(await client().auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: redirect() } }));
  }
  async function signIn(email, password) { return ok(await client().auth.signInWithPassword({ email, password })); }
  async function googleWeb() { return ok(await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } })); }
  async function googleIdToken(token, nonce) { return ok(await client().auth.signInWithIdToken({ provider: 'google', token, nonce })); }
  async function resetPassword(email) { return ok(await client().auth.resetPasswordForEmail(email, { redirectTo: redirect() })); }
  async function signOut() { unsubscribe(); await client().auth.signOut(); uid = null; }

  /* ---------- load everything the app needs after sign-in ---------- */
  async function load(sinceDay, fromDay) {
    const db = client();
    const me = ok(await db.from('profiles').select('*').eq('id', uid).single());
    const friends = ok(await db.from('friendships').select('friend_id').eq('user_id', uid)).map(r => r.friend_id);
    const people = [uid, ...friends];
    const [swipes, watched, sends, events, xp] = await Promise.all([
      db.from('swipes').select('user_id,movie_id,dir,day').in('user_id', people).limit(10000).then(ok),
      db.from('watched').select('user_id,movie_id,seen,rating').in('user_id', people).limit(10000).then(ok),
      db.from('film_sends').select('id,from_id,to_id,movie_id,day,handled').or(`from_id.eq.${uid},to_id.eq.${uid}`).gte('day', sinceDay).limit(5000).then(ok),
      db.from('events').select('id,host_id,title,date,cands,winner,event_guests(user_id),votes(user_id,movie_id)').gte('date', fromDay).order('date').then(ok),
      db.from('xp_log').select('key').eq('user_id', uid).limit(20000).then(ok)
    ]);
    const ids = new Set(friends);
    events.forEach(e => { ids.add(e.host_id); e.event_guests.forEach(g => ids.add(g.user_id)); });
    ids.delete(uid);
    const profiles = ids.size ? ok(await db.from('profiles').select('id,handle,name,color,genres').in('id', [...ids])) : [];
    return { me, friends, profiles, swipes, watched, sends, events, xpKeys: xp.map(r => r.key) };
  }

  /* ---------- writes ---------- */
  const clean = q => String(q).replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 40);
  async function search(q) {
    const s = clean(q); if (!s) return [];
    return ok(await client().from('profiles').select('id,handle,name,color,genres').or(`name.ilike.%${s}%,handle.ilike.%${s}%`).neq('id', uid).limit(8));
  }
  const addFriend = async handle => ok(await client().rpc('add_friend', { friend_handle: handle }));
  const removeFriend = async id => ok(await client().rpc('remove_friend', { friend: id }));
  const updateProfile = async patch => ok(await client().from('profiles').update(patch).eq('id', uid));
  const swipe = async (movie_id, dir, day) => ok(await client().from('swipes').upsert({ user_id: uid, movie_id, dir, day }));
  const unswipe = async movie_id => ok(await client().from('swipes').delete().eq('user_id', uid).eq('movie_id', movie_id));
  const gainXp = async (key, amount) => ok(await client().rpc('gain_xp', { reward_key: key.slice(0, 120), amount }));
  const send = async (toIds, movie_id, day) => ok(await client().from('film_sends').insert(toIds.map(to_id => ({ from_id: uid, to_id, movie_id, day }))));
  const handled = async (from_id, movie_id, day) => ok(await client().from('film_sends').update({ handled: true }).eq('to_id', uid).eq('from_id', from_id).eq('movie_id', movie_id).eq('day', day));
  async function setWatched(movie_id, seen, rating) {
    if (!seen) return ok(await client().from('watched').delete().eq('user_id', uid).eq('movie_id', movie_id));
    return ok(await client().from('watched').upsert({ user_id: uid, movie_id, seen: true, rating: rating || null, updated_at: new Date().toISOString() }));
  }
  const createEvent = async (title, date, cands, guests) => ok(await client().rpc('create_event', { p_title: title, p_date: date, p_cands: cands, p_guests: guests }));
  const vote = async (event_id, movie_id) => ok(await client().from('votes').upsert({ event_id, user_id: uid, movie_id, updated_at: new Date().toISOString() }));
  const setWinner = async (id, winner) => ok(await client().from('events').update({ winner }).eq('id', id));
  const deleteEvent = async id => ok(await client().from('events').delete().eq('id', id));

  /* ---------- realtime ---------- */
  function subscribe(h) {
    unsubscribe();
    channel = client().channel('cm-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'film_sends', filter: `to_id=eq.${uid}` }, p => h.sent && h.sent(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, p => h.votes && h.votes(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${uid}` }, () => h.friends && h.friends())
      .subscribe();
  }
  function unsubscribe() { if (channel) { client().removeChannel(channel); channel = null; } }

  return {
    configured, reachable, session, onAuth, signUp, signIn, googleWeb, googleIdToken, resetPassword, signOut,
    load, search, addFriend, removeFriend, updateProfile, swipe, unswipe, gainXp, send, handled, setWatched,
    createEvent, vote, setWinner, deleteEvent, subscribe, unsubscribe, get uid() { return uid; }
  };
})();
