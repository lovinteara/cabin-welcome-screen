// Shared Netlify Blobs helpers for imported charging data. Filename starts
// with `_` so Netlify doesn't deploy it as its own function.
//
// Classic (Lambda-compatible) functions don't auto-wire @netlify/blobs, so we
// call connectLambda(event) first and fall back to explicit siteID + token —
// same pattern as celebration.js.

const { getStore, connectLambda } = require('@netlify/blobs');

function chargingStore(event) {
  try {
    if (typeof connectLambda === 'function' && event) connectLambda(event);
    return getStore('charging-data');
  } catch (e) {
    return getStore({
      name: 'charging-data',
      siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN
    });
  }
}

// Returns the stored sessions array for one charger ([] if none / on error).
async function getImportedSessions(event, key) {
  try {
    const store = chargingStore(event);
    const data = await store.get(`sessions/${key}`, { type: 'json' });
    return data && Array.isArray(data.sessions) ? data.sessions : [];
  } catch (e) {
    return [];
  }
}

async function saveImportedSessions(event, key, sessions, updatedAt) {
  const store = chargingStore(event);
  await store.set(`sessions/${key}`, JSON.stringify({ sessions, updatedAt }));
}

module.exports = { getImportedSessions, saveImportedSessions };
