# CabinCast Pro — New Client Setup (Onboarding Another Property Manager)

The repeatable playbook for standing up CabinCast Pro for **another property manager** — managed by you, on your accounts, but cleanly separated from your Visit Island Park cabins.

> **The model:** Each client = a **separate instance** — their own repo, their own Netlify site, their own URL, their own admin page, their own integrations. All under *your* GitHub and Netlify accounts, so you stay in control, but their data and their admin never touch yours. Branding is **CabinCast Pro (the system) + their business (the client)**.

---

## Why separate, not "just add their cabins"

It's tempting to drop a new client's cabins into your existing `config.js`. Don't — here's why it doesn't work for this case:

- **Admin access.** Your `admin.html` edits *every* cabin in the site. If the client logs in, they see and can change *your* cabins too. There's no per-cabin login. The only way they get their own admin without touching yours is a separate deployment.
- **Their guest data.** OwnerRez, JotForm, and door codes would mix into your env vars and your Blobs store. Separation keeps their guest info isolated from yours.
- **Branding.** You want CabinCast Pro as the system mark with *their* business branding on the screens. That's a white-label instance, not a tenant bolted onto Visit Island Park.
- **It's the product model.** This is exactly how CabinCast Pro becomes something you can sell to multiple PMs. Each sale = one more instance, set up with this playbook.

---

## The onboarding checklist

### 1. Clone the system into a new repo
- On GitHub, go to your `cabin-welcome-screen` repo → **Use this template** (if it's a template repo) **or** create a new repo and copy the files in.
- Name it for the client, e.g. `cabincast-bigskyrentals`.
- Keep it under **your** GitHub account.

### 2. Stand up a separate Netlify site
- Netlify → **Add new site → Import existing project →** pick the new client repo.
- It auto-detects `netlify.toml`. Deploy.
- Rename the site (Site configuration → Change site name) to the client, e.g. `cabincast-bigskyrentals` → live at `https://cabincast-bigskyrentals.netlify.app`.
- This is a *fully separate* Netlify site from yours: its own deploys, its own env vars, its own Blobs store.

### 3. Rebrand: CabinCast Pro + their business
- **Logos:** replace the per-cabin logo images with the client's. Keep a CabinCast Pro mark as the "powered by" / system branding (small, consistent placement).
- **`config.js`:** update `CONTACT` (their host name, phone, their website), and the theme blocks (their colors/logos).
- **Souvenir/host-specific slides:** swap out anything Visit-Island-Park-specific (your souvenir shop, your contact) for theirs — or remove if they don't have an equivalent.
- Search the codebase for hard-coded "Visit Island Park," "Teara," "ipsouvenirsandgifts.com," your phone number, etc., and replace with the client's.

### 4. Add their cabins to *their* `config.js`
- One `CABINS` entry per cabin (even if they only have one — works fine with a single cabin).
- Real coordinates per cabin (search the street address — don't approximate).
- Their WiFi networks + passwords, `wifiSet: true`.
- Their checkout times, trash days (`CABIN_TRASH`), cleaning lists (`CABIN_CLEANING`), and local activities/restaurants if they want their own curated list rather than yours.

### 5. Their integrations (only what they use)
Each is set as **environment variables on their Netlify site** (not yours). **Full credential walkthrough (where to get each key, exact variable names, the `PROPERTY_IDS` map you must update per client): [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md).**
- **OwnerRez** (guest names, departures) → `guest.js`. Their OwnerRez API creds.
- **JotForm celebrations** → build *their own* JotForm, point its webhook at `https://THEIR-SITE.netlify.app/api/celebration`. Parse the `pretty` field, same as yours.
- **Door locks** → follow [LOCK_SYNC_SETUP.md](LOCK_SYNC_SETUP.md) with *their* SmartThings + OwnerRez. Their refresh tokens live in their Blobs store.
- Skip any they don't use — the basic slideshow runs without any of these.

### 6. Their own admin access
- Their admin page is `https://THEIR-SITE.netlify.app/admin.html` — it only ever shows their cabins, because it's their separate deployment.
- Give them that URL. If `admin.html` has any access protection, set their own credentials on their site (don't reuse yours).
- They edit their content; you stay the technical owner (you hold the GitHub/Netlify accounts).

### 7. Set up their displays
- Same hardware playbook — see [DISPLAY_OPTIONS.md](DISPLAY_OPTIONS.md) and [README.md](README.md)'s Pi setup.
- The **only** difference: `kiosk-start.sh` points at **their** site:
  `https://THEIR-SITE.netlify.app/?cabin=THEIR-CABIN-KEY`
- Works for 1 cabin or many — a single-cabin client is just one Pi loading one URL.
- Pi hostname: name it for their cabin (e.g. their cabin key), so you can tell whose Pi is whose when you SSH in via Termius.

### 8. Hand-off
- Give them: their screen URL(s), their admin URL, and a short "how to post a celebration / edit content" note.
- Keep for yourself: the GitHub repo, the Netlify site, the env vars, the Pi SSH access (Termius).

---

## Keeping client instances updated

Because each client is a separate copy, improvements you make to *your* repo don't automatically flow to theirs. When you build something worth sharing (a new slide type, a bug fix):

- Make the change in your main repo first and confirm it works.
- Then port it to each client repo — either copy the changed file(s) over, or (cleaner, long-term) set up the client repos as forks/template-derived so you can merge updates.
- For now, the simplest reliable path is: prepare the changed file, commit it to each client repo the same way you commit to yours.

> If you end up with several clients, this is the point where it's worth thinking about a shared core you pull updates from, rather than hand-copying. Flag it when you get there and we'll set that up.

---

## One-client quick version (TL;DR)

1. New repo (yours) ← copy the system
2. New Netlify site ← that repo, rename it
3. Rebrand: CabinCast Pro + their logo/colors/contact
4. Their cabins in `config.js` (real coords, their WiFi)
5. Their integrations as env vars on *their* Netlify site ([INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md))
6. Their admin URL = their site's `/admin.html` (only their cabins)
7. Pi(s) point at *their* URL; name hosts after their cabins
8. Hand off screen URL + admin URL; you keep the keys
