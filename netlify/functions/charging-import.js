// netlify/functions/charging-import.js
//
// Imports EV charging sessions pasted from a ChargePoint monthly statement.
// ChargePoint has no working automated login from a server, so the owner
// copies the statement (Activity → Monthly Statement) and pastes it here; we
// parse out each session's date + kWh and store it in Netlify Blobs. The
// dashboard (charging.js) then reads these and does guest matching + billing.
//
// GET  /api/charging-import           -> per-charger summary (label, count, updatedAt)
// POST /api/charging-import  { charger, year, text, replace? }
//        -> parses the pasted statement, merges (or replaces) stored sessions

const { getImportedSessions, saveImportedSessions } = require('./_store');
const cp = require('./_chargepoint');

// Pull { date, kWh } pairs out of pasted statement text. ChargePoint rows look
// like: "7/11  3333 Lupine Dr  Island Park  CP HOME  AC  3h 14m 19s  17.832 kWh"
// Copy/paste can arrive as one row per line OR one cell per line, so we first
// try pairing all dates with all kWh values in order, then fall back to
// per-line pairing.
function parseStatement(text, year) {
  const dateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  const kwhRe  = /([\d,]+\.?\d*)\s*kWh/gi;

  const toDate = m => {
    let y = m[3] ? parseInt(m[3], 10) : year;
    if (y < 100) y += 2000;
    const mm = String(parseInt(m[1], 10)).padStart(2, '0');
    const dd = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };
  const mkKwh = s => parseFloat(String(s).replace(/,/g, ''));

  const dates = [...text.matchAll(dateRe)];
  const kwhs  = [...text.matchAll(kwhRe)];
  const sessions = [];

  if (dates.length && dates.length === kwhs.length) {
    for (let i = 0; i < dates.length; i++) {
      const kwh = mkKwh(kwhs[i][1]);
      if (!isNaN(kwh)) sessions.push({ start: `${toDate(dates[i])}T12:00:00.000Z`, kwh });
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const dm = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      const km = line.match(/([\d,]+\.?\d*)\s*kWh/i);
      if (dm && km) {
        const kwh = mkKwh(km[1]);
        if (!isNaN(kwh)) sessions.push({ start: `${toDate(dm)}T12:00:00.000Z`, kwh });
      }
    }
  }
  return sessions;
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const validKeys = new Set(cp.ACCOUNTS.map(a => a.key));

  // GET — what's stored per charger
  if (event.httpMethod === 'GET') {
    const chargers = [];
    for (const a of cp.ACCOUNTS) {
      const s = await getImportedSessions(event, a.key);
      const latest = s.reduce((mx, x) => (x.start > mx ? x.start : mx), '');
      chargers.push({ key: a.key, label: a.label, count: s.length, latest: latest ? latest.slice(0, 10) : null });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ chargers }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body = {};
  try {
    let s = event.body || '{}';
    if (event.isBase64Encoded) s = Buffer.from(s, 'base64').toString('utf8');
    body = JSON.parse(s);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Could not read the submission.' }) };
  }

  const charger = body.charger;
  const text = body.text || '';
  const year = parseInt(body.year, 10) || new Date().getFullYear();
  const replace = !!body.replace;

  if (!validKeys.has(charger)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pick a charger.' }) };
  }
  if (!text.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Paste the statement text first.' }) };
  }

  const parsed = parseStatement(text, year);
  if (!parsed.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, parsed: 0, added: 0, message: "Couldn't find any charging sessions in that text. Make sure it includes the dates and the kWh amounts." }) };
  }

  const existing = replace ? [] : await getImportedSessions(event, charger);
  const seen = new Set(existing.map(s => s.start.slice(0, 10) + '|' + s.kwh));
  const merged = existing.slice();
  let added = 0;
  for (const s of parsed) {
    const k = s.start.slice(0, 10) + '|' + s.kwh;
    if (!seen.has(k)) { seen.add(k); merged.push(s); added++; }
  }
  merged.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  await saveImportedSessions(event, charger, merged, new Date().toISOString());

  const totalKwh = Math.round(merged.reduce((t, s) => t + (s.kwh || 0), 0) * 100) / 100;
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, parsed: parsed.length, added, total: merged.length, totalKwh })
  };
};
