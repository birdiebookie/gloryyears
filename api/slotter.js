// Runs every night at 3 AM Eastern (set in vercel.json). Only Vercel's scheduler can trigger it.
const { send } = require('./_db');
const { runSlotter } = require('./_slot');
module.exports = async (req, res) => {
  if ((req.headers.authorization || '') !== 'Bearer ' + process.env.CRON_SECRET || !process.env.CRON_SECRET)
    return send(res, 401, { error: 'Not allowed' });
  try { send(res, 200, await runSlotter()); } catch (e) { send(res, 500, { error: e.message }); }
};
