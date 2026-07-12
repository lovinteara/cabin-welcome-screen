// Shared ChargePoint helpers. Filename starts with `_` so Netlify doesn't
// deploy it as its own function — it's imported by charging.js.
//
// ChargePoint has no official public API for *home* chargers, so this uses
// the same unofficial driver API the mobile app and the community
// `python-chargepoint` library use:
//   1. discover endpoints   GET  https://discovery.chargepoint.com/discovery/v3/globalconfig
//   2. log in               POST {sso_endpoint}v1/user/login   {username,password}
//                           -> sets the `coulomb_sess` session token
//   3. pull charging history from the driver "charging activity" endpoint,
//      which returns one record per session incl. Energy (kWh) + timestamps.
//
// Credentials live in Netlify environment variables (never in this file):
//   CP_<KEY>_USER  /  CP_<KEY>_PASS   e.g. CP_GATHERING_USER / CP_GATHERING_PASS
//
// Until those are set, everything runs in DEMO mode with realistic sample
// data so the dashboard is fully usable before go-live.

const DISCOVERY_URL = 'https://discovery.chargepoint.com/discovery/v3/globalconfig';
const USER_AGENT    = 'cabin-charging-dashboard/1.0';

// One entry per ChargePoint login (each charger has its own account).
// `property` ties a charger to the OwnerRez property so each charging session
// can be matched to the guest who was staying. It may be:
//   - a property key (e.g. 'huckleberry')  -> match that cabin's guests
//   - an array of keys                      -> match across several cabins
//   - null                                  -> no cabin link; show sessions by
//                                              date so the owner bills manually
// Caldera has two chargers (cottage + garage) under two logins; both map to the
// caldera property so both bill against Caldera's guests.
//
// Edit the labels/property keys here to match your real setup.
const ACCOUNTS = [
  { key: 'gathering',      label: 'The Gathering Place',      property: 'gathering'   },
  { key: 'chalets',        label: 'Chalets',                  property: null          },
  { key: 'huckleberry',    label: 'Huckleberry Hut',          property: 'huckleberry' },
  { key: 'cty',            label: 'Close To Yellowstone',     property: null          },
  { key: 'caldera',        label: 'Caldera Cottage',          property: 'caldera'     },
  { key: 'caldera-garage', label: 'Caldera Cottage — Garage', property: 'caldera'     }
];

// Env-var suffix for a charger key: uppercase, non-alphanumerics to underscore.
// e.g. 'caldera-garage' -> CP_CALDERA_GARAGE_USER / CP_CALDERA_GARAGE_PASS
function envKey(key) {
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function accountCreds(key) {
  const U = envKey(key);
  const user = process.env[`CP_${U}_USER`];
  const pass = process.env[`CP_${U}_PASS`];
  if (!user || !pass) return null;
  return { user, pass };
}

// True when at least one ChargePoint login is configured. When false the API
// falls back to demo data.
function anyCredsConfigured() {
  return ACCOUNTS.some(a => accountCreds(a.key));
}

// The $/kWh rate used to estimate what to bill a guest. Owner-configurable via
// the CP_RATE env var or the ?rate= query param; falls back to a sane default.
function defaultRate() {
  const r = parseFloat(process.env.CP_RATE || '');
  return Number.isFinite(r) && r > 0 ? r : 0.16;
}

// ---- Live ChargePoint client -------------------------------------------------

async function discoverEndpoints() {
  const res = await fetch(DISCOVERY_URL, {
    headers: { 'user-agent': USER_AGENT, 'accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`discovery ${res.status}`);
  const cfg = await res.json();
  // The discovery payload nests endpoints per region; grab the first region's
  // endpoints (US). Shape: { <region>: { endpoints: { sso_endpoint, ... } } }
  const region = cfg && (cfg.US || cfg[Object.keys(cfg)[0]]);
  const endpoints = (region && (region.endpoints || region)) || {};
  return {
    sso:    endpoints.sso_endpoint    || 'https://sso.chargepoint.com/',
    portal: endpoints.portal_domain_endpoint || 'https://account.chargepoint.com/',
    accounts: endpoints.accounts_endpoint || 'https://account.chargepoint.com/'
  };
}

// Log in and return the coulomb_sess session token (used as cp-session-token).
async function login(endpoints, user, pass) {
  const url = new URL('v1/user/login', endpoints.sso).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'user-agent': USER_AGENT, 'content-type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  if (!res.ok) throw new Error(`login ${res.status}`);

  // Token arrives as the `coulomb_sess` cookie and/or in the JSON body.
  let token = null;
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/coulomb_sess=([^;]+)/);
  if (m) token = m[1];
  if (!token) {
    const body = await res.json().catch(() => ({}));
    token = body.sessionId || body.session_id || body.token || null;
  }
  if (!token) throw new Error('login: no session token returned');
  return token;
}

// Pull raw charging-activity records for one account within [from,to].
// Returns [] on any failure so one bad account never breaks the whole board.
async function fetchActivity(endpoints, token, fromDate, toDate) {
  // Driver "charging activity" endpoint. If ChargePoint shifts this path at
  // go-live, the raw response is logged below so it's a one-line fix.
  const url = new URL('index.php/mobileapi/v2/getChargingActivityMonthly', endpoints.portal).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'user-agent': USER_AGENT,
      'content-type': 'application/json',
      'cp-session-type': 'CP_SESSION_TOKEN',
      'cp-session-token': token,
      'cookie': `coulomb_sess=${token}`
    },
    body: JSON.stringify({ from_date: fromDate, to_date: toDate })
  });
  if (!res.ok) {
    console.error('ChargePoint activity error:', res.status, (await res.text()).slice(0, 300));
    return [];
  }
  const data = await res.json().catch(() => null);
  if (!data) return [];
  // Normalize across the field-name variants ChargePoint has used.
  const list = data.session_info || data.sessions || data.charging_activity || data.data || [];
  return Array.isArray(list) ? list.map(normalizeSession) : [];
}

