// Shared helpers for talking to Supabase (server-side only).
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function db(path, opts = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: {
      apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation', ...(opts.headers || {})
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error('Database error ' + r.status + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
const rpc = (fn, args) => db('rpc/' + fn, { method: 'POST', body: args || {} });

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((ok, bad) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 5e6) bad(new Error('Too big')); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } });
  });
}
function send(res, code, obj) {
  res.statusCode = code; res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj));
}
// Pull an 11-character YouTube id out of a link or a bare id.
function ytId(s) {
  s = String(s || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
// Make a school key the same way the archive does: capitals, letters/numbers/spaces only.
const keyOf = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Read a slotting title: TAPE ST School Score Opponent Score YEAR SPORT PART
const SPORTS = ['FB', 'BB', 'GBB', 'SOC', 'GSOC', 'BASE', 'SB', 'VB'];
function parseTitle(title) {
  const t = String(title || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\S+) ([A-Za-z]{2}) (.+?) (\d{1,3}) (.+?) (\d{1,3}) ((?:19|20)\d\d) (\S+)(?: (\d{1,2}))?/);
  if (m) return { tape: m[1], state: m[2].toUpperCase(), school1: keyOf(m[3]), score1: m[4],
    school2: keyOf(m[5]), score2: m[6], year: m[7], sport: m[8].toUpperCase(), part: m[9] ? +m[9] : 0 };
  m = t.match(/^(\S+) ([A-Za-z]{2}) (.+?) (?:vs?\.? )(.+?) ((?:19|20)\d\d) (\S+)(?: (\d{1,2}))?/i);
  if (m) return { tape: m[1], state: m[2].toUpperCase(), school1: keyOf(m[3]), score1: '',
    school2: keyOf(m[4]), score2: '', year: m[5], sport: m[6].toUpperCase(), part: m[7] ? +m[7] : 0 };
  return null;
}

module.exports = { db, rpc, readBody, send, ytId, keyOf, parseTitle, SPORTS };
