# Cabin Welcome Screen

A digital welcome screen for short-term rentals — rotates through cabin info, live weather, activity recommendations, local favorites, holiday-themed slides, and (optionally) a live door code for the current guest. Each cabin shows its own WiFi password, local conditions, drive times, and check-out info.

One repo, one URL per cabin, edit once → updates everywhere.

---

## What's in this folder

- **`index.html`** — the slideshow itself. Don't edit unless changing the design.
- **`config.js`** — your cabins, activities, restaurants, holidays, and quotes. **This is where you make edits.**
- **`netlify/functions/`** — optional backend: live guest info, weather alerts, and door-code automation. Only used if you deploy to Netlify (see "Deployment" below).
- **`LOCK_SYNC_SETUP.md`** — separate setup guide for the door-code automation (SmartThings + OwnerRez). Only relevant if you want guests' codes auto-pushed to physical Schlage locks.
- **`README.md`** — this file.

---

## Quick test on your computer first

Before deploying anywhere, double-click `index.html`. It opens in your browser and defaults to one cabin. Wait a few seconds for weather to load, watch the slides cycle. If the layout looks right, move on to deployment.

---

## Deployment — pick a platform

| Platform | Cost | Live guest info? | Door code slide? | Best for |
|---|---|---|---|---|
| **GitHub Pages** | Free | ❌ (static only) | ❌ | Simplest possible setup; no backend features |
| **Netlify** | Free tier | ✅ | ✅ | Recommended if you have OwnerRez or want any backend feature |

Netlify costs nothing for our use (well under all free-tier limits) and gives you everything. **If you're not sure, pick Netlify.**

### GitHub Pages deployment

1. Create a public GitHub repo and upload these files
2. **Settings → Pages** → Source: Deploy from a branch, Branch: `main` / root → Save
3. Wait 1–3 min; URL appears: `https://YOURUSERNAME.github.io/REPO-NAME/`
4. Test: `https://YOURUSERNAME.github.io/REPO-NAME/?cabin=YOUR-CABIN-KEY`

### Netlify deployment

1. Push these files to a GitHub repo (private OK on Netlify)
2. Log in to https://app.netlify.com → **Add new project → Import from GitHub** → pick your repo
3. Leave build settings at defaults (no build command, publish dir = `/`)
4. Deploy. Your site URL appears: `https://YOUR-SITE.netlify.app/`
5. Test: `https://YOUR-SITE.netlify.app/?cabin=YOUR-CABIN-KEY`
6. (If you want the door-code slide later) Set up the backend per `LOCK_SYNC_SETUP.md`

---

## Adding a new cabin

You'll do this whenever you take on a new property. ~10 minutes per cabin.

### Step 1 — Pick a short cabin key

A lowercase, hyphenated identifier you'll use in the URL. Examples: `huckleberry`, `little-chalet`, `caldera`. Keep it short — it goes in the URL the cabin's display loads.

### Step 2 — Add the cabin to `config.js`

Open `config.js`. There are several per-cabin sections; add an entry to each one for the new cabin using its key. The key sections to update:

**`THEMES`** — color palette and logo for the cabin:
```javascript
'your-key': {
  bg1: '#hexcolor1',
  bg2: '#hexcolor2',
  accent: '#hexcolor3',
  // ... copy structure from an existing cabin
  logoUrl: 'your-cabin-logo.png',
},
```

**`CABINS`** — name, location, WiFi, checkout time:
```javascript
'your-key': {
  name: 'Your Cabin Name',
  lat: 44.4200,         // for weather
  lon: -111.3800,
  wifi: 'WiFi-Network-Name',
  pw: 'WiFiPassword',
  checkout: '10:00 AM',
  wifiSet: true
},
```

**`CABIN_CLEANING`** (if you use the cleaner-task slide):
```javascript
'your-key': {
  name: 'Your Cabin Name',
  notes: ['Anything cabin-specific the cleaner should know']
},
```

**`CABIN_TRASH`** (if you use the trash-day slide):
```javascript
'your-key': {
  days: ['Wednesday'],  // pickup day(s)
  cans: 2,
  notes: 'Standard pickup notes'
},
```

