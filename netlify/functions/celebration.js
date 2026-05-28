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

  const store = getStore('celebrations');

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
      let body = {};
      const ct = event.headers['content-type'] || '';

      if (ct.includes('application/json')) {
        body = JSON.parse(event.body);
      } else {
        // JotForm sends URL-encoded form data
        const params = new URLSearchParams(event.body);
        // JotForm field names: q1_cabin, q2_occasion, q3_guestName, q4_message, q5_action
        body = {
          cabin: params.get('q1_cabin') || params.get('cabin'),
          occasion: params.get('q2_occasion') || params.get('occasion'),
          guestName: params.get('q3_guestName') || params.get('guestName'),
          message: params.get('q4_message') || params.get('message'),
          action: params.get('q5_action') || params.get('action') || 'set',
        };
      }

      const { cabin, occasion, guestName, message, action } = body;
      if (!cabin) return { statusCode: 400, headers, body: JSON.stringify({ error: 'cabin required' }) };

      if (action === 'clear') {
        await store.delete(cabin);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, cleared: cabin }) };
      }

      const celebration = {
        active: true,
        cabin,
        occasion,
        guestName,
        message,
        setAt: new Date().toISOString()
      };

      await store.set(cabin, JSON.stringify(celebration));
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
