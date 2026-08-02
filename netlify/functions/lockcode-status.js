// netlify/functions/lockcode-status.js
//
// READ-ONLY companion to lockcode-sync.
//
// lockcode-sync is a SCHEDULED function (see netlify.toml). Netlify does not
// let scheduled functions be invoked over HTTP in production — hitting its URL
// in a browser returns a blank body. This function is NOT scheduled, so it can
// be opened in a browser any time to see what code each cabin *should* have.
//
// It performs the exact same OwnerRez lookup and deriveCode() logic as
// lockcode-sync, but never touches SmartThings and never writes to a lock.
//
// Usage:
//   https://cabin-welcome-screen.netlify.app/.netlify/functions/lockcode-status
//   https://cabin-welcome-screen.netlify.app/api/lockcode-status
//   ...?cabin=huckleberry     (single cabin)

const {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  fetchBookings,
  fetchGuest,
  fetchPropertyBackupCode,
  currentBooking,
  deriveCode
} = require('./_ownerrez');

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

async function checkOneCabin(cabinKey, cabinConfig, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  const deviceCount = cabinConfig.deviceIds.length;

  if (!propertyId) {
    return { cabin: cabinKey, status: 'no-property-id', deviceCount };
  }

  const [bookings, propertyBackupCode] = await Promise.all([
    fetchBookings(propertyId, daysAgoDenver(60), today),
    fetchPropertyBackupCode(propertyId)
  ]);

  const booking = currentBooking(bookings, today);

  if (!booking) {
    return {
      cabin: cabinKey,
      propertyId,
      status: 'no-guest',
      bookingsFetched: Array.isArray(bookings) ? bookings.length : 0,
      backupCode: propertyBackupCode || null,
      deviceCount
    };
  }

  if (booking.guest_id) {
    const fullGuest = await fetchGuest(booking.guest_id);
    if (fullGuest) booking.guest = { ...(booking.guest || {}), ...fullGuest };
  }

  const code = deriveCode(booking, propertyBackupCode);
  const firstName =
    (booking.guest && booking.guest.first_name) ||
    (booking.guest_name && booking.guest_name.split(' ')[0]) ||
    'Guest';

  return {
    cabin: cabinKey,
    propertyId,
    status: code ? 'would-set' : 'no-code-derivable',
    code: code || null,
    guest: firstName,
    arrival: booking.arrival || null,
    departure: booking.departure || null,
    backupCode: propertyBackupCode || null,
    deviceCount
  };
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  };

  const devicesRaw = process.env.SMARTTHINGS_DEVICES;
  let devices = {};
  let devicesNote = null;

  if (!devicesRaw) {
    devicesNote = 'SMARTTHINGS_DEVICES not set — falling back to all cabins in PROPERTY_IDS';
    for (const key of Object.keys(PROPERTY_IDS)) devices[key] = [];
  } else {
    try {
      devices = JSON.parse(devicesRaw);
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'SMARTTHINGS_DEVICES is not valid JSON: ' + err.message })
      };
    }
  }

  const only = event && event.queryStringParameters && event.queryStringParameters.cabin;
  const today = todayDenver();
  const results = [];

  for (const [cabin, value] of Object.entries(devices)) {
    if (only && cabin !== only) continue;
    try {
      results.push(await checkOneCabin(cabin, parseCabinConfig(value), today));
    } catch (err) {
      results.push({ cabin, status: 'error', error: err.message });
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      note: 'READ ONLY — this reports what lockcode-sync would push. It does not change any lock.',
      checkedAt: new Date().toISOString(),
      today,
      devicesNote,
      results
    }, null, 2)
  };
};