### Step 3 — Add the cabin's logo (if it has one)

Drop the logo image (PNG, transparent background preferred) into the repo root. Reference its filename in the cabin's `THEMES` entry (`logoUrl: 'your-cabin-logo.png'`).

### Step 4 — Push and verify

1. Commit the changes (browser editor commit or `git push` if local)
2. Wait for the deploy to publish (~2 min on Netlify, 1–3 min on GitHub Pages)
3. Test the new URL: `https://<your-site-base>/?cabin=your-key`
4. Confirm weather loads, logo shows, WiFi info is right

### Step 5 — Point that cabin's display at the new URL

See "Setting up displays" below. The only thing different per cabin is the `?cabin=` in the URL.

### Step 6 (optional) — If you use door-code auto-sync

1. Add the new property's OwnerRez property ID to `PROPERTY_IDS` in `netlify/functions/_ownerrez.js`
2. Add the cabin key + SmartThings locationId + lock device UUIDs to `SMARTTHINGS_DEVICES` in Netlify env vars (see `LOCK_SYNC_SETUP.md`)
3. Install the SmartThings SmartApp in that cabin's Location
4. Redeploy

---

## Setting this up for someone else (white-label / clients)

If you want to give this whole system to a friend running their own rentals, two options:

### Option A — They fork your repo

1. They go to your repo on GitHub → **Fork** to their own account
2. They edit `config.js` with their own cabins
3. They deploy their fork (GitHub Pages or Netlify) — separate URL from yours
4. They keep maintaining their own copy

**Pro**: clean separation, they can pull future improvements you push.
**Con**: each person manages their own deploy.

### Option B — You host, they pay for a custom-branded version

1. You maintain a copy of the repo per client (separate Netlify project per client)
2. Each client's `config.js` is their cabins
3. Their domain (or Netlify subdomain) points at their deploy
4. You charge them a monthly fee for hosting + updates

**Pro**: you make money; they get hassle-free updates.
**Con**: more work for you; you need to manage multiple deploys.

### Option C (advanced) — Multi-tenant deploy

1. One deploy serves multiple clients
2. URL pattern: `https://welcome.example.com/?client=acme&cabin=cabin-1`
3. Refactor `config.js` into a per-client config file loaded by query param
4. Higher upfront engineering work but lower ongoing cost

For now, Option A is the simplest hand-off. Option B is the obvious business model.

---

## Setting up displays

You don't need a Raspberry Pi. Anything that can keep a web page open in full-screen works. Hardware is getting expensive; here are options ranked roughly by total cost:

### Software-only / use-what-you-have

| Option | Best for | Cost | Setup | Notes |
|---|---|---|---|---|
| **Smart TV with browser** (LG, Samsung, Vizio, etc.) | Cabins already with a smart TV | $0 | Open TV's built-in browser → enter the URL → make it full-screen. Reload manually. | Sometimes the browser is buried in "Apps." Some smart TVs (Roku, older Samsungs) have no real browser — won't work. |
| **Existing tablet / iPad in a wall mount** | You already own one or can buy cheap used | $0–$100 | **iPad**: open Safari → URL → tap Share → "Add to Home Screen" → launch it from home screen for full-screen kiosk feel. Use **Guided Access** (Settings → Accessibility → Guided Access) to lock guests out of switching apps.<br>**Android**: install **Fully Kiosk Browser** (free) → enter URL → enable kiosk mode. | Best balance of price + reliability. iPad 5th-9th gen used = $80–150. Always-on with brightness dimmed. |
| **Chromecast with Google TV / Fire TV Stick** + an old TV | Cabin has a dumb TV with HDMI | $30–50 | Side-load a kiosk browser (Fire TV: Silk Browser; Google TV: any Android browser) → load the URL → enable full-screen | Cheaper than a Pi; less flexible. Restart after every power outage. |

### Dedicated computers (more setup, more reliable always-on)

