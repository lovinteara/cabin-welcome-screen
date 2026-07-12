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

const cp = require('./_chargepoint');
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
  const { first, last } = monthBoundsDenver();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : first;
  const to   = /^\d{4}-\d{2}-\d{2}$/.test(q.to   || '') ? q.to   : last;
  const rate = (() => {
    const r = parseFloat(q.rate);
    return Number.isFinite(r) && r > 0 ? r : cp.defaultRate();
  })();

  const demo = q.demo === '1' || !cp.anyCredsConfigured();

  const rng = cp.seeded(hashRange(from, to));

  const chargers = [];
  for (const account of cp.ACCOUNTS) {
    // 1) Gather sessions (live from ChargePoint, or demo).
    let sessions;
    if (demo) {
      sessions = cp.demoSessions(account, from, to, rng);
    } else {
      const raw = await cp.fetchAccountSessions(account.key, from, to);
      sessions = raw.filter(s => {
        const d = (s.start || '').slice(0, 10);
        return d && d >= from && d <= to;
      });
    }

    // 2) Match each session to a guest.
    let bookings = null;
    if (!demo) {
      const pid = PROPERTY_IDS[account.property];
      bookings = pid ? await fetchBookings(pid, from, to) : null;
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
      } else {
        const g = guestForSession(s, bookings);
        guestName = g ? g.name : 'Unmatched (owner / gap)';
      }

      // Per-station rollup
      const st = perStation.get(s.station) || { name: s.station, kwh: 0, cost: 0, sessions: 0 };
      st.kwh += kwh; st.cost += cost; st.sessions += 1;
      perStation.set(s.station, st);

      // Per-guest rollup
      const gr = perGuest.get(guestName) || { name: guestName, kwh: 0, cost: 0, sessions: 0 };
      gr.kwh += kwh; gr.cost += cost; gr.sessions += 1;
      perGuest.set(guestName, gr);

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
