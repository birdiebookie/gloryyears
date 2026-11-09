// Everything the public site needs, straight from the database (cached for 5 minutes).
const { rpc, send } = require('./_db');
module.exports = async (req, res) => {
  try {
    const data = await rpc('site_data');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (e) { send(res, 500, { error: e.message }); }
};
