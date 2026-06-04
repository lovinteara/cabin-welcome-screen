# Cabin Welcome Screen

A digital welcome screen for short-term rentals — rotates through cabin info, live weather, activity recommendations, local favorites, holiday-themed slides, and (optionally) a live door code for the current guest. Each cabin shows its own WiFi password, local conditions, drive times, and check-out info.

One repo, one URL per cabin, edit once → updates everywhere.

---

## What's in this folder

- **`index.html`** — the slideshow itself. Don't edit unless changing the design.
- **`config.js`** — your cabins, activities, restaurants, holidays, and quotes. **This is where you make edits.**
- **`admin.html`** — a reference dashboard. Open it in a browser to preview every slide, see each slide's duration, the cabin URLs/WiFi, and Pi status. Documentation only — editing it does NOT change what the cabins display.
- **`netlify/functions/`** — optional backend: live guest info, weather alerts, and door-code automation. Only used if you deploy to Netlify (see "Deployment" below).
- **[`LOCK_SYNC_SETUP.md`](LOCK_SYNC_SETUP.md)** — separate setup guide for the door-code automation (SmartThings + OwnerRez). Only relevant if you want guests' codes auto-pushed to physical Schlage locks.
- **`README.md`** — this file.

---

## Documentation index

This README covers day-to-day operations and the per-cabin Pi setup. For the bigger picture, these companion guides go deeper:

- **[SETUP_FROM_SCRATCH.md](SETUP_FROM_SCRATCH.md)** — build the entire system from nothing: GitHub repo, Netlify site, config, integrations, displays. Start here if you're standing it up fresh or want to understand how the pieces fit.
- **[DISPLAY_OPTIONS.md](DISPLAY_OPTIONS.md)** — TV vs. monitor vs. iPad for the in-cabin display, with the trade-offs and exact steps for each.
- **[INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md)** — how to actually get every API key/credential (OwnerRez, JotForm, SmartThings) and the exact env-var names + per-client maps to set.
- **[NEW_CLIENT_SETUP.md](NEW_CLIENT_SETUP.md)** — the repeatable playbook for running CabinCast Pro for another property manager as a separate, white-labeled instance.
- **[LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md)** — the door-lock automation deep dive.

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

If you want to give this whole system to a friend running their own rentals, three options:

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
| **Existing tablet / iPad in a wall mount** | You already own one or can buy cheap used | $0–$100 | **iPad**: open Safari → URL → tap Share → "Add to Home Screen" → launch it from home screen for full-screen kiosk feel. Use **Guided Access** (Settings → Accessibility → Guided Access) to lock guests out of switching apps.<br>**Android**: install **Fully Kiosk Browser** (free) → enter URL → enable kiosk mode. | Best balance of price + reliability. iPad 5th–9th gen used = $80–150. Always-on with brightness dimmed. |
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
3. **Install the emoji font.** Raspberry Pi OS ships without one, so without this the celebration, campfire, and other slides show emoji as empty boxes (☐). In a terminal:

   ```bash
   sudo apt update
   sudo apt install fonts-noto-color-emoji -y
   ```

   Reboot (or restart Chromium) afterward and emoji will render everywhere. **Do this on every Pi** — including any SD card you reflash.

