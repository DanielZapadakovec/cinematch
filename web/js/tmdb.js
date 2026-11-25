/*
 * TMDB adapter. Turns TMDB "trending" results into the same shape the
 * demo catalog uses:  {id, t, y, k, g:[genres], len, r, d, poster, c:[a,b], s}
 * Goes through the Supabase Edge Function "tmdb" (key stays on the server).
 */
window.TMDB = (() => {
  const C = window.CINEMATCH_CONFIG || {};
  const PROXY = C.TMDB_PROXY_URL || (C.SUPABASE_URL && !C.DEMO_MODE ? C.SUPABASE_URL + '/functions/v1/tmdb' : '');
  const IMG = 'https://image.tmdb.org/t/p/';
  const enabled = C.USE_TMDB !== false && !!(PROXY || C.TMDB_READ_TOKEN || C.TMDB_API_KEY);

  // TMDB genre ids → CineMatch genre names (movie + TV ids)
  const GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 14: 'Fantasy', 36: 'History', 27: 'Horror',
    10402: 'Musical', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
    10752: 'History', 37: 'Action',
    10759: 'Action', 10765: 'Sci-Fi', 10768: 'History'
  };

  async function get(path, params = {}) {
    const headers = { accept: 'application/json' };
    let url;
    if (PROXY) {
      url = new URL(PROXY); url.searchParams.set('path', path);
      if (C.SUPABASE_KEY) headers.apikey = C.SUPABASE_KEY;
    } else {
      url = new URL('https://api.themoviedb.org/3' + path);
      if (C.TMDB_READ_TOKEN) headers.Authorization = 'Bearer ' + C.TMDB_READ_TOKEN;
      else url.searchParams.set('api_key', C.TMDB_API_KEY);
    }
    const all = { language: C.TMDB_LANGUAGE || 'en-US', region: C.TMDB_REGION || '', ...params };
    Object.entries(all).forEach(([k, v]) => v !== '' && url.searchParams.set(k, v));
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { headers, signal: ctl.signal }); clearTimeout(t);
    if (!res.ok) { let m = ''; try { const j = await res.json(); m = j.status_message || j.error || ''; } catch (e) {} throw new Error('TMDB ' + res.status + (m ? ': ' + m : '')); }
    return res.json();
  }

  const posterUrl = (path, size = 'w500') => (path ? IMG + size + path : '');
  const hue = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;

  function map(item, type) {
    const g = [...new Set((item.genre_ids || []).map(id => GENRES[id]).filter(Boolean))];
    const date = item.release_date || item.first_air_date || '';
    const h = hue(item.id);
    return {
      id: (type === 'tv' ? 'tv' : 'mv') + item.id,
      tmdbId: item.id,
      t: item.title || item.name,
      y: date.slice(0, 4),
      k: type === 'tv' ? 'Series' : 'Movie',
      g: g.length ? g : ['Drama'],
      len: '',
      r: Math.round((item.vote_average || 0) * 10) / 10,
      d: item.overview || '',
      poster: posterUrl(item.poster_path),
      c: [`hsl(${h} 45% 45%)`, `hsl(${h} 40% 10%)`],
      s: item.id % 4
    };
  }

  async function loadCatalog() {
    const [mv, tv, mv2] = await Promise.all([
      get('/trending/movie/week'),
      get('/trending/tv/week'),
      get('/movie/top_rated')
    ]);
    const list = [
      ...mv.results.map(i => map(i, 'movie')),
      ...tv.results.map(i => map(i, 'tv')),
      ...mv2.results.map(i => map(i, 'movie'))
    ];
    const seen = new Set();
    return list.filter(m => !seen.has(m.id) && seen.add(m.id));
  }

  // Titles referenced by friends / plans that are not in the loaded lists
  async function byIds(ids) {
    const out = [];
    await Promise.all(ids.slice(0, 40).map(async id => {
      const m = /^(mv|tv)(\d+)$/.exec(id); if (!m) return;
      try {
        const type = m[1] === 'tv' ? 'tv' : 'movie', d = await get(`/${type}/${m[2]}`);
        d.genre_ids = (d.genres || []).map(g => g.id);
        const item = map(d, type);
        if (type === 'movie' && d.runtime) item.len = `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`;
        if (type === 'tv' && d.number_of_seasons) item.len = `${d.number_of_seasons} season${d.number_of_seasons > 1 ? 's' : ''}`;
        out.push(item);
      } catch (e) {}
    }));
    return out;
  }

  // Runtime / seasons for the detail view (optional)
  async function details(m) {
    const type = m.k === 'Series' ? 'tv' : 'movie';
    const d = await get(`/${type}/${m.tmdbId}`);
    if (type === 'movie' && d.runtime) m.len = `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`;
    if (type === 'tv' && d.number_of_seasons) m.len = `${d.number_of_seasons} season${d.number_of_seasons > 1 ? 's' : ''}`;
    return m;
  }

  return { enabled, get, loadCatalog, byIds, details, posterUrl };
})();
