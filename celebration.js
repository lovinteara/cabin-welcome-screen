const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Create the Blobs store. Prefer Netlify's automatic config; if that isn't
  // available in this deploy, fall back to explicit siteID + token from env vars.
  let store;
  try {
    store = getStore('celebrations');
  } catch (e) {
    store = getStore({
      name: 'celebrations',
      siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN,
    });
  }

  // GET — fetch celebration for a cabin
  if (event.httpMethod === 'GET') {
    const cabin = event.queryStringParameters?.cabin;
    if (!cabin) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cabin required' }) };
    try {
      const data = await store.get(cabin, { type: 'json' });
      return { statusCode: 200, headers, body: JSON.stringify(data || { active: false }) };
    } catch(e) {
      return { statusCode: 200, headers, body: JSON.stringify({ active: false }) };
    }
  }

  // POST — set celebration (from JotForm webhook)
  if (event.httpMethod === 'POST') {
    try {
      let raw = {};
      const ct = event.headers['content-type'] || '';

      if (ct.includes('application/json')) {
        raw = JSON.parse(event.body);
      } else {
        // JotForm sends URL-encoded form data
        const params = new URLSearchParams(event.body);
        params.forEach((v, k) => { raw[k] = v; });
        // JotForm also packs everything into a "rawRequest" JSON string — merge it in
        if (raw.rawRequest) {
          try {
            const rr = JSON.parse(raw.rawRequest);
            Object.assign(raw, rr);
          } catch (e) {}
        }
      }

      // Match fields by keyword so it works regardless of JotForm's exact field names
      // (e.g. q1_cabin, q1_whichCabin, cabin, etc. all match "cabin")
      const findField = (keywords) => {
        for (const key of Object.keys(raw)) {
          const k = key.toLowerCase();
          if (keywords.some(kw => k.includes(kw))) {
            let val = raw[key];
            // JotForm sometimes sends an object {text:..} or array for choice fields
            if (val && typeof val === 'object') val = val.text || val.value || Object.values(val).join(' ');
            if (val != null && String(val).trim() !== '') return String(val).trim();
          }
        }
        return undefined;
      };

      const cabin    = findField(['cabin']);
      const occasion = findField(['occasion']);
      const guestName= findField(['guestname', 'guest', 'name']);
      const message  = findField(['message', 'msg']);
      const action   = (findField(['action']) || 'set').toLowerCase().includes('clear') ? 'clear' : 'set';

      if (!cabin) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cabin required', received: Object.keys(raw) }) };

      // Normalize the cabin value: take the part after a pipe if present (e.g. "Caldera Cottage|caldera"),
      // lowercase, and map any friendly name to its key.
      let cabinKey = cabin.includes('|') ? cabin.split('|').pop() : cabin;
      cabinKey = cabinKey.trim().toLowerCase();
      const nameToKey = {
        'huckleberry hut':'huckleberry', 'gathering place':'gathering',
        'little chalet':'little-chalet', 'big chalet':'big-chalet',
        'caldera cottage':'caldera', "d'shouse haven":'dshouse', 'dshouse haven':'dshouse',
        'rrl sleeps 14':'rrl', 'charming log home':'charming',
      };
      if (nameToKey[cabinKey]) cabinKey = nameToKey[cabinKey];

      if (action === 'clear') {
        await store.delete(cabinKey);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, cleared: cabinKey }) };
      }

      const celebration = {
        active: true,
        cabin: cabinKey,
        occasion,
        guestName,
        message,
        setAt: new Date().toISOString()
      };

      await store.set(cabinKey, JSON.stringify(celebration));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, celebration }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // DELETE — clear celebration
  if (event.httpMethod === 'DELETE') {
    const cabin = event.queryStringParameters?.cabin;
    if (!cabin) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cabin required' }) };
    await store.delete(cabin);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
