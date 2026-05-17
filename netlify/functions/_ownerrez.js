// Shared OwnerRez helpers. Filename starts with `_` so Netlify doesn't
// deploy it as its own function — it's just imported by the others.

const PROPERTY_IDS = {
  huckleberry:     293956,
  gathering:       246664,
  'little-chalet': 246665,
  'big-chalet':    246666,
  caldera:         293957,
  dshouse:         358174,
  rrl:             367657,
  charming:        471812
};

function todayDenver() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}

function daysAgoDenver(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}

function daysFromNowDenver(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}

async function fetchBookings(propertyId, fromDate, toDate) {
  const apiKey  = process.env.OWNERREZ_API_KEY;
  const apiUser = process.env.OWNERREZ_API_USER;
  if (!apiKey || !apiUser) return null;

  const url = `https://api.ownerreservations.com/v2/bookings?property_ids=${propertyId}&from_date=${fromDate}&to_date=${toDate}&status=active&include_guest=true`;
  const creds = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    console.error('OwnerRez error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return (data.items || []).filter(b => !b.is_block && b.type !== 'block' && b.status === 'active');
}

function currentBooking(bookings, today) {
  if (!bookings) return null;
  return bookings.find(b => b.arrival <= today && b.departure > today) || null;
}

// Derive a 4-digit door code for a booking. Priority:
//   1. Booking field/custom_field called "door_code" (manual override)
//   2. Last 4 digits of guest phone
//   3. Arrival date MMDD
function deriveCode(booking) {
  if (!booking) return null;

  // OwnerRez sometimes surfaces fields as `fields` array. Check a few shapes.
  const override =
    booking.door_code ||
    (booking.fields && booking.fields.door_code) ||
    (Array.isArray(booking.custom_fields) &&
      (booking.custom_fields.find(f => /door[_ ]?code/i.test(f.name || '')) || {}).value);
  if (override && /^\d{4,8}$/.test(String(override).replace(/\D/g, ''))) {
    return String(override).replace(/\D/g, '').slice(-4).padStart(4, '0');
  }

  const phone =
    (booking.guest && (booking.guest.phone || booking.guest.cell_phone || booking.guest.home_phone)) ||
    booking.guest_phone;
  if (phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(-4);
  }

  if (booking.arrival && /^\d{4}-\d{2}-\d{2}$/.test(booking.arrival)) {
    const [, mm, dd] = booking.arrival.split('-');
    return mm + dd;
  }

  return null;
}

module.exports = {
  PROPERTY_IDS,
  todayDenver,
  daysAgoDenver,
  daysFromNowDenver,
  fetchBookings,
  currentBooking,
  deriveCode
};