// Map a raw ChargePoint session record onto our tidy shape.
function normalizeSession(s) {
  const kwh = num(s.energy_kwh ?? s.energyKwh ?? s.Energy ?? s.energy ?? s.total_energy);
  const start = s.start_time ?? s.startTime ?? s.start ?? s.charging_time_start ?? null;
  const end   = s.end_time   ?? s.endTime   ?? s.end   ?? s.charging_time_end   ?? null;
  return {
    id:      s.session_id ?? s.sessionID ?? s.id ?? null,
    station: s.station_name ?? s.stationName ?? s.device_name ?? s.deviceName ?? 'Charger',
    start:   toIso(start),
    end:     toIso(end),
    kwh:     Math.round(kwh * 100) / 100
  };
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function toIso(v) {
  if (v == null) return null;
  // Accept ms/seconds epoch or an ISO/date string.
  if (typeof v === 'number') {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Fetch normalized sessions for one account, logging in first.
async function fetchAccountSessions(key, fromDate, toDate) {
  const creds = accountCreds(key);
  if (!creds) return [];
  try {
    const endpoints = await discoverEndpoints();
    const token = await login(endpoints, creds.user, creds.pass);
    return await fetchActivity(endpoints, token, fromDate, toDate);
  } catch (e) {
    console.error(`ChargePoint account "${key}" failed:`, e.message);
    return [];
  }
}

// ---- Demo data ---------------------------------------------------------------

// Deterministic pseudo-random so the demo looks stable across reloads for a
// given date range (seeded off the day count) but still varied per charger.
function seeded(seed) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

const DEMO_GUESTS = {
  gathering:   ['The Andersons', 'Marcus Lee', 'Priya & Sam', 'The Whitfields'],
  huckleberry: ['Jordan Blake', 'The Nguyen Family', 'Dana Ruiz'],
  caldera:     ['The Petersons', 'Chloe Adams', 'Rob & Kim', 'The Halvorsens'],
  chalets:     ['The Riveras', 'Sam Dalton', 'The Brookes'],
  cty:         ['Elena Marsh', 'The Carters', 'Devon Wu']
};

function demoSessions(account, fromDate, toDate, rng) {
  const from = new Date(fromDate + 'T00:00:00');
  const to   = new Date(toDate   + 'T23:59:59');
  const days = Math.max(1, Math.round((to - from) / 86400000));
  const guests = DEMO_GUESTS[account.property] || DEMO_GUESTS[account.key] || ['Guest'];
  const stations = [account.label];

  const sessions = [];
  // Roughly one charging session every 3–5 days per station.
  stations.forEach((station, si) => {
    let day = Math.floor(rng() * 4);
    while (day < days) {
      const start = new Date(from.getTime() + day * 86400000 + (16 + rng() * 4) * 3600000);
      const hours = 3 + rng() * 8;                       // 3–11h plugged in overnight
      const kwh = Math.round((5 + rng() * 40) * 10) / 10; // 5–45 kWh
      const end = new Date(start.getTime() + hours * 3600000);
      const guest = guests[Math.floor(rng() * guests.length)];
      sessions.push({
        id: `demo-${account.key}-${si}-${day}`,
        station,
        start: start.toISOString(),
        end: end.toISOString(),
        kwh,
        _demoGuest: guest
      });
      day += 3 + Math.floor(rng() * 3);
    }
  });
  return sessions;
}

module.exports = {
  ACCOUNTS,
  accountCreds,
  anyCredsConfigured,
  defaultRate,
  fetchAccountSessions,
  demoSessions,
  seeded
};
