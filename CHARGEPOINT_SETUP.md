# EV Charging Dashboard — Setup

A dashboard to see how much electricity each cabin's ChargePoint charger used,
which guest was staying when they charged, and a dollar estimate so you can bill
them for it. So you're not paying for guests' fuel.

- **Dashboard:** https://cabin-welcome-screen.netlify.app/charging.html
  (also linked from the Admin page under **Tools → ⚡ EV Charging**)
- **Data source:** `/api/charging` (Netlify function `charging.js`)

Until ChargePoint logins are added (below), the dashboard shows **sample data**
so you can see exactly how it looks and works. Adding the logins switches it to
your real usage automatically — no code change needed.

---

## How it works

1. For each cabin, a small server function logs into that cabin's ChargePoint
   account and pulls the **charging session history** — every session's energy
   (kWh) and start/end time.
2. Each session is matched to the guest who was staying that night, using your
   existing **OwnerRez** booking data (same connection the door codes use).
3. It multiplies kWh by a **rate you set** ($/kWh) to estimate what to bill.
   Energy is measured; the dollar amount is just kWh × your rate.

A "Copy" button on each guest row copies a ready-to-send billing line, e.g.:

> The Andersons — EV charging at The Gathering Place, 2026-06-01 to 2026-06-30:
> 52.0 kWh × $0.16/kWh = $8.32

> **Note on the ChargePoint connection:** ChargePoint has no official public API
> for home chargers, so this uses the same unofficial driver login the mobile
> app uses. It works well, but if ChargePoint ever changes it, the charging
> function may need a small update. Your OwnerRez guest matching is unaffected.

---

## Going live — add your ChargePoint logins

Your passwords are **never** stored in the code or the repo. They go into
Netlify's encrypted environment variables.

1. Go to **Netlify → your site → Site configuration → Environment variables**.
2. Add a **username** and **password** pair for each cabin's ChargePoint account,
   using these exact names:

   | Cabin | Username variable | Password variable |
   |-------|-------------------|-------------------|
   | The Gathering Place | `CP_GATHERING_USER` | `CP_GATHERING_PASS` |
   | Huckleberry Hut | `CP_HUCKLEBERRY_USER` | `CP_HUCKLEBERRY_PASS` |
   | Caldera Cottage *(covers cottage **and** garage charger)* | `CP_CALDERA_USER` | `CP_CALDERA_PASS` |
   | Close To Yellowstone | `CP_CTY_USER` | `CP_CTY_PASS` |

   Caldera's one login carries both its chargers — they show up as two separate
   lines on the dashboard automatically.

3. *(Optional)* Set a default billing rate with `CP_RATE` (e.g. `0.16`). You can
   also change the rate right on the dashboard anytime.
4. **Deploy** (Netlify → Deploys → *Trigger deploy*). As soon as at least one
   login is set, the dashboard stops showing sample data and pulls real usage.

### If a cabin's ChargePoint login is under a different name

The four cabins above are what the dashboard expects. If your accounts are
organized differently (e.g. a different property has the fourth charger, or the
"Close To Yellowstone" charger is really a different cabin), tell me the real
mapping and I'll adjust the `ACCOUNTS` list in
`netlify/functions/_chargepoint.js` — it's a two-minute change.

---

## Adjusting later

- **Change the rate:** type a new $/kWh on the dashboard, or set `CP_RATE`.
- **Change the date range:** use the quick buttons (This month / Last month /
  Last 30 days / Year to date) or pick custom From/To dates.
- **Add or rename a charger:** edit `ACCOUNTS` in
  `netlify/functions/_chargepoint.js` (label + which OwnerRez property it maps
  to), then add matching `CP_<KEY>_USER` / `CP_<KEY>_PASS` variables.
- **Guest shows as "Unmatched (owner / gap)":** the session happened when no
  guest was booked — likely you testing the charger, or a gap between stays.
