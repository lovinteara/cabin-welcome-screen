// Shared SmartThings OAuth + lock-code helper. Filename starts with `_` so
// Netlify doesn't deploy it as its own function.
//
// SmartThings PATs only last 24h, so this uses an OAuth SmartApp instead:
// a one-time browser handshake produces a refresh token (~30-day lifetime,
// rotated on each use). We persist the latest refresh token in Netlify
// Blobs and mint a fresh access token before every API call.
const { getStore } = require('@netlify/blobs');

const ST_API = 'https://api.smartthings.com/v1';
const ST_TOKEN_URL = 'https://api.smartthings.com/oauth/token';
const STORE_NAME = 'lockcode';
const REFRESH_KEY = 'refresh_token';
const STATE_KEY = 'oauth_state';

function store() {
  return getStore(STORE_NAME);
}

async function getRefreshToken() {
  const tok = await store().get(REFRESH_KEY);
  if (!tok) {
    throw new Error('No refresh token stored — visit /api/oauth-start to authorize.');
  }
  return tok;
}

async function setRefreshToken(token) {
  await store().set(REFRESH_KEY, token);
}

async function setState(state) {
  await store().set(STATE_KEY, state);
}

async function consumeState() {
  const s = await store().get(STATE_KEY);
  if (s) await store().delete(STATE_KEY);
  return s;
}

function requireOAuthEnv() {
  const clientId = process.env.SMARTTHINGS_CLIENT_ID;
  const clientSecret = process.env.SMARTTHINGS_CLIENT_SECRET;
  const redirectUri = process.env.SMARTTHINGS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('SMARTTHINGS_CLIENT_ID, SMARTTHINGS_CLIENT_SECRET, and SMARTTHINGS_REDIRECT_URI must be set');
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuth(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// Exchanges the OAuth authorization code for an access + refresh token pair.
// Stores the refresh token on success and returns the access token.
async function exchangeAuthCode(code) {
  const { clientId, clientSecret, redirectUri } = requireOAuthEnv();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri
  });
  const res = await fetch(ST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`Auth code exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.refresh_token) throw new Error('No refresh_token in token response');
  await setRefreshToken(data.refresh_token);
  return data.access_token;
}

// Uses the stored refresh token to mint a new access token. Persists the
// (rotated) refresh token returned by SmartThings.
async function newAccessToken() {
  const { clientId, clientSecret } = requireOAuthEnv();
  const refreshToken = await getRefreshToken();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  });
  const res = await fetch(ST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.refresh_token) await setRefreshToken(data.refresh_token);
  return data.access_token;
}

async function sendCommand(accessToken, deviceId, command, args) {
  const res = await fetch(`${ST_API}/devices/${deviceId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      commands: [{ component: 'main', capability: 'lockCodes', command, arguments: args }]
    })
  });
  if (!res.ok) throw new Error(`SmartThings ${command} failed: ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}

const setCode    = (token, deviceId, slot, code, name) => sendCommand(token, deviceId, 'setCode', [slot, code, name || 'Guest']);
const deleteCode = (token, deviceId, slot)             => sendCommand(token, deviceId, 'deleteCode', [slot]);

module.exports = {
  exchangeAuthCode,
  newAccessToken,
  setCode,
  deleteCode,
  setState,
  consumeState,
  requireOAuthEnv
};
