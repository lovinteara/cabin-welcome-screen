// netlify/functions/lifecycle.js
//
// SmartThings SmartApp lifecycle webhook. SmartThings POSTs to:
//   https://cabin-welcome-screen.netlify.app/api/lifecycle
// (mapped to this function by the /api/* rewrite in netlify.toml).
//
// Lifecycle events we handle:
//   PING          → echo back the challenge value so SmartThings can verify
//                   the webhook is reachable. Required before the SmartApp
//                   will accept any other events.
//   CONFIGURATION → tell SmartThings what scopes we need and present an empty
//                   "Done" page (no per-user config to collect).
//   INSTALL       → user just installed the SmartApp from the SmartThings
//                   mobile app; capture the refresh token they granted us
//                   and stash it in Netlify Blobs so lockcode-sync can use it.
//   UPDATE        → user reconfigured the SmartApp; refresh token may rotate.
//   EVENT         → device events. We don't subscribe to any; no-op.
//   UNINSTALL     → user removed the SmartApp. No-op (we leave the stale
//                   refresh token; next sync will fail and log, which is the
//                   intended alarm).
//
// Security: SmartThings signs lifecycle payloads with HTTP Message Signatures.
// We don't verify signatures in v1 — the URL isn't published and the worst
// case is a forged refresh token overwriting the real one, which produces a
// loud failure at the next sync rather than silent data exfiltration. If we
// publish this SmartApp later, signature verification goes here.

const { getStore } = require('@netlify/blobs');

const STORE_NAME  = 'lockcode';
const REFRESH_KEY = 'refresh_token';

exports.handler = async function(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON: ' + err.message };
  }

  const lifecycle = body.lifecycle;
  console.log('lifecycle event:', lifecycle);

  switch (lifecycle) {
    case 'PING':
      return jsonResponse({
        pingData: { challenge: body.pingData && body.pingData.challenge }
      });

    case 'CONFIGURATION':
      return handleConfiguration(body);

    case 'INSTALL':
    case 'UPDATE':
      return handleInstallOrUpdate(lifecycle, body);

    case 'UNINSTALL':
      return jsonResponse({ uninstallData: {} });

    case 'EVENT':
      return jsonResponse({ eventData: {} });

    default:
      console.warn('Unhandled lifecycle:', lifecycle);
      return jsonResponse({});
  }
};

function handleConfiguration(body) {
  const phase = body.configurationData && body.configurationData.phase;

  if (phase === 'INITIALIZE') {
    return jsonResponse({
      configurationData: {
        initialize: {
          id: 'cabin-locks-init',
          name: 'Cabin Lock Code Sync',
          description: 'Pushes guest door codes from OwnerRez to your cabin locks daily.',
          firstPageId: '1',
          permissions: ['r:devices:*', 'x:devices:*'],
          disableCustomDisplayName: false,
          disableRemoveApp: false
        }
      }
    });
  }

  // PAGE phase — no per-user config to collect, just an empty completion page.
  return jsonResponse({
    configurationData: {
      page: {
        pageId: '1',
        name: 'Cabin Lock Code Sync',
        nextPageId: null,
        previousPageId: null,
        complete: true,
        sections: []
      }
    }
  });
}

async function handleInstallOrUpdate(lifecycle, body) {
  const data = body.installData || body.updateData || {};
  const refreshToken = data.refreshToken;
  if (refreshToken) {
    try {
      await getStore(STORE_NAME).set(REFRESH_KEY, refreshToken);
      console.log(`Stored refresh token from ${lifecycle}`);
    } catch (err) {
      console.error('Failed to persist refresh token:', err.message);
    }
  } else {
    console.warn(`${lifecycle} arrived without a refreshToken`);
  }
  const replyKey = lifecycle === 'INSTALL' ? 'installData' : 'updateData';
  return jsonResponse({ [replyKey]: {} });
}

function jsonResponse(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
