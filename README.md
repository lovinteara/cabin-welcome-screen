# Cabin Welcome Screen

A digital welcome screen for short-term rentals — rotates through cabin info, live weather, activity recommendations, and local picks. Each cabin shows its own WiFi, weather, drive times, and check-out info.

---

## What's in this folder

- **`index.html`** — the slideshow itself. Don't edit unless changing the design.
- **`config.js`** — your cabins, activities, restaurants, and quotes. **This is where you make edits.**
- **`README.md`** — this file.

---

## Quick test on your computer first

Before doing anything else, double-click `index.html`. It'll open in your browser and show Huckleberry Hut by default. Wait a few seconds for weather to load, watch the slides cycle. If everything looks right, move on to deployment.

---

## Recommended setup: Host on GitHub Pages

This is the path you want. One repo, eight URLs (one per cabin), edit-once-update-everywhere.

### Step 1: Create the GitHub repo

1. Go to **github.com** and click **+ → New repository**
2. Name it something like `cabin-welcome-screen`
3. Set it to **Public** (required for free GitHub Pages)
4. Skip the "Initialize with README" — you already have one
5. Click **Create repository**

### Step 2: Upload the files

Easiest way (no command line needed):

1. On your new empty repo page, click **uploading an existing file**
2. Drag `index.html`, `config.js`, and `README.md` into the upload area
3. Scroll down, type a commit message like "Initial setup"
4. Click **Commit changes**

### Step 3: Turn on GitHub Pages

1. In the repo, click **Settings** (top right)
2. In the left sidebar, click **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select **main** and folder **/ (root)**, then click **Save**
5. Wait 1–3 minutes. The page will refresh and show:
   *"Your site is live at `https://YOURUSERNAME.github.io/cabin-welcome-screen/`"*

### Step 4: Test the URLs

Open these in your browser to test each cabin (replace YOURUSERNAME with your GitHub username):

- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=huckleberry`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=gathering`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=little-chalet`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=big-chalet`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=caldera`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=dshouse`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=rrl`
- `https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=charming`

Each one should show that cabin's name, WiFi, weather for its specific coordinates, and drive times calculated from that cabin to each activity.

**Bookmark or write down each URL** — you'll need them for the Pi setup.

---

## How to make edits going forward

The big payoff of GitHub Pages: edit once, all 8 cabins update.

### Easy way (browser, no command line)

1. Go to your repo on github.com
2. Click `config.js`
3. Click the pencil icon (top right) to edit
4. Make your changes — add a restaurant, fix a typo, swap a quote, anything
5. Scroll down, write a quick commit message ("added new fishing spot")
6. Click **Commit changes**
7. Wait 1–3 minutes. All cabins update automatically the next time their pages refresh.

### To force the cabins to refresh immediately

Most browsers cache the page for ~10 minutes. To force a fresh load on a Pi, you can add a version number to the URL like `?cabin=huckleberry&v=2`. Increment the `v` number when you push major changes.

---

## Setting up the Raspberry Pis

### Hardware needed (per cabin)
- Raspberry Pi 4 (4GB) — get a CanaKit or Vilros starter kit, ~$90
- Micro-HDMI to HDMI cable (usually in the kit)
- The TV's HDMI input

### Setup steps for each Pi

1. **Flash the SD card** with Raspberry Pi OS (the kit's preloaded card works)
2. **Boot the Pi**, connect WiFi, finish initial setup
3. **Set the Pi to launch the browser in kiosk mode on boot.** Open a terminal and run:

   ```bash
   mkdir -p ~/.config/autostart
   nano ~/.config/autostart/welcome-screen.desktop
   ```

   Paste this in, **changing the URL to that cabin's specific URL**:

   ```
   [Desktop Entry]
   Type=Application
   Name=Welcome Screen
   Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars https://YOURUSERNAME.github.io/cabin-welcome-screen/?cabin=huckleberry
   ```

   For the Pi at Gathering Place, the URL would end in `?cabin=gathering`. For Caldera Cottage, `?cabin=caldera`. And so on.

   Save (Ctrl+O, Enter, Ctrl+X) and reboot.

4. **Plug Pi into the TV**, set TV to that HDMI input, and you're done.

### Disabling screen blanking on the Pi

So the TV doesn't go dark after 10 minutes:

```bash
sudo nano /etc/lightdm/lightdm.conf
```

Find the `[Seat:*]` section, add:

```
xserver-command=X -s 0 -dpms
```

Reboot.

### Auto-reload the page nightly (optional, recommended)

This forces a fresh load of your latest config every morning at 4 AM, so you don't have to manually refresh anything after pushing edits:

```bash
crontab -e
```

Add this line:

```
0 4 * * * /usr/bin/xdotool key F5
```

You may need to install xdotool first: `sudo apt install xdotool`

---

## Editing the config

Open `config.js`. Each section has comments showing how to add or remove entries.

### Adding a new restaurant

Find the `RESTAURANTS` array. Copy an existing block, change the values:

```javascript
{ name: "New Spot Name",
  subtype: "Type · Location",
  closedDays: [],
  blurb: "What makes it good.",
  fav: true },
