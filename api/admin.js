// Everything behind the admin password: approvals, slotting, removals, import.
const { db, rpc, readBody, send, keyOf } = require('./_db');
const { runSlotter } = require('./_slot');
const enc = encodeURIComponent;
const getSet = async k => ((await db('settings?select=value&key=eq.' + enc(k)))[0] || {}).value;
const putSet = (k, v) => db('settings', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { key: k, value: String(v) } });
async function ensureSchool(state, key, name) {
  key = keyOf(key); if (!state || !key) throw new Error('Pick a state and school');
  await db('schools', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal',
    body: { state, key, name: name || key.replace(/\w\S*/g, w => w[0] + w.slice(1).toLowerCase()), in_directory: false } });
  return key;
}

module.exports = async (req, res) => {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers['x-admin-password'] !== pw) return send(res, 401, { error: 'Wrong password' });
  try {
    const b = await readBody(req); const a = b.action;
    if (a === 'overview') {
      const [subs, slots] = await Promise.all([
        db('submissions?select=*&status=eq.pending&order=id&limit=100'),
        db('needs_slotting?select=*&ignored=eq.false&order=created_at.desc&limit=100')]);
      const count = async t => { const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + t + '?select=*&limit=1',
        { method: 'HEAD', headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY, Prefer: 'count=exact' } });
        return +((r.headers.get('content-range') || '/0').split('/')[1]) || 0; };
      return send(res, 200, { subs, slots, counts: { games: await count('games'), videos: await count('videos'), schools: await count('schools') },
        channels: await getSet('channels') || 'UCypIhh9s6E3Fw9B77N9SZfw', lastRun: await getSet('last_slotter_run') || 'never',
        importSchools: +(await getSet('import_schools_next') || 0), importGames: +(await getSet('import_games_next') || 0) });
    }
    if (a === 'approve_game') {
      const s = (await db('submissions?select=*&id=eq.' + +b.id))[0]; if (!s) throw new Error('Not found');
      const p = { ...s.payload, ...(b.edit || {}) };
      const k1 = await ensureSchool(p.state1, p.school1), k2 = await ensureSchool(p.state2, p.school2);
      let gid;
      for (const [i, yt] of p.links.entries())
        gid = await rpc('add_video', { p_s1: p.state1, p_k1: k1, p_s2: p.state2, p_k2: k2, p_year: p.year || '', p_sport: p.sport || '',
          p_sc1: p.score1 || '', p_sc2: p.score2 || '', p_yt: yt, p_version: 'sub' + s.id, p_part: p.links.length > 1 ? i + 1 : 0,
          p_source: 'submission', p_title: '' });
      await db('submissions?id=eq.' + s.id, { method: 'PATCH', body: { status: 'approved' }, prefer: 'return=minimal' });
      return send(res, 200, { ok: true, game_id: gid });
    }
    if (a === 'reject') {
      await db('submissions?id=eq.' + +b.id, { method: 'PATCH', body: { status: 'rejected' }, prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }
    if (a === 'apply_identify') {
      const key = await ensureSchool(b.state, b.school, b.name);
      const side = +b.team === 2 ? { state2: b.state, key2: key } : { state1: b.state, key1: key };
      await db('games?id=eq.' + +b.game_id, { method: 'PATCH', body: side, prefer: 'return=minimal' });
      if (b.id) await db('submissions?id=eq.' + +b.id, { method: 'PATCH', body: { status: 'approved' }, prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }
    if (a === 'slot') {
      const k1 = await ensureSchool(b.state1, b.school1), k2 = await ensureSchool(b.state2, b.school2);
      const gid = await rpc('add_video', { p_s1: b.state1, p_k1: k1, p_s2: b.state2, p_k2: k2, p_year: b.year || '', p_sport: b.sport || '',
        p_sc1: b.score1 || '', p_sc2: b.score2 || '', p_yt: b.yt, p_version: b.tape || '-', p_part: +b.part || 0, p_source: 'admin', p_title: b.title || '' });
      return send(res, 200, { ok: true, game_id: gid });
    }
    if (a === 'ignore') {
      await db('needs_slotting?yt=eq.' + enc(b.yt), { method: 'PATCH', body: { ignored: true }, prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }
    if (a === 'remove_game') {
      await db('games?id=eq.' + +b.game_id, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, 200, { ok: true });
    }
    if (a === 'set_channels') { await putSet('channels', String(b.value || '').trim()); return send(res, 200, { ok: true }); }
    if (a === 'run_slotter') return send(res, 200, await runSlotter());
    if (a === 'import_schools' || a === 'import_games') {
      const setKey = a === 'import_schools' ? 'import_schools_next' : 'import_games_next';
      const next = +(await getSet(setKey) || 0);
      if (+b.offset !== next) return send(res, 409, { error: 'Already imported up to ' + next, next });
      await rpc(a, { p: b.chunk });
      await putSet(setKey, next + (+b.size));
      return send(res, 200, { ok: true, next: next + (+b.size) });
    }
    send(res, 400, { error: 'Unknown action' });
  } catch (e) { send(res, 500, { error: e.message }); }
};
