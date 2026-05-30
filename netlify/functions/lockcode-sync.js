// netlify/functions/lockcode-sync.js
//
// Scheduled function — runs daily and pushes the current guest's door code
// to every Schlage lock at each cabin via the SmartThings cloud API. Schedule
// is defined in netlify.toml: `[functions."lockcode-sync"] schedule = "..."`.
//
// For each configured cabin:
//   1. Looks up today's booking in OwnerRez + the cabin's PXDOORBACKUP value.
//   2. Derives the code (see _ownerrez.deriveCode):
//        booking.door_code → BXDOORCODE → PXDOORBACKUP.
//   3. For each of that cabin's locks:
//        guest in cabin → setCode in slot 10.
//        no guest       → deleteCode in slot 10.
//
// Auth uses an OAuth SmartApp + refresh token stored in Netlify Blobs.
// One-time setup: visit /api/oauth-start in a browser and approve.
//
// Required env vars:
//   - OWNERREZ_API_USER, OWNERREZ_API_KEY
//   - SMARTTHINGS_CLIENT_ID, SMARTTHINGS_CLIENT_SECRET, SMARTTHINGS_REDIRECT_URI
//   - SMARTTHINGS_DEVICES   JSON map of cabinKey -> deviceId OR array of deviceIds:
//                           {
//                             "huckleberry": ["uuid-1", "uuid-2"],
//                             "little-chalet": "single-uuid"
//                           }
const {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  fetchBookings,
  fetchPropertyBackupCode,
  currentBooking,
  deriveCode
} = require('./_ownerrez');
const { newAccessToken, setCode, deleteCode } = require('./_smartthings');

const CODE_SLOT = 10;

async function syncOneCabin(accessToken, cabinKey, deviceIds, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  if (!propertyId) return { cabin: cabinKey, status: 'no-property-id' };

  const [bookings, propertyBackupCode] = await Promise.all([
    fetchBookings(propertyId, daysAgoDenver(60), today),
    fetchPropertyBackupCode(propertyId)
  ]);
  const booking = currentBooking(bookings, today);

  if (!booking) {
    const devices = await pushToAllLocks(deviceIds, id => deleteCode(accessToken, id, CODE_SLOT));
    return { cabin: cabinKey, status: 'no-guest', devices };
  }

  const code = deriveCode(booking, propertyBackupCode);
  if (!code) return { cabin: cabinKey, status: 'no-code-derivable' };

  const firstName =
    (booking.guest && booking.guest.first_name) ||
    (booking.guest_name && booking.guest_name.split(' ')[0]) ||
    'Guest';

  const devices = await pushToAllLocks(deviceIds, id => setCode(accessToken, id, CODE_SLOT, code, firstName));
  return { cabin: cabinKey, status: 'set', code, guest: firstName, devices };
}

async function pushToAllLocks(deviceIds, action) {
  const results = [];
  for (const deviceId of deviceIds) {
    try {
      await action(deviceId);
      results.push({ deviceId, status: 'ok' });
    } catch (err) {
      console.error(`device ${deviceId} failed:`, err.message);
      results.push({ deviceId, status: 'error', error: err.message });
    }
  }
  return results;
}

exports.handler = async function() {
  const devicesRaw = process.env.SMARTTHINGS_DEVICES;
  if (!devicesRaw) {
    return { statusCode: 200, body: 'SMARTTHINGS_DEVICES not set; nothing to sync' };
  }
  let devices;
  try {
    devices = JSON.parse(devicesRaw);
  } catch (err) {
    return { statusCode: 500, body: 'SMARTTHINGS_DEVICES is not valid JSON: ' + err.message };
  }

  let accessToken;
  try {
    accessToken = await newAccessToken();
  } catch (err) {
    console.error('Could not mint access token:', err.message);
    return { statusCode: 500, body: 'Auth failed: ' + err.message };
  }

  const today = todayDenver();
  const results = [];
  for (const [cabin, value] of Object.entries(devices)) {
    const deviceIds = (Array.isArray(value) ? value : [value]).filter(Boolean);
    if (deviceIds.length === 0) continue;
    try {
      results.push(await syncOneCabin(accessToken, cabin, deviceIds, today));
    } catch (err) {
      console.error(`sync error for ${cabin}:`, err.message);
      results.push({ cabin, status: 'error', error: err.message });
    }
  }

  console.log('lockcode-sync results:', JSON.stringify(results));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranAt: new Date().toISOString(), results })
  };
};
