// netlify/functions/lockcode.js
// Returns the 4-digit door code for the cabin's current guest, so the
// welcome screen can display it on a "Door Code" slide.
//
// GET /api/lockcode?cabin=huckleberry
// → { code: "4729", firstName: "Sarah", departure: "May 23" } or { code: null }
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

function formatDeparture(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day   = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[month]} ${day}`;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    // Refresh every 5 min; codes don't change mid-stay
    'Cache-Control': 'public, max-age=300'
  };

  const qs = event.queryStringParameters || {};

  // Kill switch — return null until we've confirmed the lock-sync writes the
  // same code to the physical Schlage. Set LOCKCODE_SHOW=true in Netlify env
  // vars after running lockcode-sync and verifying setCode landed on each
  // cabin's lock. Default off keeps the TV slide blank so guests never see a
  // code that doesn't match the keypad. The TV front-end never sends ?show=,
  // so adding it to a URL in a browser bypasses the switch for testing
  // without affecting any guest's TV.
  const bypassSwitch = qs.show === 'true';
  if (process.env.LOCKCODE_SHOW !== 'true' && !bypassSwitch) {
    return { statusCode: 200, headers, body: JSON.stringify({ code: null }) };
  }

  const cabin = qs.cabin;
  const propertyId = PROPERTY_IDS[cabin];
  if (!propertyId) {
    return { statusCode: 400, headers, body: JSON.stringify({ code: null }) };
  }

  try {
    const today = todayDenver();
    const [bookings, propertyBackupCode] = await Promise.all([
      fetchBookings(propertyId, daysAgoDenver(60), today),
      fetchPropertyBackupCode(propertyId)
    ]);
    const booking = currentBooking(bookings, today);

    // /v2/bookings?include_guest=true returns a name-only guest. Fetch the
    // full guest record so deriveCode can read cell_phone / home_phone for
    // priority 1.
    if (booking && booking.guest_id) {
      const fullGuest = await fetchGuest(booking.guest_id);
      if (fullGuest) booking.guest = { ...(booking.guest || {}), ...fullGuest };
    }

    if (bypassSwitch) {
      console.log('lockcode debug:', JSON.stringify({
        cabin,
        propertyId,
        today,
        bookingCount: bookings ? bookings.length : null,
        currentBookingId: booking && booking.id,
        guestKeys: booking && booking.guest ? Object.keys(booking.guest) : null,
        guestPhoneFields: booking && booking.guest
          ? Object.keys(booking.guest).filter(k => /phone|cell|mobile/i.test(k))
          : null,
        guestPhoneSet: !!(booking && booking.guest && (booking.guest.cell_phone || booking.guest.home_phone || booking.guest.phone))
      }));
    }

    if (!booking) {
      return { statusCode: 200, headers, body: JSON.stringify({ code: null }) };
    }

    const code = deriveCode(booking, propertyBackupCode);
    if (!code) {
      return { statusCode: 200, headers, body: JSON.stringify({ code: null }) };
    }

    let firstName = '';
    if (booking.guest && booking.guest.first_name) firstName = booking.guest.first_name;
    else if (booking.guest_name) firstName = booking.guest_name.split(' ')[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        code,
        firstName,
        departure: formatDeparture(booking.departure)
      })
    };
  } catch (err) {
    console.error('lockcode error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ code: null }) };
  }
};
