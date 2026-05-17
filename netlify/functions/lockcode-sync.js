// netlify/functions/lockcode-sync.js
//
// Scheduled function — runs daily and pushes the current guest's 4-digit
// code to each cabin's Schlage lock via the SmartThings cloud API. Schedule
// is defined in netlify.toml: `[functions."lockcode-sync"] schedule = "..."`.
//
// What it does for each configured cabin:
//   1. Looks up today's booking in OwnerRez.
//   2. Derives the code (see _ownerrez.deriveCode).
//   3. If a guest is in the cabin → setCode in slot 1 on the lock.
//      If no guest → deleteCode in slot 1.
//
// Auth uses an OAuth SmartApp + refresh token stored in Netlify Blobs.
// One-time setup: visit /api/oauth-start in a browser and approve.
//
// Required env vars:
//   - OWNERREZ_API_USER, OWNERREZ_API_KEY
//   - SMARTTHINGS_CLIENT_ID, SMARTTHINGS_CLIENT_SECRET, SMARTTHINGS_REDIRECT_URI
//   - SMARTTHINGS_DEVICES   JSON map of cabinKey -> deviceId, e.g.
//                           {"huckleberry":"abc-123","gathering":"def-456"}
const {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  fetchBookings,
  currentBooking,
  deriveCode
} = require('./_ownerrez');
const { newAccessToken, setCode, deleteCode } = require('./_smartthings');

const CODE_SLOT = 1;

async function syncOneCabin(accessToken, cabinKey, deviceId, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  if (!propertyId) return { cabin: cabinKey, status: 'no-property-id' };

  const bookings = await fetchBookings(propertyId, daysAgoDenver(60), today);
  const booking = currentBooking(bookings, today);

  if (!booking) {
    await deleteCode(accessToken, deviceId, CODE_SLOT);
    return { cabin: cabinKey, status: 'no-guest, slot cleared' };
  }

  const code = deriveCode(booking);
  if (!code) return { cabin: cabinKey, status: 'no-code-derivable' };

  const firstName =
    (booking.guest && booking.guest.first_name) ||
    (booking.guest_name && booking.guest_name.split(' ')[0]) ||
    'Guest';

  await setCode(accessToken, deviceId, CODE_SLOT, code, firstName);
  return { cabin: cabinKey, status: 'set', code, guest: firstName };
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
  for (const [cabin, deviceId] of Object.entries(devices)) {
    if (!deviceId) continue;
    try {
      results.push(await syncOneCabin(accessToken, cabin, deviceId, today));
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
