// =========================================================================
// CABIN WELCOME SCREEN — CONFIGURATION
// Edit this file to update cabin info, activities, restaurants, and quotes.
// =========================================================================

// -------------------------------------------------------------------------
// WHICH CABIN IS THIS DISPLAY FOR?
//
// HOSTED VERSION (recommended): The cabin is set by the URL parameter.
//   Example: yoursite.com/?cabin=huckleberry  → loads Huckleberry Hut
//   Each Pi just opens its own URL — no per-cabin config needed.
//
// LOCAL FILE VERSION (fallback): If you're opening index.html directly
//   from your computer with no URL parameter, the page uses ACTIVE_CABIN.
// -------------------------------------------------------------------------
const ACTIVE_CABIN = 'huckleberry';

// -------------------------------------------------------------------------
// PER-CABIN THEMES
// Each cabin can have its own color palette and logo.
// When you get logos for the other cabins, add them here.
//
// Fields:
//   bg          - main background color
//   accent      - primary accent (headers, labels, dots)
//   accent2     - secondary accent (live dot, fav tags)
//   text        - main text color
//   subtext     - body text / description color
//   muted       - labels, key text
//   border      - divider lines
//   logoUrl     - cabin logo shown on welcome slide (or null for text-only)
//   logoStyle   - CSS to apply to the logo image (size/positioning)
// -------------------------------------------------------------------------
const THEMES = {
  huckleberry: {
    bg: '#1a1729',
    accent: '#d4537e',
    accent2: '#97c459',
    text: '#f0e8f0',
    subtext: '#c4b8c8',
    muted: '#8a7a92',
    border: 'rgba(212,83,126,0.2)',
    logoUrl: 'huckleberry-logo-dark-bg.png',
    logoStyle: 'max-width: 70%; max-height: 65%;'
  },
  gathering: {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  'little-chalet': {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  'big-chalet': {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  caldera: {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  dshouse: {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  rrl: {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  },
  charming: {
    bg: '#1a2329',
    accent: '#c9a876',
    accent2: '#5cb874',
    text: '#f5f0e6',
    subtext: '#d4cdbe',
    muted: '#8a8275',
    border: 'rgba(201,168,118,0.2)',
    logoUrl: null,
    logoStyle: ''
  }
};

// -------------------------------------------------------------------------
// CABIN CONFIGS
// -------------------------------------------------------------------------
const CABINS = {
  huckleberry: {
    name: 'Huckleberry Hut',
    lat: 44.4167, lon: -111.3833,
    wifi: 'Huckleberry Hut',
    pw: 'Yellowst0neTrout!',
    checkout: '11:00 AM',
    wifiSet: true
  },
  gathering: {
    name: 'Gathering Place',
    lat: 44.4250, lon: -111.3700,
    wifi: 'The Gathering Place',
    pw: 'Cascade4139',
    checkout: '11:00 AM',
    wifiSet: true
  },
  'little-chalet': {
    name: 'Little Chalet',
    lat: 44.4300, lon: -111.4000,
    wifi: 'LittleChalet',
    pw: 'Chalet42652',
    checkout: '11:00 AM',
    wifiSet: true
  },
  'big-chalet': {
    name: 'Big Chalet',
    lat: 44.4310, lon: -111.4010,
    wifi: 'BigChaletintheforest',
    pw: 'Chalet4265',
    checkout: '11:00 AM',
    wifiSet: true
  },
  caldera: {
    name: 'Caldera Cottage',
    lat: 44.4100, lon: -111.3900,
    wifi: 'Caldera Cottage',
    pw: 'Lodgepole3795',
    checkout: '10:00 AM',
    wifiSet: true
  },
  dshouse: {
    name: "D'Shouse Haven",
    lat: 44.4200, lon: -111.3750,
    wifi: '[Add network]',
    pw: '[Add password]',
    checkout: '11:00 AM',
    wifiSet: false
  },
  rrl: {
    name: 'RRL Sleeps 14',
    lat: 44.4180, lon: -111.3820,
    wifi: '[Add network]',
    pw: '[Add password]',
    checkout: '11:00 AM',
    wifiSet: false
  },
  charming: {
    name: 'Charming Log Home',
    lat: 44.4350, lon: -111.3650,
    wifi: '[Add network]',
    pw: '[Add password]',
    checkout: '11:00 AM',
    wifiSet: false
  }
};

// -------------------------------------------------------------------------
// HOST CONTACT INFO
// -------------------------------------------------------------------------
const CONTACT = {
  hostName: 'Teara',
  hostPhone: '(208) 558-0100',  // <- update with your real number
  souvenirSite: 'ipsouvenirsandgifts.com',
  emergency: '911',
  hospital: 'Madison Memorial · Rexburg'
};

// -------------------------------------------------------------------------
// ACTIVITIES
// -------------------------------------------------------------------------
const ACTIVITIES = [
  { name: "Imperial Geyser", category: "Today's hike",
    lat: 44.524, lon: -110.851,
    distance: "5.6 mi", elevation: "mostly flat", difficulty: "Easy",
    seasons: ["summer","fall"], minTemp: 40, weatherSafe: true,
    blurb: "Best hike in Yellowstone. Mostly flat walk past Fairy Falls to a working geyser most tourists miss.",
    fav: true },

  { name: "Wade Lake & Cliff Lake", category: "Today's adventure",
    lat: 44.840, lon: -111.585,
    distance: "varies", elevation: "flat", difficulty: "Easy",
    seasons: ["summer","fall"], minTemp: 50, weatherSafe: true,
    blurb: "Two teal-blue lakes side by side. No motorized boats — paddle, kayak, or float in peace.",
    fav: true },

  { name: "High Mountain Adventures", category: "Today's adventure",
    lat: 44.547, lon: -111.450,
    distance: "—", elevation: "—", difficulty: "Varies",
    seasons: ["spring","summer","fall","winter"],
    blurb: "ATV, UTV, snowmobile rentals at base of Sawtelle. Hours vary by season — call ahead: (208) 558-9572.",
    fav: true },

  { name: "Upper Mesa Falls", category: "Today's hike",
    lat: 44.184, lon: -111.32,
    distance: "0.6 mi", elevation: "minimal", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 35, weatherSafe: true,
    blurb: "Boardwalk to Idaho's last undammed waterfall. Stunning even in light rain." },

  { name: "Big Springs Trail", category: "Today's walk",
    lat: 44.500, lon: -111.262,
    distance: "0.5 mi", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 35, weatherSafe: true,
    blurb: "Source of the Henry's Fork. 120 million gallons a day, paved path, trout in the pools." },

  { name: "Coffee Pot Rapids Trail", category: "Today's hike",
    lat: 44.502, lon: -111.345,
    distance: "2.2 mi", elevation: "75 ft", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 35, weatherSafe: true,
    blurb: "Follow the Henry's Fork from quiet stream to roaring rapids. Shaded — great in heat." },

  { name: "Harriman Ranch Loop", category: "Today's walk",
    lat: 44.355, lon: -111.479,
    distance: "2.5 mi", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 30, weatherSafe: true,
    blurb: "Trumpeter swans, working ranch buildings, world-class fly water. $7 entry." },

  { name: "Henry's Lake State Park", category: "Today's fishing",
    lat: 44.620, lon: -111.401,
    distance: "varies", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 40, weatherSafe: true,
    blurb: "Brook, cutthroat, and rainbow-cutthroat hybrids. Boating and kayaking too." },

  { name: "Targhee Creek Trail", category: "Today's challenge",
    lat: 44.660, lon: -111.348,
    distance: "8 mi", elevation: "2200 ft", difficulty: "Strenuous",
    seasons: ["summer"], minTemp: 50, weatherSafe: false,
    blurb: "Climbs to the Continental Divide at 9000 ft. Bear country — carry spray, make noise." },

  { name: "Sawtell Peak Drive", category: "Today's scenic drive",
    lat: 44.547, lon: -111.450,
    distance: "12 mi drive", elevation: "9875 ft summit", difficulty: "Drive-up",
    seasons: ["summer","fall"], minTemp: 45, weatherSafe: false,
    blurb: "Drive to a 9875 ft summit. Caldera, Yellowstone, and Henry's Lake all in view. Closed Nov–May." },

  { name: "Yellowstone Shortline Trail", category: "Today's ride",
    lat: 44.218, lon: -111.444,
    distance: "8.5 mi paved", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 40, weatherSafe: true,
    blurb: "Smooth asphalt rail-trail. Family-friendly. Bring bikes or rent in town." },

  { name: "Big Springs Float", category: "Today's float",
    lat: 44.500, lon: -111.262,
    distance: "3 hr float", elevation: "flat", difficulty: "Easy",
    seasons: ["summer"], minTemp: 55, weatherSafe: true,
    blurb: "Crystal-clear, slow-moving water from Big Springs to Mack's Inn. Moose sightings common." },

  { name: "Two Top Snowmobile Trail", category: "Today's ride",
    lat: 44.620, lon: -111.150,
    distance: "30+ mi loop", elevation: "varies", difficulty: "Moderate",
    seasons: ["winter"], minTemp: -20, weatherSafe: true,
    blurb: "Connects Island Park to West Yellowstone. Part of 1500+ miles of groomed trail." },

  { name: "Harriman Snowshoe — River Ranch Loop", category: "Today's snowshoe",
    lat: 44.355, lon: -111.479,
    distance: "2.5 mi", elevation: "flat", difficulty: "Easy",
    seasons: ["winter"], minTemp: -10, weatherSafe: true,
    blurb: "Beginner-friendly snowshoe loop. Warm up at the Jones House along the way." },

  { name: "Old Faithful", category: "Today's Yellowstone",
    lat: 44.460, lon: -110.828,
    distance: "1 mi loop", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 30, weatherSafe: true,
    blurb: "Erupts roughly every 90 minutes. West entrance via 20 then south through the park." },

  { name: "Grand Prismatic Spring", category: "Today's Yellowstone",
    lat: 44.525, lon: -110.838,
    distance: "1.6 mi", elevation: "100 ft", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 30, weatherSafe: true,
    blurb: "Yellowstone's most photographed spring. The overlook trail beats the boardwalk for views." },

  { name: "Lamar Valley", category: "Today's wildlife drive",
    lat: 44.898, lon: -110.219,
    distance: "drive", elevation: "varies", difficulty: "Drive-up",
    seasons: ["spring","summer","fall"], minTemp: 25, weatherSafe: true,
    blurb: "America's Serengeti — bison, wolves, bears, eagles. Best at dawn or dusk." },

  { name: "Cave Falls", category: "Today's hidden gem",
    lat: 44.140, lon: -111.013,
    distance: "0.3 mi", elevation: "flat", difficulty: "Easy",
    seasons: ["summer","fall"], minTemp: 40, weatherSafe: true,
    blurb: "Hidden waterfall in Yellowstone's quiet southwest corner. Locals' secret." },

  { name: "Jenny Lake (Tetons)", category: "Today's Teton trip",
    lat: 43.752, lon: -110.725,
    distance: "varies", elevation: "flat", difficulty: "Easy",
    seasons: ["spring","summer","fall"], minTemp: 35, weatherSafe: true,
    blurb: "Boat shuttle to Hidden Falls and Inspiration Point. Iconic Teton experience." }
];

// -------------------------------------------------------------------------
// RESTAURANTS
// closedDays: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// -------------------------------------------------------------------------
const RESTAURANTS = [
  { name: "Café Sabor",
    subtype: "Mexican · Island Park, Hwy 20",
    closedDays: [2],
    blurb: "Worth the wait. Try the ceviche, combos, chimichangas — and the caramel churros.",
    fav: true },

  { name: "Lakeside Lodge",
    subtype: "American steaks · local Miller Ag beef",
    closedDays: [],
    blurb: "Finger steaks made with local Miller Ag beef. The Millers own Lakeside.",
    fav: true },

  { name: "Boondocks",
    subtype: "American · Hwy 20",
    closedDays: [],
    blurb: "Solid menu top to bottom. Campfire fries are the move.",
    fav: true },

  { name: "Pond's Lodge Pizza",
    subtype: "Pizza · classic Island Park spot",
    closedDays: [],
    blurb: "We love the cheese breadsticks with ranch.",
    fav: true },

  { name: "Shotgun Bar",
    subtype: "Bar + food Wed–Sun",
    closedDays: [1, 2],
    blurb: "Fun spot for beer and wine. Food served Wednesday through Sunday only.",
    fav: true }
];

// -------------------------------------------------------------------------
// QUOTES — rotated daily
// -------------------------------------------------------------------------
const QUOTES = [
  { text: "In every walk with nature, one receives far more than they seek.", attr: "John Muir" },
  { text: "The mountains are calling and I must go.", attr: "John Muir" },
  { text: "Of all the paths you take in life, make sure a few of them are dirt.", attr: "John Muir" },
  { text: "Look deep into nature, and then you will understand everything better.", attr: "Albert Einstein" },
  { text: "Wilderness is not a luxury but a necessity of the human spirit.", attr: "Edward Abbey" },
  { text: "The clearest way into the universe is through a forest wilderness.", attr: "John Muir" },
  { text: "Not all those who wander are lost.", attr: "J.R.R. Tolkien" },
  { text: "Every mountain top is within reach if you just keep climbing.", attr: "Barry Finlay" }
];
