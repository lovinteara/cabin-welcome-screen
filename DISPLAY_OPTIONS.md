# CabinCast Pro — Display Options

The welcome screen is just a web page. Anything that can open a browser full-screen and stay on can run it. This doc compares the three real-world setups and gives the exact steps for each.

> The web app doesn't care what it's displayed on. "TV" vs "monitor" is **not** a software difference — a Pi plugged into a 24" monitor is the identical setup to a Pi plugged into a 55" TV. HDMI is HDMI. The only real fork is **Pi-based** (TV or monitor) vs **iPad-based** (no Pi).

---

## Quick comparison

| | Raspberry Pi → TV | Raspberry Pi → Monitor | iPad |
|---|---|---|---|
| **Best for** | Living-room display guests already look at | Entry table, kitchen counter, smaller spaces | Small entry-table display, no Pi to manage |
| **Cost** | ~$90 Pi + existing TV | ~$90 Pi + ~$80–150 monitor | iPad you already own (or ~$300 new) |
| **Audio** | Through TV speakers (great) | Monitor speakers are often weak/none — add a small speaker if you want sound | iPad speakers (fine) |
| **Auto-start on power** | Yes (boots into kiosk) | Yes (boots into kiosk) | Yes, with Guided Access |
| **Remote management** | Yes — SSH via Termius | Yes — SSH via Termius | No real remote management |
| **Survives power outage** | Yes — boots right back | Yes — boots right back | Yes, if set up right |
| **Recommendation** | **Default.** Guests see it, sound works | Great when there's no good TV spot | Simplest if you don't want any Linux |

**Bottom line:** Pi → TV is the default. Pi → monitor is the same effort and a good fit for smaller spaces. iPad is the no-Pi option — easiest to start, least controllable later.

---

## Option 1 & 2 — Raspberry Pi (TV *or* monitor)

These are the **same procedure**. A monitor is just a smaller HDMI display. Two notes specific to monitors:

- **Sound:** many monitors have weak speakers or none. The Pi sends audio over HDMI regardless; if the monitor can't play it, plug a cheap powered speaker into the Pi's headphone jack (and adjust the audio sink — see the sound troubleshooting in [README.md](README.md)). If you don't need sound on that display, ignore it.
- **Size/orientation:** the slideshow is built for landscape. Don't rotate a monitor to portrait — the layouts assume wide.

**The full Pi build (cabin assignment, `kiosk-start.sh` with the HDMI audio fix, autostart, and the prompt-suppression flags) is in [README.md](README.md) → "Setup steps for each Pi."** That is the canonical, up-to-date procedure — follow it there rather than a copy here, so there's only ever one version to keep current.

In short, that procedure:
1. Flashes Raspberry Pi OS, connects WiFi.
2. Installs the emoji font (`fonts-noto-color-emoji`) so emoji render instead of empty boxes.
3. Writes the cabin key to `~/cabin-name.txt`.
4. Creates `~/kiosk-start.sh` — forces HDMI audio (Pi OS defaults to a silent dummy sink after reboot), then launches Chromium kiosk with flags that auto-allow camera/mic, autoplay, and suppress the crash-restore, first-run, notification, and translate prompts.
5. Points autostart at the script.
6. Reboots → boots straight into that cabin's screen, with sound, no prompts.

Plugging into a monitor instead of a TV changes **none** of those steps. Just plug the Pi's micro-HDMI into the monitor instead of the TV.

---

## Option 3 — iPad (no Pi)

Good when you want a small display on an entry table and don't want to manage a Linux box. Trade-off: you can't remotely manage it the way you can SSH into a Pi.

1. **Open the cabin URL in Safari:** `https://YOUR-SITE.netlify.app/?cabin=KEY`
2. **Add to Home Screen** (Share → Add to Home Screen). This gives a full-screen icon with no Safari address bar.
3. Open it from the home-screen icon — it now runs edge-to-edge.
4. **Stop it from sleeping:** Settings → Display & Brightness → **Auto-Lock → Never.**
5. **Lock guests out of it:** Settings → Accessibility → **Guided Access** → On. Then triple-click the side button while the screen is open to lock the iPad to just that screen. Guests can't swipe away or close it.
6. **Keep it powered:** leave it on the charger. After a power blip, it'll need a manual unlock/reopen unless it was charging and never fully died — this is the main downside vs. a Pi, which boots back on its own.

**iPad limitations to know:**
- Some features that assume a keyboard/permission auto-grant (camera/mic prompts) behave differently than the Pi's kiosk flags. For a pure display this rarely matters.
- No remote restart. If it gets stuck, someone has to physically touch it.
- Auto-allow prompts: Safari may still ask for things the Pi auto-accepts. Tap allow once; "Add to Home Screen" usually remembers.

---

## Which should you put where?

- **Main living area, guests will look at it, you want sound** → Pi → TV.
- **No good TV spot, or a smaller secondary display** → Pi → monitor (+ small speaker if sound matters).
- **Tiny footprint, entry table, you don't want another Pi to babysit** → iPad.

You can mix and match across cabins freely — the web app is identical for all of them; only the `?cabin=KEY` differs.
