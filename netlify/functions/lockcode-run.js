// netlify/functions/lockcode-run.js
//
// MANUAL "Sync Now" endpoint — for last-minute bookings that arrive between
// the two scheduled runs (11 AM and 3 PM Mountain).
//
// lockcode-sync is a SCHEDULED function, and Netlify will not let scheduled
// functions be invoked over HTTP — its URL returns a blank page in production.
// This function is NOT scheduled, so it can be opened in a browser. It does not
// duplicate any sync logic: it hands straight off to lockcode-sync's own
// handler, so both paths always behave identically.
//
// !! DO NOT add a `schedule` entry for this function in netlify.toml. !!
// !! Adding one is exactly what would make this URL go blank too.     !!
//
// THIS WRITES TO YOUR PHYSICAL LOCKS, so it requires a secret key.
//
// Setup (one time):
//   Netlify → Project configuration → Environment variables → Add a variable
//     Key:   LOCKCODE_RUN_KEY
//     Value: (a long random string you invent — treat it like a password)
//   Redeploy for it to take effect.
//
// Usage:
//   https://cabin-welcome-screen.netlify.app/api/lockcode-run?key=YOUR_KEY
//
// If LOCKCODE_RUN_KEY is not set, this endpoint refuses to run at all. It fails
// closed on purpose — an unprotected URL would let anyone who guessed it
// rewrite the door codes on every cabin.

const crypto = require('crypto');

function keyMatches(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so check length first.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const expected = process.env.LOCKCODE_RUN_KEY;
  if (!expected) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'LOCKCODE_RUN_KEY is not set in this site\'s environment variables.',
        howToFix: 'Netlify → Project configuration → Environment variables → add LOCKCODE_RUN_KEY with a long random value, then redeploy.'
      }, null, 2)
    };
  }

  const supplied = (event.queryStringParameters && event.queryStringParameters.key) || '';
  if (!keyMatches(supplied, expected)) {
    console.warn('lockcode-run: rejected request with bad or missing key');
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Missing or incorrect key.' }, null, 2)
    };
  }

  // Hand off to the scheduled function's own handler so there is exactly one
  // copy of the sync logic. Anything lockcode-sync does on its schedule,
  // this does too.
  let sync;
  try {
    sync = require('./lockcode-sync');
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not load lockcode-sync: ' + err.message }, null, 2)
    };
  }

  try {
    const result = await sync.handler(event);
    let payload;
    try {
      payload = JSON.parse(result.body);
    } catch (e) {
      payload = { raw: result.body };
    }
    console.log('lockcode-run: manual sync completed');
    return {
      statusCode: result.statusCode || 200,
      headers,
      body: JSON.stringify({
        note: 'MANUAL RUN — codes were just pushed to the locks.',
        triggeredAt: new Date().toISOString(),
        ...payload
      }, null, 2)
    };
  } catch (err) {
    console.error('lockcode-run failed:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }, null, 2)
    };
  }
};
