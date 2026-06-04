# CabinCast Pro — Integrations Setup (Getting the Keys)

How to actually obtain every credential the system uses and where each one goes. This is the file to hand a new property manager when they need to wire up their own integrations.

All credentials are set as **environment variables on the Netlify site** (Site configuration → Environment variables → Add a variable). After adding or changing any of them, you **must redeploy** — and if it still doesn't take effect, **Deploys → Trigger deploy → Clear cache and deploy site.**

> **None of these are required for the basic slideshow.** Weather, activities, restaurants, WiFi, and the all-cabins grid all work with zero credentials. Add an integration only when you want that specific feature.

> **The exact variable names below matter** — they're read verbatim by the functions. A typo means the feature silently does nothing (the functions are written to fail quietly and just hide the slide, so you won't get an error — you'll get a blank).

---

## 1. OwnerRez — guest name, departure date, pets

Powers the personalized greeting and feeds the celebration auto-expiry. Function: `netlify/functions/guest.js`.

### What you need
| Env var | What it is |
|---|---|
| `OWNERREZ_API_USER` | Your OwnerRez **username** (the login email/username) |
| `OWNERREZ_API_KEY` | An OwnerRez **API access token** |

The function combines them as HTTP Basic auth (`user:key`, base64-encoded) against `https://api.ownerreservations.com/v2/bookings`. Both must be present or the function just returns "no guest."

### How to get the API key
1. Log into OwnerRez.
2. **Settings → API Access** (look under integrations/developer settings — OwnerRez calls these "API v2 tokens" or "Personal Access Tokens").
3. **Create a new token.** Give it a name like "CabinCast Pro." Grant it read access to **bookings/reservations** (and guest/contact info). It doesn't need write access for the welcome screen.
4. Copy the token immediately — you usually can't see it again. That's your `OWNERREZ_API_KEY`.
5. Your `OWNERREZ_API_USER` is your OwnerRez account username.

### The step everyone forgets: PROPERTY_IDS
`guest.js` contains a map tying each cabin key to its **OwnerRez property ID**:
```js
const PROPERTY_IDS = {
  huckleberry: 293956,
  gathering:   246664,
  // ...
};
```
For a new client, you must replace these with **their** property IDs, or the function won't know which OwnerRez property each cabin is. Find a property's ID in OwnerRez by opening that property — the ID is in the URL, or under the property's settings. Edit the map in `guest.js` to match their cabins, then commit.

### Verify
Visit `https://YOUR-SITE.netlify.app/api/guest?cabin=YOURKEY`. If credentials and the property ID are right and there's a current booking, you'll get back a guest object. If you get `{ "guest": null }` with a booking active, recheck the token, the username, and that the cabin's `PROPERTY_IDS` entry matches OwnerRez.

---

## 2. JotForm — celebration / personalization messages

Lets you (or the client) post a "Happy Anniversary, the Smiths!" message to a specific cabin's screen. Function: `netlify/functions/celebration.js` → stored in Netlify Blobs → shown on the TV, auto-expiring at the guest's departure.

### What you need
- A **JotForm form** with fields for: cabin, occasion, guest name, message.
- The form's **webhook** pointed at your function.
- Netlify Blobs (built in — see the Blobs note below).

### Steps
1. **Build the form in JotForm** with those four fields. For "cabin," a dropdown whose values are the cabin keys (or names) is easiest.
2. In the form: **Settings → Integrations → Webhooks** (or **Settings → Webhooks**).
3. Add this webhook URL:
   `https://YOUR-SITE.netlify.app/api/celebration`
4. Save. JotForm will POST every submission there.

### The two JotForm gotchas (both already handled in code, but know them)
- **Field names are auto-generated** (`q2_q2_dropdown0`, etc.) and unpredictable. The function parses the human-readable **`pretty`** field instead, and also keyword-matches field names containing "cabin," "occasion," "name," "message." So name your questions clearly and it'll find them.
- **Cabin name normalization:** the function maps friendly names ("Caldera Cottage") and piped values ("Caldera Cottage|caldera") down to the cabin key. If you add a new cabin, make sure its name→key mapping exists in `celebration.js`'s `nameToKey`.

