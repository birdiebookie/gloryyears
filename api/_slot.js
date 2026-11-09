// Checks your YouTube channels for new uploads and files them into the archive.
const { db, rpc, parseTitle } = require('./_db');
const YT = 'https://www.googleapis.com/youtube/v3/';
const DEFAULT_CHANNELS = 'UCypIhh9s6E3Fw9B77N9SZfw';

async function yt(path) {
  const r = await fetch(YT + path + '&key=' + encodeURIComponent(process.env.YOUTUBE_API_KEY || ''));
  const j = await r.json();
  if (!r.ok) throw new Error('YouTube: ' + (j.error && j.error.message || r.status));
  return j;
}

async function runSlotter(pages = 4) {
  const set = await db('settings?key=eq.channels&select=value');
  const channels = ((set[0] && set[0].value) || DEFAULT_CHANNELS).split(/[\s,]+/).filter(Boolean);
  const report = { checked: 0, added: 0, queued: 0, channels: channels.length };
  for (const ch of channels) {
    const c = await yt('channels?part=contentDetails&id=' + encodeURIComponent(ch));
    const pl = c.items && c.items[0] && c.items[0].contentDetails.relatedPlaylists.uploads;
    if (!pl) continue;
    let token = '';
    for (let p = 0; p < pages; p++) {
      const j = await yt('playlistItems?part=snippet&maxResults=50&playlistId=' + pl + (token ? '&pageToken=' + token : ''));
      const items = (j.items || []).map(i => ({ yt: i.snippet.resourceId.videoId, title: i.snippet.title }))
        .filter(i => i.yt && i.title !== 'Private video' && i.title !== 'Deleted video');
      if (!items.length) break;
      const ids = items.map(i => i.yt).join(',');
      const known = new Set([
        ...(await db('videos?select=yt&yt=in.(' + ids + ')')).map(r => r.yt),
        ...(await db('needs_slotting?select=yt&yt=in.(' + ids + ')')).map(r => r.yt)]);
      const fresh = items.filter(i => !known.has(i.yt));
      report.checked += items.length;
      for (const v of fresh) {
        const g = parseTitle(v.title);
        let ok = false;
        if (g) {
          const s = await db('schools?select=key&state=eq.' + g.state + '&key=in.(' +
            [g.school1, g.school2].map(k => '"' + k.replace(/"/g, '') + '"').join(',') + ')');
          const have = new Set(s.map(r => r.key));
          if (have.has(g.school1) && have.has(g.school2)) {
            await rpc('add_video', { p_s1: g.state, p_k1: g.school1, p_s2: g.state, p_k2: g.school2, p_year: g.year,
              p_sport: g.sport, p_sc1: g.score1, p_sc2: g.score2, p_yt: v.yt, p_version: g.tape, p_part: g.part,
              p_source: 'slotter', p_title: v.title });
            report.added++; ok = true;
          }
        }
        if (!ok) {
          await db('needs_slotting', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal',
            body: { yt: v.yt, title: v.title, guess: g } });
          report.queued++;
        }
      }
      if (!fresh.length || !j.nextPageToken) break; // stop once we reach videos we already have
      token = j.nextPageToken;
    }
  }
  await db('settings', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
    body: { key: 'last_slotter_run', value: new Date().toISOString() + ' ' + JSON.stringify(report) } });
  return report;
}
module.exports = { runSlotter };
