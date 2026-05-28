exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const apiKey = process.env.NPS_API_KEY;
    if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'No NPS API key' }) };

    const res = await fetch(
      `https://developer.nps.gov/api/v1/alerts?parkCode=yell,grte&limit=10&api_key=${apiKey}`
    );
    const data = await res.json();

    const alerts = (data.data || []).map(a => ({
      title: a.title,
      description: a.description ? a.description.replace(/<[^>]+>/g, '').substring(0, 200) : '',
      category: a.category,
      park: a.parkCode === 'yell' ? 'Yellowstone' : 'Grand Teton',
      url: a.url || ''
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ alerts }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
