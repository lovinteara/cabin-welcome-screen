# CabinCast Pro — Setup From Scratch

This is the master, ground-up build guide for standing up the entire welcome-screen system on a brand-new account. If you ever lose everything, or want to understand how the pieces fit, start here.

> **The mental model:** CabinCast Pro is the *product*. "Visit Island Park Idaho" is the first *instance* of it. Each instance = **one GitHub repo + one Netlify site + that client's cabins**. To set the system up for another property manager, you don't add cabins to this repo — you stand up a second instance. That playbook lives in **[NEW_CLIENT_SETUP.md](NEW_CLIENT_SETUP.md)**.

---

## What the system is

A rotating, full-screen slideshow that runs on a display in each cabin (TV, monitor, or iPad). It pulls live weather, activities, restaurants, drive times, park alerts, WiFi info, door codes, and guest-specific celebration messages. Each display loads the same web app with a different `?cabin=KEY` on the end of the URL, and the app themes and personalizes itself for that cabin.

**Hosting:** Netlify (static files + serverless functions + Netlify Blobs storage)
**Code:** GitHub repo (`lovinteara/cabin-welcome-screen`)
**Displays:** A small computer per cabin (Raspberry Pi is the default) loading the URL in full-screen kiosk mode. See `DISPLAY_OPTIONS.md` for TV vs. monitor vs. iPad.

---

## The file structure

```
cabin-welcome-screen/
├── index.html              # The whole slideshow UI + slide logic
├── config.js               # ← THE file you edit most: cabin list, WiFi,
│                           #    coordinates, themes, activities, restaurants,
│                           #    trash days, cleaning checklists
├── admin.html              # Admin page to manage slides / cabin tags
├── README.md               # Day-to-day operations + Pi setup
├── LOCK_SYNC_SETUP.md      # Door-lock (SmartThings/OwnerRez) integration guide
├── INTEGRATIONS_SETUP.md   # How to GET every API key/credential & where it goes
├── netlify.toml            # Netlify build + the /api/* → functions redirect
├── package.json            # Declares @netlify/blobs dependency
├── netlify/
│   └── functions/
│       ├── celebration.js  # JotForm webhook → Blobs → TV celebration slide
│       ├── guest.js        # Guest data (name, departure, pets) from OwnerRez
│       └── lockcode.js     # Live door codes (see LOCK_SYNC_SETUP.md)
└── (gallery images: gallery-1.jpeg … plus per-cabin logos)
```

Weather is fetched client-side in `index.html` (no function needed).

---

## Part 1 — GitHub repo

1. Create a GitHub account if you don't have one.
2. **New repository** → name it (e.g. `cabin-welcome-screen`) → Private is fine → Create.
3. Get the files in. Two ways:
   - **Easiest:** download this repo as a ZIP, unzip, and drag the files into the new repo using GitHub's web "Add file → Upload files."
   - **Or** use GitHub Desktop: clone the new empty repo, copy the files in, commit, push.
4. You commit files yourself going forward — either GitHub's web editor or GitHub Desktop. (Claude prepares files; you push them.)

---

## Part 2 — Netlify site

1. Create a Netlify account and **log in with GitHub** (simplest — it can then see your repos).
2. **Add new site → Import an existing project → GitHub →** pick your repo.
3. Build settings: leave them as detected. `netlify.toml` already declares everything:
   ```toml
   [build]
     publish = "."
     functions = "netlify/functions"

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```
   That redirect is what lets the app call `/api/celebration` instead of the long `/.netlify/functions/...` path. Don't remove it.
4. **Deploy.** You'll get a URL like `random-name-12345.netlify.app`. Rename it under **Site configuration → Change site name** to something clean (e.g. `cabin-welcome-screen`).
5. Your live base URL is now `https://YOUR-SITE.netlify.app`. A cabin loads at `https://YOUR-SITE.netlify.app/?cabin=KEY`.

> **Netlify gotcha (memorize this):** When you push a change and it *doesn't* seem to take effect, it's almost always Netlify's cache, not your code. Fix: **Deploys → Trigger deploy → Clear cache and deploy site.** This has burned us before — try it before assuming the code is wrong.