### Netlify Blobs note
`celebration.js` uses the Lambda-style handler, which does **not** auto-configure Blobs. It calls `connectLambda(event)` first, with a fallback to these env vars if needed:
| Env var | When needed |
|---|---|
| `NETLIFY_SITE_ID` (or `SITE_ID`) | Fallback if `connectLambda` isn't available |
| `NETLIFY_BLOBS_TOKEN` (or `NETLIFY_API_TOKEN`) | Same |

On a normal Netlify deploy you usually **don't** need to set these — `connectLambda` handles it. Only add them if Blobs reads/writes fail. A Netlify API token comes from **User settings → Applications → Personal access tokens**; the site ID is in **Site configuration → General → Site details.**

### Verify
Submit the JotForm once for a test cabin, then load that cabin's screen — the celebration slide should appear. To clear it, submit again with an "action: clear," or let it auto-expire at departure.

---

## 3. SmartThings + OwnerRez — live door codes

The most involved integration, and it has its **own dedicated guide: [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md).** Don't duplicate that here — follow it. This is just the recap of the keys involved and the one safety switch that trips people up.

Functions: `netlify/functions/lockcode.js` (what the TV reads) plus the sync job described in `LOCK_SYNC_SETUP.md`.

### The env vars
| Env var | What it does |
|---|---|
| `SMARTTHINGS_DEVICES` | A JSON map of cabin key → SmartThings device info. **Only cabins listed here return a code** — manual-lock cabins stay blank so guests never see a code that doesn't match the physical keypad. |
| `LOCKCODE_SHOW` | **The safety switch.** Door codes stay hidden (`{ code: null }`) unless this is set to exactly `true`. Keep it off until you've run the sync and confirmed the code actually landed on each physical lock. |
| OwnerRez creds | Same `OWNERREZ_API_USER` / `OWNERREZ_API_KEY` as section 1 — reused to find the current guest. |
| SmartThings OAuth | A SmartThings app + token, fully covered in [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md) (including the refresh-token storage in Blobs). |

### The critical safety behavior
`lockcode.js` returns `{ code: null }` — meaning the TV shows the **fallback gallery photo, not a code** — in all of these cases:
- `LOCKCODE_SHOW` is not `true`, or
- the cabin isn't in `SMARTTHINGS_DEVICES`, or
- there's no current guest / no derived code.

This is deliberate: **a guest is never shown a door code that might not work.** When you onboard a new client, leave `LOCKCODE_SHOW` off until their locks are synced and verified per [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md). Same `PROPERTY_IDS` caveat as OwnerRez applies — the lockcode function needs each cabin mapped to its property.

### Verify
With everything set and `LOCKCODE_SHOW=true`, hit `https://YOUR-SITE.netlify.app/api/lockcode?cabin=YOURKEY` — you should get a code for an auto-sync cabin with a current guest, or `{ code: null }` otherwise. Full troubleshooting is in [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md).

---

## Summary — every env var at a glance

| Variable | Feature | Required for that feature? |
|---|---|---|
| `OWNERREZ_API_USER` | Guest greeting + locks | Yes |
| `OWNERREZ_API_KEY` | Guest greeting + locks | Yes |
| `SMARTTHINGS_DEVICES` | Door codes | Yes (locks) |
| `LOCKCODE_SHOW` | Door codes | Must be `true` to show codes |
| `NETLIFY_SITE_ID` / `SITE_ID` | Celebrations (Blobs fallback) | Only if Blobs fails |
| `NETLIFY_BLOBS_TOKEN` / `NETLIFY_API_TOKEN` | Celebrations (Blobs fallback) | Only if Blobs fails |

Plus two **in-code** maps to update per client (not env vars): `PROPERTY_IDS` (cabin → OwnerRez property) in `guest.js` and `lockcode.js`, and `nameToKey` (cabin name → key) in `celebration.js`.

> After setting any variable: redeploy, and if it doesn't take, **Clear cache and deploy site.** Most "the integration isn't working" moments are a missing redeploy or a one-character typo in the variable name.
