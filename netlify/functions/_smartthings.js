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
const LEGACY_REFRESH_KEY = 'refresh_token';
const STATE_KEY = 'oauth_state';

function store() {
  return getStore(STORE_NAME);
}

// SmartThings SmartApp installs are scoped to a single Location, so each
// install for a different cabin produces its own refresh token. We key tokens
// by the SmartThings locationId. If a caller passes no locationId we fall back
// to the pre-multi-location key, so old single-install setups keep working.
function refreshKey(locationId) {
  return locationId ? `${LEGACY_REFRESH_KEY}:${locationId}` : LEGACY_REFRESH_KEY;
}

async function getRefreshToken(locationId) {
  const tok = await store().get(refreshKey(locationId));
  if (tok) return tok;
  if (locationId) {
    const legacy = await store().get(LEGACY_REFRESH_KEY);
    if (legacy) return legacy;
  }
  throw new Error(
    `No refresh token stored for location ${locationId || '(default)'}. ` +
    `Install the Cabin Lock Code Sync SmartApp in that location from the SmartThings mobile app.`
  );
}

async function setRefreshToken(locationId, token) {
  await store().set(refreshKey(locationId), token);
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
// Legacy/unused with the Automation SmartApp install flow (the refresh token
// comes via the lifecycle webhook instead) but kept so /api/oauth-callback
// still works if someone goes back to a classic OAuth grant.
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
  await setRefreshToken(null, data.refresh_token);
  return data.access_token;
}

// Uses the stored refresh token for `locationId` to mint a new access token.
// Persists the rotated refresh token SmartThings returns. Pass no locationId
// (or omit) to use the legacy single-location key.
async function newAccessToken(locationId) {
  const { clientId, clientSecret } = requireOAuthEnv();
  const refreshToken = await getRefreshToken(locationId);
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
  if (!res.ok) throw new Error(`Refresh failed for location ${locationId || '(default)'}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.refresh_token) await setRefreshToken(locationId, data.refresh_token);
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
  setRefreshToken,
  setCode,
  deleteCode,
  setState,
  consumeState,
  requireOAuthEnv
};
