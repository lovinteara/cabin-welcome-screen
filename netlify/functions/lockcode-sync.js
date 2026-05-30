// netlify/functions/lockcode-sync.js
//
// Scheduled function — runs daily and pushes the current guest's door code
// to every Schlage lock at each cabin via the SmartThings cloud API. Schedule
// is defined in netlify.toml: `[functions."lockcode-sync"] schedule = "..."`.
//
// For each configured cabin:
//   1. Looks up today's booking in OwnerRez + the cabin's PXDOORBACKUP value.
//   2. Derives the code (see _ownerrez.deriveCode):
//        guest phone last 4 → booking.door_code → BXDOORCODE → PXDOORBACKUP.
//   3. For each of that cabin's locks:
//        guest in cabin → setCode in slot 10.
//        no guest       → deleteCode in slot 10.
//
// Auth: SmartThings Automation SmartApp + refresh token. The token is captured
// at install time by /api/lifecycle and stored in Netlify Blobs. To install,
// register this site as a SmartApp's webhook and add it via the SmartThings
// mobile app (Developer Mode → Automations → Add → custom apps).
//
// Required env vars:
//   - OWNERREZ_API_USER, OWNERREZ_API_KEY
//   - SMARTTHINGS_CLIENT_ID, SMARTTHINGS_CLIENT_SECRET, SMARTTHINGS_REDIRECT_URI
//   - SMARTTHINGS_DEVICES   JSON map. Each SmartThings Location holds its own
//                           OAuth refresh token (one per SmartApp install), so
//                           each cabin entry needs the locationId it was
//                           installed in plus the lock UUIDs in that location:
//                           {
//                             "huckleberry": {
//                               "locationId": "abc-...",
//                               "deviceIds": ["uuid-1", "uuid-2"]
//                             },
//                             "little-chalet": {
//                               "locationId": "def-...",
//                               "deviceIds": ["uuid"]
//                             }
//                           }
//                           Legacy single-location formats (bare array or
//                           single UUID string) are still accepted and fall
//                           back to the un-keyed refresh token.
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

function parseCabinConfig(value) {
  if (Array.isArray(value)) return { locationId: null, deviceIds: value.filter(Boolean) };
  if (typeof value === 'string') return { locationId: null, deviceIds: [value] };
  if (value && typeof value === 'object') {
    const deviceIds = Array.isArray(value.deviceIds)
      ? value.deviceIds.filter(Boolean)
      : [value.deviceIds].filter(Boolean);
    return { locationId: value.locationId || null, deviceIds };
  }
  return { locationId: null, deviceIds: [] };
}

async function syncOneCabin(cabinKey, cabinConfig, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  if (!propertyId) return { cabin: cabinKey, status: 'no-property-id' };

  const { locationId, deviceIds } = cabinConfig;
  if (deviceIds.length === 0) return { cabin: cabinKey, status: 'no-devices' };

  let accessToken;
  try {
    accessToken = await newAccessToken(locationId);
  } catch (err) {
    return { cabin: cabinKey, status: 'auth-failed', error: err.message };
  }

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

  const today = todayDenver();
  const results = [];
  for (const [cabin, value] of Object.entries(devices)) {
    const cabinConfig = parseCabinConfig(value);
    if (cabinConfig.deviceIds.length === 0) continue;
    try {
      results.push(await syncOneCabin(cabin, cabinConfig, today));
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
