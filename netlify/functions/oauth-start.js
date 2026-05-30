// netlify/functions/oauth-start.js
// Kicks off the SmartThings OAuth handshake. Open this in a browser:
//
//   https://<your-site>.netlify.app/api/oauth-start
//
// It builds the SmartThings authorize URL with your client_id + redirect_uri
// and 302s you to it. After you approve, SmartThings redirects to
// /api/oauth-callback, which finishes the handshake and stores the refresh
// token.
const { randomBytes } = require('crypto');
const { setState, requireOAuthEnv } = require('./_smartthings');

const ST_AUTHORIZE = 'https://api.smartthings.com/oauth/authorize';
const SCOPES = 'r:devices:* x:devices:*';

exports.handler = async function() {
  let env;
  try {
    env = requireOAuthEnv();
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }

  const state = randomBytes(16).toString('hex');
  await setState(state);

  const url = new URL(ST_AUTHORIZE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);

  return {
    statusCode: 302,
    headers: { Location: url.toString() },
    body: ''
  };
};