---

## Part 3 — The cabin config (`config.js`)

This is the file you'll touch most. Each cabin needs an entry in the `CABINS` object:

```js
const CABINS = {
  yourkey: { name: 'Display Name', lat: 44.4508, lon: -111.4169,
             wifi: 'NetworkName', pw: 'WiFiPassword',
             checkout: '10:00 AM', wifiSet: true },
  // ...one line per cabin
};
```

- **key** — lowercase, no spaces (e.g. `huckleberry`, `big-chalet`). This is the `?cabin=` value.
- **lat / lon** — the cabin's *real* coordinates (drive-time math depends on this). Get them by searching the street address; don't use approximate town-center values.
- **wifi / pw** — shown on the WiFi slide and turned into a scannable "connect" QR code.
- **wifiSet** — set `true` once real WiFi is in; `false` shows a placeholder.

There are also theme blocks (colors + logo per cabin), an `ACTIVITIES` list, restaurants, `CABIN_TRASH` (pickup days), and `CABIN_CLEANING` checklists in the same file. Match the structure of an existing entry when adding a new one.

---

## Part 4 — Integrations (optional, add as needed)

These live as Netlify **environment variables** (Site configuration → Environment variables) and power the serverless functions. None are required for the basic slideshow — add them when you want that feature.

**For the full step-by-step on getting each credential (where to click in OwnerRez, the JotForm webhook, the SmartThings/lock keys, and the exact variable names), see [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md).** The table below is just the overview.

| Feature | Function | What it needs |
|---|---|---|
| Guest name / departure / pets | `guest.js` | OwnerRez API credentials |
| Celebration messages | `celebration.js` | A JotForm form whose webhook POSTs to `/api/celebration` |
| Live door codes | `lockcode.js` | SmartThings + OwnerRez — **see [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md)** (it's a whole guide) |

**Celebration feature wiring (high level):** build a JotForm with cabin + occasion + guest name + message fields → set its webhook to `https://YOUR-SITE.netlify.app/api/celebration` → the function parses the submission (read the `pretty` field, *not* the auto-generated `q2_...` field names) and stores it in Netlify Blobs → the TV polls and shows the celebration slide, auto-expiring at the guest's departure.

> **Blobs + classic functions gotcha:** the functions use the Lambda-compatible handler style, which does **not** auto-configure Netlify Blobs. They call `connectLambda(event)` first (with an env-var fallback). If Blobs reads/writes mysteriously fail on a fresh site, that's the thing to check.

---

## Part 5 — Set up the displays

The web app is done after Part 2. Everything from here is about getting a screen in each cabin to boot straight into it.

See **`DISPLAY_OPTIONS.md`** for the full comparison and step-by-step for each path:
- **Raspberry Pi → TV** (the default; what most cabins use)
- **Raspberry Pi → monitor** (identical setup — a monitor is just a smaller HDMI display)
- **iPad** (no Pi; good for a small entry-table display)

The Pi setup itself (cabin assignment, `kiosk-start.sh` with the HDMI audio fix, autostart, prompt-suppression flags) is fully written up in **[README.md](README.md) → "Setup steps for each Pi."** Don't duplicate it — that's the canonical copy.

---

## Quick reference

| Thing | Where |
|---|---|
| Add/edit a cabin | `config.js` → `CABINS` |
| Change activities / restaurants | `config.js` |
| Trash days / cleaning lists | `config.js` → `CABIN_TRASH` / `CABIN_CLEANING` |
| Slide order / per-cabin slides | `index.html` + `admin.html` |
| A change isn't showing up | Netlify → Clear cache and deploy |
| Set up a cabin's screen | [README.md](README.md) (Pi) / [DISPLAY_OPTIONS.md](DISPLAY_OPTIONS.md) (which device) |
| Get API keys / set up integrations | [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md) |
| Door locks | [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md) |
| Onboard another property manager | [NEW_CLIENT_SETUP.md](NEW_CLIENT_SETUP.md) |
