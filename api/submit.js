// Public forms: "Share your film" and "Know this school?". Everything waits for approval.
const { db, readBody, send, ytId } = require('./_db');
const clip = (s, n) => String(s ?? '').slice(0, n).trim();
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  try {
    const b = await readBody(req);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent = await db(`submissions?select=id&ip=eq.${encodeURIComponent(ip)}&created_at=gt.${since}`);
    if (recent.length >= 10) return send(res, 429, { error: 'Too many submissions in the last hour. Try again later.' });
    let payload;
    if (b.kind === 'game') {
      const links = String(b.links || '').split(/[\s,]+/).map(ytId).filter(Boolean);
      if (!links.length) return send(res, 400, { error: 'Add at least one YouTube link.' });
      if (!b.state1 || !b.school1 || !b.state2 || !b.school2) return send(res, 400, { error: 'Pick both teams.' });
      payload = { state1: clip(b.state1, 3), school1: clip(b.school1, 80), state2: clip(b.state2, 3), school2: clip(b.school2, 80),
        year: clip(b.year, 4), sport: clip(b.sport, 10), score1: clip(b.score1, 3), score2: clip(b.score2, 3),
        links: links.slice(0, 12), name: clip(b.name, 80), email: clip(b.email, 120), notes: clip(b.notes, 1000) };
    } else if (b.kind === 'identify') {
      if (!b.game_id || !clip(b.guess, 300)) return send(res, 400, { error: 'Tell us who you think it is.' });
      payload = { game_id: +b.game_id, team: clip(b.team, 10), guess: clip(b.guess, 300),
        name: clip(b.name, 80), email: clip(b.email, 120) };
    } else return send(res, 400, { error: 'Unknown form' });
    await db('submissions', { method: 'POST', body: { kind: b.kind, payload, ip }, prefer: 'return=minimal' });
    send(res, 200, { ok: true });
  } catch (e) { send(res, 500, { error: 'Could not save. Try again in a minute.' }); }
};