```

Day numbers for `closedDays`: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat. Don't forget the comma at the end if it's not the last entry.

### Adding a new activity

Same idea, in the `ACTIVITIES` array. Required fields: `name`, `category`, `lat`, `lon`, `seasons`, `blurb`. Optional: `distance`, `elevation`, `difficulty`, `minTemp`, `weatherSafe`, `fav`.

### Marking something a favorite

Add `fav: true` to any entry. Favorites get 2x weight in the daily rotation.

### Removing an activity

Delete the entire `{ ... }` block including the trailing comma.

### Changing slide duration

In `index.html`, find this line near the top of the script:

```javascript
setInterval(next, 8000);
```

Change `8000` to whatever you want in milliseconds. `5000` = 5 seconds. `12000` = 12 seconds.

---

## Automatic door locks (Schlage via SmartThings)

The welcome screen can show each guest their 4-digit door code, and the
backend can push that code straight to the cabin's Schlage lock on a daily
schedule — no manual code rotation between guests.

### How it works

1. A scheduled Netlify function (`lockcode-sync`) runs once a day at 11 AM
   Mountain (after the 10 AM checkout window).
2. For each cabin you've configured, it asks OwnerRez who's currently
   booked, derives a 4-digit code from the booking, and calls the
   SmartThings API to set that code in slot 1 of the lock.
3. Between bookings (no guest in the cabin), it clears slot 1 so the
   previous code stops working.
4. The welcome screen's "Door Code" slide hits `/api/lockcode?cabin=…`
   live, so the guest always sees the current active code.

### Code derivation order

For each booking the function picks the first option that succeeds:

1. A booking field named `door_code` (manual override per booking in
   OwnerRez)
2. The last 4 digits of the guest's phone number
3. The arrival date as MMDD (e.g. May 17 → `0517`)

### What you need

- **Schlage Z-Wave or Zigbee lock** paired to a SmartThings hub
  (Connect, BE469, BE499, etc.). The all-WiFi Schlage Encode has no
  public API, so it has to be on SmartThings for this to work.
- **A SmartThings Personal Access Token** with the `r:devices:*` and
  `x:devices:*` scopes. Generate one at
  https://account.smartthings.com/tokens.
- **Each lock's `deviceId`** — find it by calling
  `GET https://api.smartthings.com/v1/devices` with your token and
  looking for the lock entries. Copy the `deviceId` UUID for each.

### Netlify environment variables to set

In **Site settings → Environment variables** add:

| Variable | Value |
|---|---|
| `OWNERREZ_API_USER` | Your OwnerRez API username (already set if guest names work) |
| `OWNERREZ_API_KEY`  | Your OwnerRez API key (already set if guest names work) |
| `SMARTTHINGS_TOKEN` | The Personal Access Token from the step above |
| `SMARTTHINGS_DEVICES` | A JSON map of cabin → deviceId, see below |

Example `SMARTTHINGS_DEVICES` value:

```json
{"huckleberry":"abc-123-uuid","gathering":"def-456-uuid","caldera":"ghi-789-uuid"}
```

Only cabins listed here get synced — roll out one lock at a time by
adding them gradually.

### Testing the sync manually

After deploying, you can trigger the sync without waiting for the daily
cron. From the Netlify dashboard go to **Functions → lockcode-sync →
Trigger**, or hit it via the URL:

```
https://your-site.netlify.app/.netlify/functions/lockcode-sync
```

The response includes per-cabin status (`set` / `no-guest, slot cleared`
/ `error`). Check Netlify function logs for details.

### Limitations / gotchas

- The cron runs in UTC, so the 17:00 UTC schedule lands at 11 AM
  Mountain in winter and 10 AM Mountain in summer (DST). Both are after
  checkout — fine for our use.
- Only slot 1 is used. If you also program codes manually for cleaners
  or yourself, put them in slots 2+ so the sync doesn't overwrite them.
- The screen's "Door Code" slide only shows when there's an active
  booking. Between guests the slide is hidden entirely.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Weather shows "unavailable" | No internet at the cabin. Check WiFi. |
| Wrong cabin name showing | Check the `?cabin=` part of the URL is correct |
| Pi reboots randomly | Buy a real 5V/3A power supply, not a phone charger |
| Screen goes black after 10 min | See "Disabling screen blanking" above |
| Edit not appearing on cabin TVs | Wait a few minutes (browser cache) or set up nightly auto-reload |
| Pi shows "page not found" | Double-check the URL — case-sensitive on GitHub Pages |
| Door code slide doesn't appear | No active booking, or `OWNERREZ_*` env vars missing — check `/api/lockcode?cabin=huckleberry` directly |
| Lock isn't getting the new code | Check `SMARTTHINGS_TOKEN` and `SMARTTHINGS_DEVICES` are set, then trigger `lockcode-sync` manually and read its logs |
| Code on the lock doesn't match the screen | Lock has codes in higher slots overriding slot 1, or the daily sync hasn't run yet — trigger manually |

---

## Summary of what you have

- Live weather pulled per-cabin from Open-Meteo (free, no API key)
- Smart activity rotation that respects season, weather, and your local favorites
- Restaurant rotation that hides closed days (Café Sabor on Tuesdays, Shotgun Bar Mon/Tue)
- Drive times calculated from each cabin's coordinates
- Four alert pills: snow forecast, freeze warning, fire danger, stargazing nights
- One repo, eight URLs, edit-once deploy-everywhere
