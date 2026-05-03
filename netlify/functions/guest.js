// netlify/functions/guest.js
// Looks up the current guest at a cabin and returns their first name + stay info.
// Called by the welcome screen: /api/guest?cabin=huckleberry
// Credentials stored in Netlify environment variables — never exposed to browser.

const PROPERTY_IDS = {
  huckleberry:     293956,
  gathering:       246664,
  'little-chalet': 246665,
  'big-chalet':    246666,
  caldera:         293957,
  dshouse:         358174,
  rrl:             367657,
  charming:        471812
};

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const cabin = event.queryStringParameters && event.queryStringParameters.cabin;
  const propertyId = PROPERTY_IDS[cabin];

  if (!propertyId) {
    return { statusCode: 400, headers, body: JSON.stringify({ guest: null, error: 'Unknown cabin' }) };
  }

  const apiKey  = process.env.OWNERREZ_API_KEY;
  const apiUser = process.env.OWNERREZ_API_USER;

  if (!apiKey || !apiUser) {
    console.error('Missing OWNERREZ_API_KEY or OWNERREZ_API_USER env vars');
    return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
  }

  try {
    // Today in Mountain Time (Island Park is MT)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });

    // Look back 30 days to catch long stays that started before today
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 30);
    const fromDate = lookback.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });

    const url = `https://api.ownerreservations.com/v2/bookings?property_ids=${propertyId}&from_date=${fromDate}&to_date=${today}&status=active&include_guest=true`;

    const creds = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OwnerRez API error:', response.status, errText);
      return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
    }

    const data = await response.json();
    const bookings = data.items || [];

    // Find booking where guest is currently in the cabin (arrival <= today < departure)
    const current = bookings.find(b => b.arrival <= today && b.departure > today && b.status === 'active');

    if (!current) {
      return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
    }

    const firstName = (current.guest_name || '').split(' ')[0] || '';
    if (!firstName) {
      return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
    }

    const deptDate = new Date(current.departure + 'T12:00:00');
    const departure = deptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        guest: {
          firstName,
          departure,
          adults:   current.adults   || 0,
          children: current.children || 0,
          pets:     current.pets     || 0
        }
      })
    };

  } catch (err) {
    console.error('Unexpected error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
  }
};