4. **Set which cabin this Pi is for.** This one line is the only per-cabin change — everything else below is identical on every Pi. In a terminal (replace `YOUR-CABIN-KEY` with this cabin's key, e.g. `huckleberry`, `dshouse`, `rrl`, `charming`):
   ```bash
   echo "YOUR-CABIN-KEY" > ~/cabin-name.txt
   ```
   Valid keys: `huckleberry`, `gathering`, `little-chalet`, `big-chalet`, `caldera`, `dshouse`, `rrl`, `charming`

5. **Create the startup script.** This handles three things automatically: forces HDMI as the audio output (Pi OS defaults to a silent dummy sink after reboot — see Sound fix below), reads the cabin key from step 4, and launches Chromium in kiosk mode with all the prompt-suppressing flags so guests never see a permission popup. Paste this whole block:
   ```bash
   cat > ~/kiosk-start.sh << 'EOF'
   #!/bin/bash
   sleep 5
   # Force HDMI audio (Pi OS / PipeWire defaults to a dummy sink after reboot)
   HDMI_SINK=$(pactl list short sinks | grep -i hdmi | head -n1 | awk '{print $2}')
   if [ -n "$HDMI_SINK" ]; then
     pactl set-default-sink "$HDMI_SINK"
     pactl set-sink-volume "$HDMI_SINK" 100%
     pactl set-sink-mute "$HDMI_SINK" 0
   fi
   CABIN=$(cat ~/cabin-name.txt 2>/dev/null)
   chromium --kiosk --noerrdialogs --disable-infobars \
     --disable-session-crashed-bubble \
     --use-fake-ui-for-media-stream \
     --autoplay-policy=no-user-gesture-required \
     --no-first-run --disable-notifications \
     --disable-features=Translate \
     "https://YOUR-SITE/?cabin=${CABIN}"
   EOF
   chmod +x ~/kiosk-start.sh
   ```
   (Replace `YOUR-SITE` once with your real site, e.g. `cabin-welcome-screen.netlify.app`.)

   What the flags do — these auto-accept or suppress every popup a guest would otherwise see:
   - `--use-fake-ui-for-media-stream` — auto-allows camera/microphone prompts
   - `--autoplay-policy=no-user-gesture-required` — lets audio/video play without a click
   - `--disable-session-crashed-bubble` — skips the "restore pages?" bar after a power loss
   - `--no-first-run` — skips first-launch setup screens
   - `--disable-notifications` — blocks website notification permission popups
   - `--disable-features=Translate` — kills the "translate this page?" bar

6. **Make the script launch on boot.** Terminal:
   ```bash
   mkdir -p ~/.config/autostart
   cat > ~/.config/autostart/kiosk.desktop << 'EOF'
   [Desktop Entry]
   Type=Application
   Name=Kiosk
   Exec=/home/pi/kiosk-start.sh
   EOF
   ```
   (If your Pi username isn't `pi`, change the path in `Exec=` to match — run `whoami` if unsure.)

7. **Verify, then reboot.**
   ```bash
   cat ~/cabin-name.txt && echo "---" && cat ~/kiosk-start.sh
   sudo reboot
   ```
   It should boot straight into this cabin's welcome screen, with sound, and never show a prompt.

8. **Plug Pi into the TV** → set TV to that HDMI input → done.

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

In `index.html`, find the `scheduleNext()` function. The base duration is 8 seconds, with per-slide overrides below it:

```javascript
let duration = 8000;              // default — 8 seconds
if (sid === 'campfire') duration = 35000;   // 35 seconds
if (sid === 'watchtv')  duration = 18000;   // 18 seconds
// ...etc
```

To change how long a slide stays up, edit its line (milliseconds: `5000` = 5 sec, `12000` = 12 sec). To change the default for every slide that has no override, change the `let duration = 8000;` line. Each slide's current duration is listed in `admin.html`.

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
| Emoji show as empty boxes (☐) | Emoji font not installed on the Pi. Run `sudo apt install fonts-noto-color-emoji -y` then reboot |
| No sound from the TV | Pi OS (PipeWire) defaults to a silent "dummy" sink after reboot, not HDMI. The `~/kiosk-start.sh` script (Pi setup step 5) auto-fixes this on every boot by detecting the HDMI sink with `pactl list short sinks \| grep -i hdmi` and setting it as default. If a Pi was set up the old way without that script, redo steps 5–7. To test manually: `pactl list short sinks` (find the HDMI line), then `pactl set-default-sink <name>`. Note: `pactl` is built in on current Pi OS; older `pactl`-less images may need `sudo apt install pulseaudio-utils` |
| Wrong cabin showing | Check `?cabin=` in the URL matches a key in `config.js` |
| Pi reboots randomly | Get a real 5V/3A power supply, not a phone charger |
| Screen goes black after 10 min | See "Stop the screen from blanking" in the Pi section, or set auto-lock to Never on iPad |
| Edit not appearing on displays | Wait a few min (browser cache), or force-refresh |
| iPad goes to lock screen | Settings → Display & Brightness → Auto-Lock → Never |
| Guests interfering with the iPad | Use Guided Access to lock to the welcome-screen app |
| URL shows "page not found" | Double-check the URL — case-sensitive on GitHub Pages, `?cabin=` exactly matches your key |
| Door code shows a photo instead of a code | Expected between bookings — no active code means the slide shows a gallery photo. If you expect a code, check `/api/lockcode?cabin=YOUR-KEY` directly and the `OWNERREZ_*` env vars |
| Door-code or lock-sync trouble | See `LOCK_SYNC_SETUP.md` "Common gotchas" section |

---

## What you have once it's deployed

- 33 rotating slides (~6.3 min full loop) — preview them all in `admin.html`
- Live weather pulled per-cabin from Open-Meteo (free, no API key)
- Smart activity rotation that respects season, weather, and your local favorites
- Restaurant rotation that hides closed days (Café Sabor on Tuesdays, Shotgun Bar Mon/Tue); "Tell them Teara sent you!" taglines auto-highlighted
- Drive times calculated from each cabin's coordinates, plus a 4-state road conditions board (ID / YNP / WY / MT) with QR codes
- Four alert pills: snow forecast, freeze warning, fire danger, stargazing nights
- Day-aware trash slide: "Trash Day!" on pickup day, "Trash Tomorrow!" the day before, bear-can tutorial video otherwise
- Door code slide pulls the live Schlage code during a stay, shows a gallery photo between bookings (auto-sync cabins only — see `LOCK_SYNC_SETUP.md`)
- Campfire slide with rotating conversation starters, story prompts, and s'more recipes
- Watch TV slide with brand-colored streaming apps and "Input/Source → PC" return steps
- Live Yellowstone & Grand Teton park alerts (NPS API)
- (Netlify only) Live guest greeting from OwnerRez
- (Netlify only, optional) Auto-rotating door code matching the physical Schlage keypad
- One repo, N cabins, edit-once deploy-everywhere
