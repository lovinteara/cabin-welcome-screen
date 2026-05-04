// netlify/functions/guest.js
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
  if (!propertyId) return { statusCode: 400, headers, body: JSON.stringify({ guest: null }) };

  const apiKey  = process.env.OWNERREZ_API_KEY;
  const apiUser = process.env.OWNERREZ_API_USER;
  if (!apiKey || !apiUser) return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 60);
    const fromDate = lookback.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });

    const url = `https://api.ownerreservations.com/v2/bookings?property_ids=${propertyId}&from_date=${fromDate}&to_date=${today}&status=active&include_guest=true`;
    const creds = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' }
    });

    if (!res.ok) return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };

    const data = await res.json();
    const bookings = (data.items || []).filter(b => !b.is_block);
    const current = bookings.find(b =>
      b.arrival <= today && b.departure > today && b.status === 'active' && b.guest_name
    );

    if (!current) return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };

    const firstName = current.guest_name.split(' ')[0];
    if (!firstName) return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };

    const dept = new Date(current.departure + 'T12:00:00');
    const departure = dept.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        guest: { firstName, departure, adults: current.adults||0, children: current.children||0, pets: current.pets||0 }
      })
    };

  } catch(err) {
    return { statusCode: 200, headers, body: JSON.stringify({ guest: null }) };
  }
};
