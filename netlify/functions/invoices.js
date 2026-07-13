// netlify/functions/invoices.js
//
// Password-protected, cloud-synced storage for the Caldera Mechanical invoice
// tool. Invoices and the checklist live in Netlify Blobs, so once you log in
// they're the same on every device (phone, laptop, etc.).
//
// Auth: one shared password. The FIRST login sets it (claim-on-first-use).
// After that the same password is required everywhere. If INVOICE_PASSWORD is
// set in the Netlify environment, that value wins (and is a way to reset it).
// The client sends the password in the `x-caldera-key` header on every call.
//
//   POST   /api/invoices?action=auth        { password }   log in / first-time set-up
//   GET    /api/invoices                                    list all invoices
//   GET    /api/invoices?id=ID                              one invoice
//   PUT    /api/invoices                     { invoice }    save / update one invoice
//   DELETE /api/invoices?id=ID                              delete one invoice
//   GET    /api/invoices?resource=checklist                 checklist items
//   PUT    /api/invoices?resource=checklist  { items }      save checklist

const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

function store(event) {
  try {
    if (typeof connectLambda === 'function' && event) connectLambda(event);
    return getStore('caldera-invoices');
  } catch (e) {
    return getStore({
      name: 'caldera-invoices',
      siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN
    });
  }
}

function hashPass(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32).toString('hex');
}

// Validate the caller's password header. When allowClaim is true and no
// password has been set yet, the supplied password becomes the account password.
async function checkAuth(st, pw, allowClaim) {
  pw = (pw || '').toString();
  if (!pw) return { ok: false, status: 401 };

  const envPass = process.env.INVOICE_PASSWORD;
  if (envPass) return pw === envPass ? { ok: true } : { ok: false, status: 401 };

  let auth = null;
  try { auth = await st.get('_auth', { type: 'json' }); } catch (e) { auth = null; }

  if (!auth) {
    if (allowClaim && pw.length >= 4) {
      const salt = crypto.randomBytes(16).toString('hex');
      await st.set('_auth', JSON.stringify({ salt, hash: hashPass(pw, salt) }));
      return { ok: true, created: true };
    }
    return { ok: false, status: 401, needSetup: true };
  }
  return hashPass(pw, auth.salt) === auth.hash ? { ok: true } : { ok: false, status: 401 };
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-caldera-key',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const st = store(event);
  const q = event.queryStringParameters || {};
  const key = (event.headers['x-caldera-key'] || event.headers['X-Caldera-Key'] || '');

  const parseBody = () => {
    try {
      let s = event.body || '{}';
      if (event.isBase64Encoded) s = Buffer.from(s, 'base64').toString('utf8');
      return JSON.parse(s);
    } catch (e) { return null; }
  };

  // ---- Auth (also first-time set-up) ----
  if (event.httpMethod === 'POST' && q.action === 'auth') {
    const body = parseBody() || {};
    const res = await checkAuth(st, body.password, true);
    if (!res.ok) return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: 'Wrong password.' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, created: !!res.created }) };
  }

  // ---- Public invoice view (no password — needs the invoice's share token) ----
  // Used by invoice-view.html so a customer can open the link you email them.
  if (event.httpMethod === 'GET' && q.view) {
    let rec = null;
    try { rec = await st.get('inv/' + q.view, { type: 'json' }); } catch (e) {}
    if (!rec || !rec.token || !q.token || rec.token !== q.token) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ invoice: { id: rec.id, data: rec.data } }) };
  }

  // ---- Everything below needs a valid password ----
  const auth = await checkAuth(st, key, false);
  if (!auth.ok) {
    return { statusCode: auth.status || 401, headers, body: JSON.stringify({ ok: false, error: 'Not authorized', needSetup: !!auth.needSetup }) };
  }

  // ---- Checklist ----
  if (q.resource === 'checklist') {
    if (event.httpMethod === 'GET') {
      let items = [];
      try { const d = await st.get('checklist', { type: 'json' }); if (d && Array.isArray(d.items)) items = d.items; } catch (e) {}
      return { statusCode: 200, headers, body: JSON.stringify({ items }) };
    }
    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      const body = parseBody();
      if (!body || !Array.isArray(body.items)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'items[] required' }) };
      await st.set('checklist', JSON.stringify({ items: body.items, updatedAt: new Date().toISOString() }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  // ---- Invoices ----
  if (event.httpMethod === 'GET') {
    if (q.id) {
      let rec = null;
      try { rec = await st.get('inv/' + q.id, { type: 'json' }); } catch (e) {}
      if (!rec) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify({ invoice: rec }) };
    }
    const invoices = [];
    try {
      const listing = await st.list({ prefix: 'inv/' });
      const blobs = (listing && listing.blobs) || [];
      for (const b of blobs) {
        try { const rec = await st.get(b.key, { type: 'json' }); if (rec) invoices.push(rec); } catch (e) {}
      }
    } catch (e) {}
    invoices.sort((a, b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
    return { statusCode: 200, headers, body: JSON.stringify({ invoices }) };
  }

  if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
    const body = parseBody();
    const inv = body && body.invoice;
    if (!inv || !inv.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'invoice.id required' }) };
    const rec = {
      id: String(inv.id),
      data: inv.data || {},
      savedAt: inv.savedAt || new Date().toISOString(),
      token: (inv.token && String(inv.token)) || crypto.randomBytes(12).toString('hex')
    };
    await st.set('inv/' + rec.id, JSON.stringify(rec));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, invoice: rec }) };
  }

  if (event.httpMethod === 'DELETE') {
    if (!q.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
    try { await st.delete('inv/' + q.id); } catch (e) {}
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };
};
