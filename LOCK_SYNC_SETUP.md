# Door Code Sync — Setup Guide

Pushes the current guest's door code to Schlage locks (via SmartThings) automatically each day, derived from OwnerRez bookings. Optionally displays the code on welcome-screen TVs too.

The same code shows up in three places:
- OwnerRez emails / channel messages
- The physical Schlage keypad
- Welcome-screen TVs (optional)

All three are derived from one source: the last 4 digits of the guest's phone number on the OwnerRez booking.

---

## Prerequisites

- **OwnerRez** account with API access enabled (any paid plan)
- **SmartThings** hub with at least one Schlage Z-Wave/Wi-Fi lock per cabin you want to automate
- **Netlify** account (free tier works fine — under 1,000 function invocations per day)
- The repo deployed to Netlify (this code lives in `netlify/functions/`)

---

## Architecture

| Piece | What it does | Where it runs |
|---|---|---|
| `lockcode-sync.js` | Scheduled function. Daily at 11 AM Mountain, looks up each cabin's current booking, derives a 4-digit code, and writes it to slot 10 on each of that cabin's locks via the SmartThings API. | Netlify (scheduled) |
| `lifecycle.js` | Webhook for the SmartThings SmartApp lifecycle (PING/CONFIRMATION/INSTALL/UPDATE/etc.). Captures the OAuth refresh token at install time per Location. | Netlify (on demand) |
| `lockcode.js` | GET endpoint at `/api/lockcode?cabin=<key>` returning `{code, firstName, departure}` for the welcome-screen Door Code slide. Returns `{code:null}` when there's no current guest, the cabin isn't auto-synced, or `LOCKCODE_SHOW` isn't set. | Netlify (on demand) |
| `_ownerrez.js` | Shared OwnerRez helpers — fetch bookings/guests, derive codes. | imported by the above |
| `_smartthings.js` | Shared SmartThings helpers — OAuth token refresh, setCode/deleteCode. | imported by the above |

---

## Path A — Lock sync only (no welcome-screen TVs)

Use this if you just want OR-driven door codes pushed to physical Schlage locks automatically each day.

### Step 1 — Get OwnerRez API credentials

1. OwnerRez → **Settings → API Access**
2. Generate or copy your **API User** and **API Key**

### Step 2 — Enable OwnerRez's "Manual Locks" door-code integration

