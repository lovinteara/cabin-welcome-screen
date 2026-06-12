// netlify/functions/lockcode-checkout.js
//
// Scheduled function — runs daily at 11 AM Mountain (the checkout window).
// For each cabin, looks at today's bookings and, if any booking is departing
// today, clears slot 10 on every one of that cabin's locks. The departing
// guest's keypad access is removed immediately at checkout time.
//
// Mid-stay codes are left alone (the guest still needs to get in tonight).
// Codes for guests arriving today are NOT activated here — that's the
// 3 PM lockcode-sync run's job, so the new guest's code becomes active
// exactly at the standard 3 PM check-in time.
//
// Same-day turnover (Bing checks out 6/12, Anna checks in 6/12):
//   11 AM run clears Bing's code -> slot 10 empty -> cleaner uses backup
//   3 PM lockcode-sync sets Anna's code -> slot 10 has Anna -> she can enter

const { connectLambda } = require('@netlify/blobs');
const {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  fetchBookings
} = require('./_ownerrez');
const { newAccessToken, deleteCode } = require('./_smartthings');

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

async function clearCheckoutCabin(cabinKey, cabinConfig, today) {
  const propertyId = PROPERTY_IDS[cabinKey];
  if (!propertyId) return { cabin: cabinKey, status: 'no-property-id' };

  const { locationId, deviceIds } = cabinConfig;
  if (deviceIds.length === 0) return { cabin: cabinKey, status: 'no-devices' };

  const bookings = await fetchBookings(propertyId, daysAgoDenver(60), today);
  if (!bookings) return { cabin: cabinKey, status: 'or-error' };

  // Is there a booking departing today? If not, leave this cabin alone —
  // mid-stay guests still need their code to work tonight.
  const departingToday = bookings.find(b => b.departure === today);
  if (!departingToday) return { cabin: cabinKey, status: 'no-checkout-today' };

  let accessToken;
  try {
    accessToken = await newAccessToken(locationId);
  } catch (err) {
    return { cabin: cabinKey, status: 'auth-failed', error: err.message };
  }

  const devices = [];
  for (const deviceId of deviceIds) {
    try {
      await deleteCode(accessToken, deviceId, CODE_SLOT);
      devices.push({ deviceId, status: 'ok' });
    } catch (err) {
      console.error(`device ${deviceId} deleteCode failed:`, err.message);
      devices.push({ deviceId, status: 'error', error: err.message });
    }
  }
  return {
    cabin: cabinKey,
    status: 'cleared',
    departingBookingId: departingToday.id,
    devices
  };
}

exports.handler = async function(event) {
  connectLambda(event || {});

  const devicesRaw = process.env.SMARTTHINGS_DEVICES;
  if (!devicesRaw) {
    return { statusCode: 200, body: 'SMARTTHINGS_DEVICES not set; nothing to clear' };
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
      results.push(await clearCheckoutCabin(cabin, cabinConfig, today));
    } catch (err) {
      console.error(`checkout error for ${cabin}:`, err.message);
      results.push({ cabin, status: 'error', error: err.message });
    }
  }

  console.log('lockcode-checkout results:', JSON.stringify(results));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranAt: new Date().toISOString(), results })
  };
};
