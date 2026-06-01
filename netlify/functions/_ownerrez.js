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

// OwnerRez custom field definition IDs (find in admin → Settings → Custom Fields → URL).
const BOOKING_FIELD_DOOR_CODE    = 294930270;   // merge code: BXDOORCODE — per-booking manual override
const PROPERTY_FIELD_DOOR_BACKUP = 294932859;   // merge code: PXDOORBACKUP — per-cabin fallback

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

function orHeaders() {
  const apiKey  = process.env.OWNERREZ_API_KEY;
  const apiUser = process.env.OWNERREZ_API_USER;
  if (!apiKey || !apiUser) return null;
  const creds = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  return { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' };
}

async function fetchBookings(propertyId, fromDate, toDate) {
  const headers = orHeaders();
  if (!headers) return null;

  const url = `https://api.ownerreservations.com/v2/bookings?property_ids=${propertyId}&from_date=${fromDate}&to_date=${toDate}&status=active&include_guest=true`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error('OwnerRez bookings error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return (data.items || []).filter(b => !b.is_block && b.type !== 'block' && b.status === 'active');
}

// /v2/bookings?include_guest=true returns a slimmed-down guest object with
// only name + id — no contact methods. The full guest record (including
// cell_phone / home_phone) lives at /v2/guests/{id}. deriveCode needs phone
// to derive the door code as last 4 of phone, so we fetch the full guest
// after we've found the current booking.
async function fetchGuest(guestId) {
  if (!guestId) return null;
  const headers = orHeaders();
  if (!headers) return null;
  const res = await fetch(`https://api.ownerreservations.com/v2/guests/${guestId}`, { headers });
  if (!res.ok) {
    console.error('OwnerRez guest error:', res.status, await res.text());
    return null;
  }
  return res.json();
}

// Looks up the property's PXDOORBACKUP value (per-cabin fallback code).
// TODO: the OwnerRez v2 endpoint for property custom field values is not
// yet known — /v2/propertyfieldvalues 404s and the earlier
// /v2/properties/{id}?include_fields=true was silently ignored. Disabled
// until we have a working endpoint so we stop logging 404s on every call.
// deriveCode falls back through booking.door_code → BXDOORCODE in the
// meantime; PXDOORBACKUP just won't contribute until this is wired up.
async function fetchPropertyBackupCode(_propertyId) {
  return null;
}

// Generic custom-field reader. OwnerRez surfaces field values on bookings and
// properties under a handful of shapes depending on endpoint and API version,
// so we check a few. Returns the raw string value (or null).
function getFieldValue(obj, fieldDefinitionId) {
  if (!obj) return null;
  const candidates = [
    obj.field_values,
    obj.fields,
    obj.custom_fields
  ].filter(Array.isArray);
  for (const arr of candidates) {
    const match = arr.find(f =>
      f.field_definition_id === fieldDefinitionId ||
      f.fieldDefinitionId   === fieldDefinitionId ||
      f.definition_id       === fieldDefinitionId ||
      f.field_id            === fieldDefinitionId ||
      f.id                  === fieldDefinitionId
    );
    if (match && match.value != null && match.value !== '') return match.value;
  }
  return null;
}

function currentBooking(bookings, today) {
  if (!bookings) return null;
  // Inclusive of departure day so a checkout-day booking still counts as
  // current — guests are typically in the cabin until ~10 AM and need the
  // door code in that window. Same-day turnover: if both the departing and
  // the arriving booking match, prefer the later arrival (next guest).
  const matches = bookings.filter(b => b.arrival <= today && b.departure >= today);
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.arrival || '').localeCompare(a.arrival || ''));
  return matches[0];
}

// Returns 4–8 digit code, or null if input has fewer than 4 digits.
function normalizeCode(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.length > 8 ? digits.slice(-8) : digits;
}

// Last 4 digits of a phone number, or null.
function phoneLast4(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

// Pulls a phone number string out of a guest record. Handles both the legacy
// flat-field shape (some endpoints) and the /v2/guests/{id} shape where
// phones come back as an array of { type, number, is_primary } objects.
// Prefers primary, then cell/mobile, then any.
function extractGuestPhone(guest) {
  if (!guest) return null;
  const flat = guest.phone || guest.cell_phone || guest.home_phone || guest.mobile_phone;
  if (flat) return String(flat);
  if (Array.isArray(guest.phones) && guest.phones.length) {
    const primary = guest.phones.find(p => p && p.is_primary);
    const cell    = guest.phones.find(p => p && /cell|mobile/i.test(String(p.type || '')));
    const pick    = primary || cell || guest.phones[0];
    if (pick) return pick.number || pick.value || pick.phone || null;
  }
  return null;
}

// Derive the door code for a booking. Priority:
//   1. Last 4 of guest phone        (memorable for the guest)
//   2. booking.door_code            (system-generated code on the booking)
//   3. booking BXDOORCODE field     (manual per-booking override)
//   4. propertyBackupCode           (PXDOORBACKUP, per-cabin fallback)
function deriveCode(booking, propertyBackupCode) {
  if (!booking) return normalizeCode(propertyBackupCode);

  const phone = extractGuestPhone(booking.guest) || booking.guest_phone;
  const phoneCode = phoneLast4(phone);
  if (phoneCode) return phoneCode;

  return (
    normalizeCode(booking.door_code) ||
    normalizeCode(getFieldValue(booking, BOOKING_FIELD_DOOR_CODE)) ||
    normalizeCode(propertyBackupCode)
  );
}

module.exports = {
  PROPERTY_IDS,
  BOOKING_FIELD_DOOR_CODE,
  PROPERTY_FIELD_DOOR_BACKUP,
  todayDenver,
  daysAgoDenver,
  daysFromNowDenver,
  fetchBookings,
  fetchGuest,
  fetchPropertyBackupCode,
  currentBooking,
  deriveCode,
  extractGuestPhone,
  phoneLast4,
  getFieldValue,
  normalizeCode
};