| Option | Best for | Cost | Setup | Notes |
|---|---|---|---|---|
| **Used Chromebook** | Want reliable kiosk with no fuss | $80–150 | Chrome OS has a built-in single-app kiosk mode. Configure once → boots straight to the URL. | Often the sweet spot. Ignore the small screen — close the lid, use HDMI to TV. |
| **Raspberry Pi 4 / 5** | DIY tinkerers, want full control | $90–150 (kit) | See "Raspberry Pi setup" below. | Original recommendation but expensive now compared to alternatives. |
| **Used Intel NUC / mini PC** | Want a small box at each cabin running full Windows or Linux | $80–200 | Install OS → set Chrome to autostart in kiosk mode → done | More powerful than needed; reliable. |
| **Old laptop / desktop you already own** | Free hardware sitting around | $0 | Install lightweight Linux (e.g., Linux Mint) → set up Chrome kiosk autostart | Power-hungry, big, ugly — but free. |

### Quick recommendation by scenario

- **Want simplest possible, have any smart TV**: just use the TV's browser, manually refresh after edits. Free.
- **Want reliable always-on with a small budget**: used iPad/tablet wall-mounted. ~$80–150.
- **Want it to "just work" forever**: used Chromebook in kiosk mode behind the TV. ~$80–150.
- **Want a dedicated tiny device behind every TV**: Raspberry Pi if you like Linux, mini PC otherwise. ~$90–200.

### Raspberry Pi setup (legacy / still works)

If you go the Pi route:

#### Hardware needed (per cabin)
- Raspberry Pi 4 (4GB+) — CanaKit or Vilros starter kit, ~$90
- Micro-HDMI to HDMI cable (in most kits)
- Real 5V/3A USB-C power supply (NOT a phone charger — Pis are picky)
- The TV's HDMI input

