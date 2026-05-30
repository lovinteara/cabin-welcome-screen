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

// Looks up the property's PXDOORBACKUP value (per-cabin fallback code).
// Returns the raw string or null. Caller normalizes via deriveCode.
async function fetchPropertyBackupCode(propertyId) {
  const headers = orHeaders();
  if (!headers) return null;

  // OwnerRez v2 exposes property custom fields via a dedicated endpoint,
  // not via include params on /v2/properties.
  const url = `https://api.ownerreservations.com/v2/propertyfieldvalues?property_ids=${propertyId}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error('OwnerRez property fields error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const match = items.find(f =>
    f.field_definition_id === PROPERTY_FIELD_DOOR_BACKUP ||
    f.fieldDefinitionId   === PROPERTY_FIELD_DOOR_BACKUP ||
    f.field_id            === PROPERTY_FIELD_DOOR_BACKUP ||
    f.id                  === PROPERTY_FIELD_DOOR_BACKUP
  );
  return match && match.value != null && match.value !== '' ? match.value : null;
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
  return bookings.find(b => b.arrival <= today && b.departure > today) || null;
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

// Derive the door code for a booking. Priority:
//   1. Last 4 of guest phone        (memorable for the guest)
//   2. booking.door_code            (system-generated code on the booking)
//   3. booking BXDOORCODE field     (manual per-booking override)
//   4. propertyBackupCode           (PXDOORBACKUP, per-cabin fallback)
function deriveCode(booking, propertyBackupCode) {
  if (!booking) return normalizeCode(propertyBackupCode);

  const phone =
    (booking.guest && (booking.guest.phone || booking.guest.cell_phone || booking.guest.home_phone)) ||
    booking.guest_phone;
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
  fetchPropertyBackupCode,
  currentBooking,
  deriveCode,
  getFieldValue,
  normalizeCode
};
