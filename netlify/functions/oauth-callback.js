// netlify/functions/oauth-callback.js
// Receives the SmartThings redirect with ?code=...&state=..., validates the
// state against what oauth-start stored, exchanges the code for a refresh
// token, and stores the refresh token in Netlify Blobs.
const { exchangeAuthCode, consumeState } = require('./_smartthings');

function htmlPage(title, body) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:8vh auto;padding:0 2rem;color:#2c2c2c;line-height:1.55}
h1{color:#5fa8b8;font-weight:600}code{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:0.9em}
.err{color:#b03030}</style>${body}`;
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  if (params.error) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
      body: htmlPage('SmartThings error',
        `<h1 class="err">SmartThings refused</h1><p>${params.error}: ${params.error_description || ''}</p>`) };
  }
  if (!params.code) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
      body: htmlPage('Missing code',
        `<h1 class="err">Missing code</h1><p>Start over at <code>/api/oauth-start</code>.</p>`) };
  }

  const expected = await consumeState();
  if (!expected || params.state !== expected) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
      body: htmlPage('State mismatch',
        `<h1 class="err">State mismatch</h1><p>Re-open <code>/api/oauth-start</code> and try again.</p>`) };
  }

  try {
    await exchangeAuthCode(params.code);
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' },
      body: htmlPage('Token exchange failed',
        `<h1 class="err">Token exchange failed</h1><pre>${err.message}</pre>`) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: htmlPage('Connected', `
      <h1>SmartThings connected</h1>
      <p>Refresh token stored in Netlify Blobs. The daily lock-code sync will run automatically at 11&nbsp;AM Mountain.</p>
      <p>To trigger the sync right now, hit <code>/.netlify/functions/lockcode-sync</code> from the Netlify dashboard.</p>`)
  };
};