#### Setup steps for each Pi
1. **Flash the SD card** with Raspberry Pi OS (or use the kit's preloaded card)
2. **Boot the Pi**, connect WiFi, finish initial setup
3. **Make the Pi launch the browser in kiosk mode on boot.** Terminal:
   ```bash
   mkdir -p ~/.config/autostart
   nano ~/.config/autostart/welcome-screen.desktop
   ```
   Paste in (replace the URL with this cabin's URL):
   ```
   [Desktop Entry]
   Type=Application
   Name=Welcome Screen
   Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars https://YOUR-SITE/?cabin=YOUR-CABIN-KEY
   ```
   Save (Ctrl+O, Enter, Ctrl+X) and reboot.

4. **Plug Pi into the TV** → set TV to that HDMI input → done.

#### Stop the screen from blanking
```bash
sudo nano /etc/lightdm/lightdm.conf
```
Find the `[Seat:*]` section, add:
```
xserver-command=X -s 0 -dpms
```
Reboot.

#### Auto-reload nightly (so config edits show up without manual refresh)
```bash
crontab -e
```
Add:
```
0 4 * * * /usr/bin/xdotool key F5
```
Install xdotool if needed: `sudo apt install xdotool`

### iPad-as-always-on-display setup (recommended modern path)

1. Open Safari → load `https://YOUR-SITE/?cabin=YOUR-CABIN-KEY`
2. Tap **Share → Add to Home Screen** → name it "Welcome Screen"
3. Launch the home-screen icon — opens full-screen, no browser chrome
4. **Settings → Display & Brightness → Auto-Lock → Never** (so it stays on)
5. **Settings → Accessibility → Guided Access** → turn ON → set a passcode
6. With the welcome screen open, triple-click the home button (or side button on Face ID models) → tap **Guided Access → Start**. Now the iPad is locked to the welcome screen until you triple-click again + enter the passcode.
7. Wall-mount it somewhere visible to guests (Amazon has cheap iPad wall mounts ~$15).
8. Plug it in permanently — iPads handle 24/7 power-on fine.

**Caveat — display burn-in**: iPads (LCD) handle always-on fine; older OLED iPads can develop image retention. Most welcome-screen content rotates enough to avoid this.

### Android-tablet setup (cheapest "real" device path)

1. Buy a $70–100 Android tablet (Lenovo Tab M-series, Samsung Tab A, Amazon Fire HD 10)
2. Install **Fully Kiosk Browser** from Play Store (free for personal use)
3. In Fully Kiosk: paste URL → enable kiosk mode → set startup URL → auto-launch on boot
4. Wall-mount, leave plugged in

Fire HD 10 specifically: install Fully Kiosk via sideload (Amazon's app store doesn't have it).

---

## Making edits day-to-day

The big payoff: edit once, all displays update.

### Browser-only workflow (no command line)

1. Go to your repo on github.com
2. Click `config.js` → pencil icon (top right) to edit
3. Make your change — add a restaurant, fix a typo, swap a quote
4. Scroll down, write a quick commit message ("added new fishing spot")
5. Click **Commit changes**
6. Wait 1–3 min for the deploy. Displays pick it up on next refresh.

### Forcing displays to refresh immediately

Browsers cache pages. To force-refresh now:
- **iPad / Safari**: pull down from top to reload
- **Android / Fully Kiosk**: built-in "Reload" button or restart the kiosk
- **Pi / Chromium**: SSH in, run `xdotool key F5`, or just unplug + replug
- **Smart TV browser**: press the TV's refresh button or close + reopen the browser

If you want auto-refresh on a schedule, see the cron entry in the Pi section — most kiosk browsers (Fully Kiosk, Chromebook) have a built-in "reload every N minutes" setting.

---

## Editing `config.js` reference

### Adding a new restaurant

Find the `RESTAURANTS` array. Copy an existing block, change the values:

```javascript
{ name: "New Spot Name",
  subtype: "Type · Location",
  closedDays: [],
  blurb: "What makes it good.",
  fav: true },
```

Day numbers for `closedDays`: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat. Comma at the end if it's not the last entry.

### Adding a new activity

Same idea, in the `ACTIVITIES` array. Required fields: `name`, `category`, `lat`, `lon`, `seasons`, `blurb`. Optional: `distance`, `elevation`, `difficulty`, `minTemp`, `weatherSafe`, `fav`.

### Marking something a favorite

Add `fav: true` to any entry. Favorites get 2x weight in the daily rotation.

### Removing an activity

Delete the entire `{ ... }` block including the trailing comma.

### Changing slide duration

In `index.html`, find:
```javascript
setInterval(next, 8000);
```
Change `8000` to whatever you want in milliseconds.

---

## Optional: door-code automation

If you have Schlage locks on SmartThings and want guests' codes to rotate automatically (and optionally show on the welcome-screen TV), see the separate setup guide:

**→ [LOCK_SYNC_SETUP.md](./LOCK_SYNC_SETUP.md)**

It covers SmartThings SmartApp registration, OwnerRez door-lock integration, env-var configuration, per-Location install for OAuth tokens, and the dual-template email strategy for auto-sync vs manual-lock cabins.

Lock-sync requires the **Netlify deployment path** above (it uses the backend functions). GitHub Pages can't run the scheduled sync.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Weather shows "unavailable" | No internet at the cabin. Check WiFi. |
| Wrong cabin showing | Check `?cabin=` in the URL matches a key in `config.js` |
| Pi reboots randomly | Get a real 5V/3A power supply, not a phone charger |
| Screen goes black after 10 min | See "Stop the screen from blanking" in the Pi section, or set auto-lock to Never on iPad |
| Edit not appearing on displays | Wait a few min (browser cache), or force-refresh |
| iPad goes to lock screen | Settings → Display & Brightness → Auto-Lock → Never |
| Guests interfering with the iPad | Use Guided Access to lock to the welcome-screen app |
| URL shows "page not found" | Double-check the URL — case-sensitive on GitHub Pages, `?cabin=` exactly matches your key |
| Door code slide doesn't appear | See LOCK_SYNC_SETUP.md troubleshooting |

---

## What you have once it's deployed

- Live weather pulled per-cabin from Open-Meteo (free, no API key)
- Activity rotation that respects season, weather, and local favorites
- Restaurant rotation that hides closed days
- Drive times from each cabin's coordinates
- Alert pills: snow forecast, freeze warning, fire danger, stargazing nights
- Holiday-themed accent slides on the right dates
- (Netlify only) Live guest greeting from OwnerRez
- (Netlify only, optional) Auto-rotating door code matching the physical Schlage keypad
- One repo, N cabins, edit once → deploy everywhere