1. OwnerRez → **Settings → Door Locks** → **+ Connect a Lock Integration** → **Manual Locks**
2. **Code Generation**: Use the guest's phone number, last 4 digits
3. **Generate When**: A number of days before arrival, e.g. 7 days
4. **Generate For**: Bookings only
5. **Code Length**: 4 digits
6. **Active**: Yes
7. **Property Mapping**: assign each property to a placeholder "device" (you can use one shared "welcome door lock" device for all properties — OR's "device" is just an internal grouping; the actual lock is on SmartThings)
8. **Important**: only map the properties whose locks will be auto-synced via SmartThings. Manual-only properties stay unmapped so OR doesn't generate a code that won't match.

### Step 3 — Backfill door codes on existing bookings

OR only generates codes going forward, but in-flight bookings created before you set up the integration won't have codes. Backfill them:

1. OR → **Settings → Door Locks → Batch Update Bookings**
2. Action: **Create new door codes only for bookings that don't already have a door lock code, ignoring the "Generate When" setting**
3. Date filter: today onward (or whatever covers your active bookings)
4. Properties: select the same ones you mapped in step 2
5. **Execute Batch**

### Step 4 — Register a SmartThings SmartApp

1. Go to https://developer.smartthings.com/workspace/projects → **+ New Project** → **Automation for SmartThings**
2. **Develop → Automation Connector | SmartApp**
3. **Hosting tab**: pick **WebHook Endpoint**
4. **Target URL**: `https://<your-netlify-site>.netlify.app/api/lifecycle`
5. **Name & Scope tab**: enable scopes **`r:devices:*`** and **`x:devices:*`**
6. Save
7. Click **"Verify App Registration"** — should flip to **Verified**
8. Click **"Deploy to Test"** — status flips to **Testing**
9. **Copy the Client ID and Client Secret** from the App Credentials section. (The secret only shows once after regeneration.)

### Step 5 — Set Netlify env vars

Netlify → your site → **Site configuration → Environment variables** → add each:

| Variable | Value |
|---|---|
| `OWNERREZ_API_USER` | from step 1 |
| `OWNERREZ_API_KEY` | from step 1 |
| `SMARTTHINGS_CLIENT_ID` | from step 4 |
| `SMARTTHINGS_CLIENT_SECRET` | from step 4 |
| `SMARTTHINGS_REDIRECT_URI` | `https://<your-netlify-site>.netlify.app/api/lifecycle` (same as your webhook URL — it's a placeholder for the lifecycle path) |
| `SMARTTHINGS_DEVICES` | JSON map (placeholder for now — see step 7) |

Initial placeholder for `SMARTTHINGS_DEVICES`:

```json
{"cabin-key-1":{"locationId":"TODO","deviceIds":["lock-uuid-1"]}}
```

**Trigger a deploy** (Deploys → Trigger deploy → Deploy project) so the functions pick up the new env vars.

### Step 6 — Find each cabin's PROPERTY_ID and edit the code

In `netlify/functions/_ownerrez.js`, the `PROPERTY_IDS` map at the top assigns a short cabin key to each OwnerRez property ID. Edit it for your properties:

```js
const PROPERTY_IDS = {
  'cabin-key-1': 123456,  // OwnerRez property ID (visible in OR property URL)
  'cabin-key-2': 234567,
  // ...
};
```

Commit + push.

### Step 7 — Install the SmartApp in each cabin's SmartThings Location

For each Location (cabin) you want auto-synced:

1. SmartThings mobile app → switch to that Location (top dropdown)
2. **Routines** → **+** → **Discover** → find your SmartApp → tap → approve scopes
3. Watch Netlify logs at `https://app.netlify.com/projects/<your-site>/logs/functions/lifecycle`. After install you'll see:
   ```
   Stored refresh token: lifecycle=INSTALL locationId=<some-uuid> installedAppId=<...>
   ```
4. **Copy that locationId** and note which cabin you just installed in
5. Repeat per cabin

If "Cabin Lock Code Sync" doesn't appear under Discover, enable **Developer Mode**: SmartThings app → Settings → tap "About SmartThings" 7 times (newer versions may have moved this — check the version-info screen for a tappable version number).

### Step 8 — Get each lock's device UUID

For each cabin, get the SmartThings device UUID of each Schlage lock:

1. SmartThings mobile app or https://my.smartthings.com → that Location → tap the lock device
2. Device ID / URL contains the UUID

Or, from the SmartThings API:
```
curl -H "Authorization: Bearer <PAT>" https://api.smartthings.com/v1/devices
```

### Step 9 — Update SMARTTHINGS_DEVICES with real values

Replace the placeholder env var with the full mapping:

```json
{
  "cabin-key-1": {
    "locationId": "<uuid-from-step-7>",
    "deviceIds": ["<lock-uuid-1>", "<lock-uuid-2>"]
  },
  "cabin-key-2": {
    "locationId": "<uuid>",
    "deviceIds": ["<lock-uuid>"]
  }
}
```

Each cabin's `deviceIds` is the list of every lock that should receive the guest code. Leave out doors you don't want guests to access (e.g., cleaner-only garage).

Save → trigger another deploy.

### Step 10 — Test the sync manually

Hit:
```
https://<your-netlify-site>.netlify.app/.netlify/functions/lockcode-sync
```

You'll get JSON back with per-cabin results. For each cabin:
- `"status":"set", "code":"XXXX"` → a guest is currently checked in and the code was pushed
- `"status":"no-guest"` → no current guest, slot 10 cleared
- `"status":"auth-failed"` → SmartApp not installed in that Location yet
- `"status":"no-code-derivable"` → booking has no usable phone number

Each device in the cabin should report `"status":"ok"`.

### Step 11 — Physical keypad verification

Walk to one cabin → type the code from the JSON response on the keypad → confirm it unlocks.

### Step 12 — Email templates

Create two email templates in OR — **Settings → Templates → Email**:

**Template A** (auto-sync cabins): trigger filtered to the cabins listed in `SMARTTHINGS_DEVICES`. Body uses `{BDOORCODE}`:
```
Hi {CFIRST},

Your keyless entry code at {PNAME} is: {BDOORCODE}

Enter on the keypad and press the Schlage button. Active at check-in through check-out.

Safe travels!
```

**Template B** (manual cabins): trigger filtered to the cabins NOT in `SMARTTHINGS_DEVICES`. Body uses `{PXDOORBACKUP}`:
```
Hi {CFIRST},

Your keyless entry code at {PNAME} is: {PXDOORBACKUP}

Enter your code on the keypad to unlock.

Safe travels!
```

For manual cabins, populate `{PXDOORBACKUP}` per property: OR → property → Custom Fields → `PXDOORBACKUP` = the static code you've physically programmed on the lock.

Repeat the same A/B split for **Settings → Templates → Channel** (Airbnb/Vrbo messages).

### Done

The scheduled function in `netlify.toml`:
```toml
[functions."lockcode-sync"]
  schedule = "0 17 * * *"
```
runs every day at 17:00 UTC (11 AM Mountain Standard, 10 AM Daylight — after typical checkout time). New guest's code lands on the lock automatically.

---

## Path B — Lock sync PLUS welcome-screen TVs

Use this if you also run the `index.html` welcome-screen slideshow on TVs in your cabins.

### Steps

1. **Do every step in Path A first.** It's the foundation.
2. **Confirm `/api/lockcode?cabin=<key>` works** by hitting:
   ```
   https://<your-netlify-site>.netlify.app/api/lockcode?cabin=<auto-sync-cabin-key>&show=true
   ```
   Should return `{"code":"XXXX","firstName":"Guest","departure":"Month Day"}` for cabins with current guests. The `&show=true` bypasses the kill switch for testing.
3. **Flip the kill switch on for production**: Netlify env vars → add:
   - **Key**: `LOCKCODE_SHOW`
   - **Value**: `true`
   - Save → trigger deploy
4. **Verify** without `&show=true`:
   ```
   https://<your-netlify-site>.netlify.app/api/lockcode?cabin=<key>
   ```
   Auto-sync cabin with current guest → real code returned.
   Manual cabin → `{"code":null}` (intentional — TV slide hides).
   Auto-sync cabin without current guest → `{"code":null}` (slide hides).
5. **Welcome-screen TVs auto-refresh** every ~30 min. Force refresh the browser on any TV to see the change immediately.

### Behavior on the TV

- Cabin has current guest + cabin is in `SMARTTHINGS_DEVICES` → Door Code slide appears showing the synced code, guest's first name, and checkout date
- Any other condition → slide is hidden, TV continues other slides as normal

### Emergency kill switch

If anything ever looks wrong on a TV, remove the `LOCKCODE_SHOW` env var (or set it to `false`) → trigger deploy → all TVs hide the Door Code slide within ~3 min. Non-destructive — nothing on the locks changes, nothing in OR changes.

---

## Reference

### All env vars

| Variable | Required for | What it is |
|---|---|---|
| `OWNERREZ_API_USER` | Path A + B | OR API user |
| `OWNERREZ_API_KEY` | Path A + B | OR API key |
| `SMARTTHINGS_CLIENT_ID` | Path A + B | SmartApp Client ID |
| `SMARTTHINGS_CLIENT_SECRET` | Path A + B | SmartApp Client Secret |
| `SMARTTHINGS_REDIRECT_URI` | Path A + B | Must match the SmartApp's Hosting URL |
| `SMARTTHINGS_DEVICES` | Path A + B | JSON map of cabin keys → `{locationId, deviceIds[]}` |
| `LOCKCODE_SHOW` | Path B only | Set to `true` to enable the TV Door Code slide. Omit / `false` keeps it hidden. |

### `SMARTTHINGS_DEVICES` schema

```json
{
  "<cabin-key>": {
    "locationId": "<smartthings-location-uuid>",
    "deviceIds": ["<lock-uuid-1>", "<lock-uuid-2>", "..."]
  }
}
```

- `<cabin-key>` must match a key in `PROPERTY_IDS` inside `_ownerrez.js`
- `locationId` is the SmartThings Location UUID that owns the locks (and where you installed the SmartApp)
- `deviceIds` lists every lock UUID that should receive the guest code — exclude cleaner-only / owner-only locks

### Code derivation priority

In `deriveCode()` inside `_ownerrez.js`:

1. **Last 4 digits of guest phone** (from `/v2/guests/{id}` → `phones[].number`)
2. **`booking.door_code`** (top-level field if OR's door-lock integration populated it)
3. **BXDOORCODE booking custom field** (manual per-booking override)
4. **`propertyBackupCode`** = PXDOORBACKUP property field (cabin-level fallback)

Priority 1 normally wins for any guest with a phone on file.

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `lockcode-sync` returns `"status":"auth-failed"` for a cabin | SmartApp never installed in that Location, or refresh token expired (30 days idle) | Open SmartThings mobile app → switch to that Location → re-install or "Save" the SmartApp to fire UPDATE lifecycle |
| `/api/lockcode` returns `null` despite a current guest | `LOCKCODE_SHOW` not set, OR cabin not in `SMARTTHINGS_DEVICES`, OR guest has no phone on OR booking | Check each in order |
| OR email previews show `{BDOORCODE}` as empty | OR's integration hasn't generated a code for that booking (typically because the booking was created before the integration was set up) | Run the **Batch Update Bookings** tool with "Create codes for bookings that don't have one, ignoring Generate When" |
| Garbled CJK guest names in the JSON sync response | Netlify Functions encoding artifact in the response body only — the actual `setCode` call to SmartThings carries the bytes correctly | Cosmetic — name displays correctly in OR and on SmartThings lock-code label |
| New SmartThings app hides the "Manage Codes" UI | Newer Edge drivers moved it | Use the sync function itself — set a cabin to "no-guest" via OR (cancel booking) and trigger sync, which calls `deleteCode` on slot 10 |

---

## Daily operation

- **Scheduled run**: 11 AM Mountain (17:00 UTC) — defined in `netlify.toml`. Adjust there if your check-out time differs.
- **On-demand run**: hit `https://<your-site>.netlify.app/.netlify/functions/lockcode-sync` anytime to force a sync (e.g., after a late-day booking change).
- **Add a new cabin**: pair the lock in SmartThings → install the SmartApp in that Location (captures token) → add the cabin key + locationId + deviceId(s) to `SMARTTHINGS_DEVICES` env var → also add it to `PROPERTY_IDS` in `_ownerrez.js`. Redeploy.
- **Remove a lock from auto-sync** (e.g., owner-only door): remove just its UUID from the cabin's `deviceIds` array. Run sync once with the cabin in "no-guest" state to clear slot 10 on the removed lock before excluding it (or manually delete slot 10 via SmartThings).

---

## Cost

- **Netlify**: free tier covers everything (well under 125k function invocations / month)
- **SmartThings**: free
- **OwnerRez**: API is included in your plan (no per-request fees)
- **Total monthly cost added by this system**: $0
