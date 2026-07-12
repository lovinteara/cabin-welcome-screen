// netlify/functions/charging.js
//
// Returns EV charging usage across all cabin ChargePoint chargers, with each
// charging session matched to the guest who was staying (via OwnerRez), plus a
// dollar estimate at an owner-set $/kWh rate. Powers charging.html.
//
// GET /api/charging?from=YYYY-MM-DD&to=YYYY-MM-DD&rate=0.16
//   from/to  date range (defaults to the current calendar month)
//   rate     $/kWh used for the cost estimate (defaults to CP_RATE or 0.16)
//   demo=1   force demo data even if credentials are set
//
// Runs in demo mode automatically until ChargePoint credentials are added as
// Netlify env vars (see CHARGEPOINT_SETUP.md).

// Bump BUILD whenever this function changes so the dashboard can show which
// version is actually deployed (handy for confirming a deploy went live).
const BUILD = 'v9-import';

const cp = require('./_chargepoint');
const { getImportedSessions } = require('./_store');
const {
  PROPERTY_IDS,
  fetchBookings,
  currentBooking
} = require('./_ownerrez');

function monthBoundsDenver() {
  // First and last day of the current month in Mountain time, as YYYY-MM-DD.
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' }); // YYYY-MM-DD
  const [y, m] = now.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

// Which guest was staying when a session started? A session on the departure
// morning still belongs to the departing guest, so we match arrival <= day <=
// departure (inclusive of the checkout day).
function guestForSession(session, bookings) {
  if (!bookings || !bookings.length) return null;
  const day = (session.start || '').slice(0, 10);
  if (!day) return null;
  const matches = bookings.filter(b => b.arrival <= day && day <= b.departure);
  if (!matches.length) return null;
  // Same-day turnover: the guest whose stay started latest owns the morning.
  matches.sort((a, b) => (b.arrival || '').localeCompare(a.arrival || ''));
  const b = matches[0];
  return {
    name: (b.guest && (b.guest.full_name || b.guest.name)) || 'Guest',
    arrival: b.arrival,
    departure: b.departure,
    bookingId: b.id
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  const q = event.queryStringParameters || {};

  // Safe one-time diagnostic: /api/charging?debug=1 probes the discovery
  // endpoint for the first configured charger (username only, no password) so
  // we can see which request ChargePoint accepts. Remove once connected.
  if (q.debug === '1') {
    const acct = cp.ACCOUNTS.find(a => cp.accountCreds(a.key));
    if (!acct) {
      return { statusCode: 200, headers, body: JSON.stringify({ debug: true, note: 'No charger login configured yet.' }) };
    }
    const creds = cp.accountCreds(acct.key);
    const [probes, accounts] = await Promise.all([
      cp.probeDiscovery(creds.user),
      cp.probeAllAccounts()
    ]);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        debug: true,
        build: BUILD,
        firstAccount: acct.key,
        requestShapes: probes,
        accounts
      }, null, 2)
    };
  }

  const { first, last } = monthBoundsDenver();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : first;
  const to   = /^\d{4}-\d{2}-\d{2}$/.test(q.to   || '') ? q.to   : last;
  const rate = (() => {
    const r = parseFloat(q.rate);
    return Number.isFinite(r) && r > 0 ? r : cp.defaultRate();
  })();

  // Real data now comes from imported ChargePoint statements (stored in Blobs),
  // since ChargePoint blocks automated logins from a server. Demo only on
  // explicit ?demo=1.
  const demo = q.demo === '1';

  const rng = cp.seeded(hashRange(from, to));

  const chargers = [];
  for (const account of cp.ACCOUNTS) {
    // 1) Gather sessions — imported ChargePoint statement data (or demo).
    let sessions;
    let status = demo ? 'demo' : 'ok';
    let statusDetail = '';
    if (demo) {
      sessions = cp.demoSessions(account, from, to, rng);
    } else {
      const all = await getImportedSessions(event, account.key);
      status = all.length ? 'ok' : 'no_import';
      sessions = all
        .filter(s => {
          const d = (s.start || '').slice(0, 10);
          return d && d >= from && d <= to;
        })
        .map(s => ({ ...s, station: s.station || account.label }));
    }

    // 2) Match each session to a guest. A charger with a property key (or an
    //    array of them) gets guest names; one with property=null is shown by
    //    date so the owner bills manually. Demo data always carries names.
    const matchable = demo ? true : account.property != null;
    let bookings = null;
    if (!demo && matchable) {
      const props = Array.isArray(account.property) ? account.property : [account.property];
      bookings = [];
      for (const p of props) {
        const pid = PROPERTY_IDS[p];
        if (!pid) continue;
        const b = await fetchBookings(pid, from, to);
        if (b) bookings.push(...b);
      }
    }

    const perStation = new Map();
    const perGuest = new Map();
    let totalKwh = 0;
    const sessionRows = [];

    for (const s of sessions) {
      const kwh = s.kwh || 0;
      totalKwh += kwh;
      const cost = round2(kwh * rate);

      let guestName;
      if (demo) {
        guestName = s._demoGuest || 'Guest';
      } else if (matchable) {
        const g = guestForSession(s, bookings);
        guestName = g ? g.name : 'Unmatched (owner / gap)';
      } else {
        guestName = null; // no cabin link — bill by date
      }

      // Per-station rollup
      const st = perStation.get(s.station) || { name: s.station, kwh: 0, cost: 0, sessions: 0 };
      st.kwh += kwh; st.cost += cost; st.sessions += 1;
      perStation.set(s.station, st);

      // Per-guest rollup (only when we have guest names)
      if (guestName) {
        const gr = perGuest.get(guestName) || { name: guestName, kwh: 0, cost: 0, sessions: 0 };
        gr.kwh += kwh; gr.cost += cost; gr.sessions += 1;
        perGuest.set(guestName, gr);
      }

      sessionRows.push({
        station: s.station,
        start: s.start,
        end: s.end,
        kwh: round2(kwh),
        cost,
        guest: guestName
      });
    }

    sessionRows.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    const stations = [...perStation.values()].map(x => ({ ...x, kwh: round2(x.kwh), cost: round2(x.cost) }));
    const guests = [...perGuest.values()]
      .map(x => ({ ...x, kwh: round2(x.kwh), cost: round2(x.cost) }))
      .sort((a, b) => b.kwh - a.kwh);

    chargers.push({
      key: account.key,
      label: account.label,
      property: account.property,
      matchable,
      status,
      statusDetail,
      configured: demo ? false : !!cp.accountCreds(account.key),
      totalKwh: round2(totalKwh),
      totalCost: round2(totalKwh * rate),
      sessionCount: sessions.length,
      stations,
      guests,
      sessions: sessionRows
    });
  }

  const totals = chargers.reduce((acc, c) => {
    acc.kwh += c.totalKwh; acc.cost += c.totalCost; acc.sessions += c.sessionCount;
    return acc;
  }, { kwh: 0, cost: 0, sessions: 0 });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      demo,
      build: BUILD,
      from,
      to,
      rate,
      chargers,
      totals: { kwh: round2(totals.kwh), cost: round2(totals.cost), sessions: totals.sessions }
    })
  };
};

// Small stable hash of the date range so demo data is consistent per range.
function hashRange(a, b) {
  const s = `${a}|${b}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  return h || 1;
}
