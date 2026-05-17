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
// Required env vars (set in the Netlify site dashboard):
//   - OWNERREZ_API_USER, OWNERREZ_API_KEY
//   - SMARTTHINGS_TOKEN          Personal Access Token (account.smartthings.com)
//   - SMARTTHINGS_DEVICES        JSON map of cabinKey -> deviceId, e.g.
//                                {"huckleberry":"abc-123","gathering":"def-456"}
//
// Only cabins present in SMARTTHINGS_DEVICES are synced. Missing cabins are
// silently skipped so you can roll this out one lock at a time.
const {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  fetchBookings,
  currentBooking,
  deriveCode
} = require('./_ownerrez');

const ST_BASE = 'https://api.smartthings.com/v1';
const CODE_SLOT = 1;

async function smartthingsCommand(deviceId, command, args) {
  const token = process.env.SMARTTHINGS_TOKEN;
  if (!token) throw new Error('SMARTTHINGS_TOKEN not set');

  const res = await fetch(`${ST_BASE}/devices/${deviceId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      commands: [{
        component: 'main',
        capability: 'lockCodes',
        command,
        arguments: args
      }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SmartThings ${command} failed: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}

function setCode(deviceId, slot, code, name) {
  return smartthingsCommand(deviceId, 'setCode', [slot, code, name || 'Guest']);
}

function deleteCode(deviceId, slot) {
  return smartthingsCommand(deviceId, 'deleteCode', [slot]);
}

async function syncOneCabin(cabinKey, deviceId, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  if (!propertyId) return { cabin: cabinKey, status: 'no-property-id' };

  const bookings = await fetchBookings(propertyId, daysAgoDenver(60), today);
  const booking = currentBooking(bookings, today);

  if (!booking) {
    await deleteCode(deviceId, CODE_SLOT);
    return { cabin: cabinKey, status: 'no-guest, slot cleared' };
  }

  const code = deriveCode(booking);
  if (!code) return { cabin: cabinKey, status: 'no-code-derivable' };

  const firstName =
    (booking.guest && booking.guest.first_name) ||
    (booking.guest_name && booking.guest_name.split(' ')[0]) ||
    'Guest';

  await setCode(deviceId, CODE_SLOT, code, firstName);
  return { cabin: cabinKey, status: 'set', code, guest: firstName };
}

exports.handler = async function() {
  const devicesRaw = process.env.SMARTTHINGS_DEVICES;
  if (!devicesRaw) {
    console.log('SMARTTHINGS_DEVICES not set; nothing to sync');
    return { statusCode: 200, body: 'SMARTTHINGS_DEVICES not set' };
  }

  let devices;
  try {
    devices = JSON.parse(devicesRaw);
  } catch (err) {
    console.error('SMARTTHINGS_DEVICES is not valid JSON:', err.message);
    return { statusCode: 500, body: 'SMARTTHINGS_DEVICES is not valid JSON' };
  }

  const today = todayDenver();
  const results = [];
  for (const [cabin, deviceId] of Object.entries(devices)) {
    if (!deviceId) continue;
    try {
      results.push(await syncOneCabin(cabin, deviceId, today));
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
