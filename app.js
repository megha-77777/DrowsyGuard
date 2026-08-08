/* DrowsyGuard — on-device drowsiness detection
   All detection runs locally in the browser. No video frame is ever sent anywhere. */

(() => {
'use strict';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const cameraPlaceholder = $('cameraPlaceholder');
const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const calibrateBtn = $('calibrateBtn');
const demoBtn = $('demoBtn');
const statusLine = $('statusLine');
const scoreFill = $('scoreFill');
const scoreValue = $('scoreValue');
const earValue = $('earValue');
const marValue = $('marValue');
const perclosValue = $('perclosValue');
const alertLog = $('alertLog');
const criticalOverlay = $('criticalOverlay');
const dismissCritical = $('dismissCritical');
const calibrateModal = $('calibrateModal');
const calibFill = $('calibFill');
const calibSecs = $('calibSecs');
const nightToggle = $('nightToggle');
const installBtn = $('installBtn');
const connStrip = $('connStrip');
const contactForm = $('contactForm');
const contactName = $('contactName');
const contactPhone = $('contactPhone');
const contactList = $('contactList');
const notifyNowBtn = $('notifyNowBtn');
const findRestBtn = $('findRestBtn');
const restList = $('restList');
const summaryPanel = $('summaryPanel');
const downloadReportBtn = $('downloadReportBtn');
const alertAudio = $('alertAudio');

// ---------- Research-grounded thresholds (see README for sources) ----------
const EAR_CLOSED_DEFAULT = 0.25;      // arXiv:2408.05836
const EAR_CONSEC_FRAMES = 20;
const PERCLOS_WINDOW_S = 30;
const PERCLOS_MODERATE = 15;          // NTHU-DDD based
const PERCLOS_CRITICAL = 30;          // PMC11055081
const CALIB_RATIO = 0.82;             // personal calib multiplier on baseline EAR
const MAR_YAWN_THRESHOLD = 0.6;
const VOICE_REPEAT_MS = 6000;
const EAR_VALID_MIN = 0.05;           // below this is landmark-tracking noise, not a real closed eye
const EAR_VALID_MAX = 0.6;
const WARMUP_FRAMES = 45;             // ~1.5s at 30fps — let FaceMesh lock on before alerting

// ---------- Landmark indices (MediaPipe FaceMesh) ----------
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const LEFT_EYE  = [362, 385, 387, 263, 373, 380];
const MOUTH = { top: 13, bottom: 14, left: 78, right: 308 };

// ---------- State ----------
let faceMesh = null;
let cameraUtil = null;
let running = false;
let earHistory = []; // {t, ear}
let calibrating = false;
let earClosedThreshold = EAR_CLOSED_DEFAULT;
let closedFrameCount = 0;
let currentTier = 'none'; // none | mild | moderate | critical
let lastAlertTimes = { mild: 0, moderate: 0, critical: 0 };
let voiceTimer = null;
let sirenNodes = null;
let sessionStart = null;
let sessionCounts = { mild: 0, moderate: 0, critical: 0 };
let sessionEvents = [];
let demoRunning = false;
let demoTimer = null;
let contacts = loadContacts();
let deferredInstallPrompt = null;
let framesSinceStart = 0;

function resetAlertState() {
  criticalOverlay.hidden = true;
  stopSiren();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  clearInterval(voiceTimer);
  currentTier = 'none';
  closedFrameCount = 0;
}

// ---------- Utility ----------
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function computeEAR(lm, idx) {
  const [p1, p2, p3, p4, p5, p6] = idx.map(i => lm[i]);
  const vert = dist(p2, p6) + dist(p3, p5);
  const horiz = dist(p1, p4) * 2;
  return horiz === 0 ? 0 : vert / horiz;
}

function computeMAR(lm) {
  const vert = dist(lm[MOUTH.top], lm[MOUTH.bottom]);
  const horiz = dist(lm[MOUTH.left], lm[MOUTH.right]);
  return horiz === 0 ? 0 : vert / horiz;
}

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function logEvent(tier, text) {
  sessionEvents.push({ t: new Date(), tier, text });
  if (alertLog.querySelector('.log-empty')) alertLog.innerHTML = '';
  const li = document.createElement('li');
  li.innerHTML = `<span class="log-${tier}">${text}</span><span class="log-time">${fmtTime()}</span>`;
  alertLog.prepend(li);
}

// ---------- Night mode (UI dim + a real detection-side brightness/contrast boost) ----------
let nightMode = false;
nightToggle.addEventListener('click', () => {
  nightMode = !nightMode;
  document.body.classList.toggle('night', nightMode);
  nightToggle.setAttribute('aria-pressed', String(nightMode));
});

// ---------- Install prompt ----------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

// ---------- Online / offline strip ----------
function updateConn() {
  const on = navigator.onLine;
  connStrip.textContent = on ? 'Online' : 'Offline — core detection still works';
  connStrip.classList.toggle('online', on);
  connStrip.classList.toggle('offline', !on);
}
window.addEventListener('online', updateConn);
window.addEventListener('offline', updateConn);
updateConn();

// ---------- Contacts ----------
function loadContacts() {
  try { return JSON.parse(localStorage.getItem('dg_contacts') || '[]'); }
  catch { return []; }
}
function saveContacts() {
  localStorage.setItem('dg_contacts', JSON.stringify(contacts));
  renderContacts();
}
function renderContacts() {
  contactList.innerHTML = '';
  contacts.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${c.name} — ${c.phone}</span>`;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => { contacts.splice(i, 1); saveContacts(); });
    li.appendChild(btn);
    contactList.appendChild(li);
  });
  notifyNowBtn.disabled = contacts.length === 0;
}
renderContacts();

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = contactName.value.trim();
  const phone = contactPhone.value.trim();
  if (!name || !phone) return;
  contacts.push({ name, phone });
  saveContacts();
  contactForm.reset();
});

function openMessagingApp(bodyText) {
  if (contacts.length === 0) return;
  const recipients = contacts.map(c => c.phone).join(',');
  const url = `sms:${recipients}?body=${encodeURIComponent(bodyText)}`;
  window.location.href = url;
}

function buildAlertMessage(withLocation) {
  let msg = `DrowsyGuard alert: I may be too drowsy to drive safely.`;
  if (withLocation && withLocation.lat) {
    msg += ` My last known location: https://maps.google.com/?q=${withLocation.lat},${withLocation.lon}`;
  }
  return msg;
}

function notifyContacts(auto) {
  const send = (loc) => {
    openMessagingApp(buildAlertMessage(loc));
    logEvent('critical', auto
      ? 'Messaging app opened automatically — tap Send to alert contacts'
      : 'Messaging app opened manually — tap Send to alert contacts');
  };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => send({ lat: pos.coords.latitude.toFixed(5), lon: pos.coords.longitude.toFixed(5) }),
      () => send(null),
      { timeout: 4000 }
    );
  } else {
    send(null);
  }
}
notifyNowBtn.addEventListener('click', () => notifyContacts(false));

// ---------- Rest stops (OpenStreetMap Overpass API) ----------
findRestBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    restList.innerHTML = '<li>Location not available on this device.</li>';
    return;
  }
  restList.innerHTML = '<li>Locating…</li>';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const query = `[out:json][timeout:15];(
        node["highway"="rest_area"](around:8000,${lat},${lon});
        node["amenity"="fuel"](around:8000,${lat},${lon});
        node["amenity"="cafe"](around:8000,${lat},${lon});
      );out center 12;`;
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: query
      });
      const data = await resp.json();
      renderRestStops(data.elements || [], lat, lon);
    } catch (err) {
      restList.innerHTML = '<li>Could not reach rest-stop data — check connection.</li>';
    }
  }, () => {
    restList.innerHTML = '<li>Location permission denied.</li>';
  });
});

function renderRestStops(elements, lat, lon) {
  if (!elements.length) {
    restList.innerHTML = '<li>No rest stops found nearby.</li>';
    return;
  }
  restList.innerHTML = '';
  elements.slice(0, 8).forEach(el => {
    const name = el.tags?.name || (el.tags?.highway === 'rest_area' ? 'Rest area' : el.tags?.amenity === 'fuel' ? 'Fuel station' : 'Cafe');
    const li = document.createElement('li');
    li.innerHTML = `${name} <a href="https://www.google.com/maps/dir/?api=1&origin=${lat},${lon}&destination=${el.lat},${el.lon}" target="_blank" rel="noopener">Directions →</a>`;
    restList.appendChild(li);
  });
}

// ---------- Audio siren (synthesized, no asset needed — works offline) ----------
function startSiren() {
  stopSiren();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.connect(gain); gain.connect(ctx.destination);
  gain.gain.value = 0.15;
  osc.start();
  let up = true;
  const sweep = setInterval(() => {
    const now = ctx.currentTime;
    osc.frequency.linearRampToValueAtTime(up ? 880 : 440, now + 0.4);
    up = !up;
  }, 400);
  sirenNodes = { ctx, osc, gain, sweep };
}
function stopSiren() {
  if (!sirenNodes) return;
  clearInterval(sirenNodes.sweep);
  try { sirenNodes.osc.stop(); sirenNodes.ctx.close(); } catch {}
  sirenNodes = null;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.12;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 220);
  } catch {}
}

function speakAlert() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const en = new SpeechSynthesisUtterance('Wake up. You appear drowsy. Please pull over.');
  en.lang = 'en-US'; en.rate = 1;
  const ta = new SpeechSynthesisUtterance('விழித்திரு. நீங்கள் தூங்குகிறீர்கள். வாகனத்தை நிறுத்தவும்.');
  ta.lang = 'ta-IN'; ta.rate = 1;
  speechSynthesis.speak(en);
  speechSynthesis.speak(ta);
}

// ---------- Alert tier handling ----------
function setTier(tier, score) {
  if (tier === currentTier) return;
  currentTier = tier;

  if (tier !== 'critical') {
    criticalOverlay.hidden = true;
    stopSiren();
    speechSynthesis.cancel();
    clearInterval(voiceTimer);
  }

  if (tier === 'mild') {
    sessionCounts.mild++;
    logEvent('mild', `Mild fatigue signs — consider a break soon (score ${score}%)`);
    beep();
    if (navigator.vibrate) navigator.vibrate(150);
  } else if (tier === 'moderate') {
    sessionCounts.moderate++;
    logEvent('moderate', `Moderate drowsiness detected (score ${score}%)`);
    beep(); setTimeout(beep, 260);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } else if (tier === 'critical') {
    sessionCounts.critical++;
    logEvent('critical', `CRITICAL — high drowsiness detected (score ${score}%)`);
    criticalOverlay.hidden = false;
    startSiren();
    speakAlert();
    voiceTimer = setInterval(speakAlert, VOICE_REPEAT_MS);
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    if (contacts.length >= 3) notifyContacts(true);
  }
}

dismissCritical.addEventListener('click', () => {
  resetAlertState();
});

// ---------- Scoring loop ----------
function pushEarSample(ear) {
  const now = performance.now();
  earHistory.push({ t: now, ear });
  const cutoff = now - PERCLOS_WINDOW_S * 1000;
  earHistory = earHistory.filter(s => s.t >= cutoff);
}

function computePerclos() {
  if (earHistory.length === 0) return 0;
  const closedCount = earHistory.filter(s => s.ear < earClosedThreshold).length;
  return (closedCount / earHistory.length) * 100;
}

function updateDashboard(ear, mar, perclos, score, tier) {
  earValue.textContent = ear.toFixed(2);
  marValue.textContent = mar.toFixed(2);
  perclosValue.textContent = perclos.toFixed(0) + '%';
  scoreValue.textContent = score.toFixed(0) + '%';
  scoreFill.style.width = Math.min(100, score) + '%';
}

function tierFromScore(perclos, ear, closedFrames, mar) {
  if (perclos >= PERCLOS_CRITICAL || closedFrames >= EAR_CONSEC_FRAMES * 2) return 'critical';
  if (perclos >= PERCLOS_MODERATE || closedFrames >= EAR_CONSEC_FRAMES) return 'moderate';
  if (perclos >= 6 || mar >= MAR_YAWN_THRESHOLD) return 'mild';
  return 'none';
}

function processFrame(ear, mar) {
  framesSinceStart++;

  // A reading outside this range is landmark-tracking noise (face detector still
  // locking on, motion blur, partial occlusion) — not a real eye state. Show it on
  // the dashboard but never let it count toward an alert.
  const earIsValid = ear >= EAR_VALID_MIN && ear <= EAR_VALID_MAX;
  if (!earIsValid) {
    updateDashboard(ear, mar, computePerclos(), 0, 'none');
    return;
  }

  pushEarSample(ear);
  closedFrameCount = ear < earClosedThreshold ? closedFrameCount + 1 : 0;
  const perclos = computePerclos();
  const score = Math.min(100, perclos * 1.6 + (mar >= MAR_YAWN_THRESHOLD ? 15 : 0));

  // Give FaceMesh a brief warm-up window right after start/demo begins before any
  // tier can fire, so the first jittery frames can never trigger a false alert.
  if (framesSinceStart < WARMUP_FRAMES) {
    updateDashboard(ear, mar, perclos, score, 'none');
    return;
  }

  const tier = tierFromScore(perclos, ear, closedFrameCount, mar);
  updateDashboard(ear, mar, perclos, score, tier);
  setTier(tier, Math.round(score));
}

// ---------- Calibration ----------
calibrateBtn.addEventListener('click', () => startCalibration());

function startCalibration() {
  resetAlertState();
  calibrating = true;
  calibrateModal.hidden = false;
  const samples = [];
  let elapsed = 0;
  const total = 10;
  calibSecs.textContent = total;
  calibFill.style.width = '0%';
  const iv = setInterval(() => {
    elapsed += 0.2;
    calibFill.style.width = Math.min(100, (elapsed / total) * 100) + '%';
    calibSecs.textContent = Math.max(0, Math.ceil(total - elapsed));
    if (elapsed >= total) {
      clearInterval(iv);
      calibrating = false;
      calibrateModal.hidden = true;
      const recent = earHistory.slice(-100).map(s => s.ear).filter(v => v > 0);
      if (recent.length > 5) {
        const baseline = recent.reduce((a, b) => a + b, 0) / recent.length;
        earClosedThreshold = +(baseline * CALIB_RATIO).toFixed(3);
      }
      statusLine.textContent = `Calibrated. Personal EAR threshold: ${earClosedThreshold}`;
      logEvent('mild', `Calibration complete — threshold set to ${earClosedThreshold}`);
    }
  }, 200);
}

// ---------- Night-mode frame boost (real preprocessing, not cosmetic) ----------
const boostCanvas = document.createElement('canvas');
const boostCtx = boostCanvas.getContext('2d');
function boostedFrameSource() {
  if (!nightMode) return video;
  boostCanvas.width = video.videoWidth || 640;
  boostCanvas.height = video.videoHeight || 480;
  boostCtx.filter = 'brightness(1.5) contrast(1.25)';
  boostCtx.drawImage(video, 0, 0, boostCanvas.width, boostCanvas.height);
  return boostCanvas;
}

// ---------- FaceMesh wiring ----------
function onResults(results) {
  overlay.width = video.videoWidth || overlay.clientWidth;
  overlay.height = video.videoHeight || overlay.clientHeight;
  octx.clearRect(0, 0, overlay.width, overlay.height);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    statusLine.textContent = 'No face detected — center your face in frame.';
    return;
  }
  const lm = results.multiFaceLandmarks[0];

  // light landmark visualization for eyes/mouth only
  octx.fillStyle = '#ff9646';
  [...RIGHT_EYE, ...LEFT_EYE, MOUTH.top, MOUTH.bottom, MOUTH.left, MOUTH.right].forEach(i => {
    const p = lm[i];
    octx.beginPath();
    octx.arc(p.x * overlay.width, p.y * overlay.height, 2, 0, Math.PI * 2);
    octx.fill();
  });

  const earR = computeEAR(lm, RIGHT_EYE);
  const earL = computeEAR(lm, LEFT_EYE);
  const ear = (earR + earL) / 2;
  const mar = computeMAR(lm);

  if (!calibrating) {
    processFrame(ear, mar);
    statusLine.textContent = 'Monitoring…';
  } else {
    pushEarSample(ear);
  }
}

async function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults(onResults);
}

async function startCamera() {
  cameraUtil = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: boostedFrameSource() }); },
    width: 640,
    height: 480
  });
  await cameraUtil.start();
}

// ---------- Start / Stop session ----------
startBtn.addEventListener('click', async () => {
  try {
    statusLine.textContent = 'Requesting camera access…';
    if (!faceMesh) await initFaceMesh();
    await startCamera();
    cameraPlaceholder.hidden = true;
    running = true;
    framesSinceStart = 0;
    resetAlertState();
    sessionStart = new Date();
    sessionCounts = { mild: 0, moderate: 0, critical: 0 };
    sessionEvents = [];
    summaryPanel.hidden = true;
    startBtn.hidden = true;
    stopBtn.hidden = false;
    calibrateBtn.disabled = false;
    demoBtn.disabled = true;
    statusLine.textContent = 'Camera live. Detecting…';
    logEvent('mild', 'Session started');
  } catch (err) {
    statusLine.textContent = 'Camera access failed: ' + (err.message || err);
    logEvent('critical', 'Camera access failed — check browser permissions');
  }
});

stopBtn.addEventListener('click', () => endSession());

function endSession() {
  running = false;
  if (cameraUtil) { try { cameraUtil.stop(); } catch {} }
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  cameraPlaceholder.hidden = false;
  startBtn.hidden = false;
  stopBtn.hidden = true;
  calibrateBtn.disabled = true;
  demoBtn.disabled = false;
  resetAlertState();
  showSummary();
}

function showSummary() {
  const durationMs = sessionStart ? (new Date() - sessionStart) : 0;
  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000);
  const total = sessionCounts.mild + sessionCounts.moderate + sessionCounts.critical;
  const safeScore = Math.max(0, 100 - sessionCounts.mild * 3 - sessionCounts.moderate * 10 - sessionCounts.critical * 25);

  $('sumScore').textContent = safeScore;
  $('sumMild').textContent = sessionCounts.mild;
  $('sumModerate').textContent = sessionCounts.moderate;
  $('sumCritical').textContent = sessionCounts.critical;
  $('sumDuration').textContent = `${mins}m ${secs}s`;
  summaryPanel.hidden = false;
  summaryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

downloadReportBtn.addEventListener('click', () => {
  const lines = [
    'DrowsyGuard Session Report',
    `Generated: ${new Date().toString()}`,
    `Duration: ${$('sumDuration').textContent}`,
    `Safe-driving score: ${$('sumScore').textContent}`,
    `Mild alerts: ${sessionCounts.mild}`,
    `Moderate alerts: ${sessionCounts.moderate}`,
    `Critical alerts: ${sessionCounts.critical}`,
    '',
    'Timeline:',
    ...sessionEvents.map(e => `[${fmtTime(e.t)}] (${e.tier.toUpperCase()}) ${e.text}`)
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `drowsyguard-report-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Demo scenario (no camera needed) ----------
const DEMO_SCRIPT = [
  { t: 0,  ear: 0.32, mar: 0.25 },
  { t: 3,  ear: 0.30, mar: 0.28 },
  { t: 6,  ear: 0.24, mar: 0.30 },
  { t: 9,  ear: 0.18, mar: 0.35 },
  { t: 12, ear: 0.15, mar: 0.65 }, // yawn
  { t: 15, ear: 0.12, mar: 0.30 },
  { t: 18, ear: 0.10, mar: 0.28 },
  { t: 21, ear: 0.28, mar: 0.25 }, // brief recovery
  { t: 24, ear: 0.09, mar: 0.30 },
  { t: 27, ear: 0.08, mar: 0.30 },
];

demoBtn.addEventListener('click', () => {
  if (demoRunning) return;
  demoRunning = true;
  cameraPlaceholder.hidden = false;
  cameraPlaceholder.querySelector('p').textContent = 'Running scripted demo — no camera used.';
  startBtn.disabled = true;
  sessionStart = new Date();
  sessionCounts = { mild: 0, moderate: 0, critical: 0 };
  sessionEvents = [];
  earHistory = [];
  closedFrameCount = 0;
  framesSinceStart = 0;
  summaryPanel.hidden = true;
  stopBtn.hidden = false;
  demoBtn.disabled = true;
  logEvent('mild', 'Demo scenario started');

  let i = 0;
  const step = () => {
    if (i >= DEMO_SCRIPT.length || !demoRunning) {
      endDemo();
      return;
    }
    const { ear, mar } = DEMO_SCRIPT[i];
    // simulate several frames per script point so PERCLOS window fills naturally
    for (let k = 0; k < 15; k++) processFrame(ear + (Math.random() - 0.5) * 0.01, mar);
    i++;
    demoTimer = setTimeout(step, 900);
  };
  step();
});

function endDemo() {
  demoRunning = false;
  clearTimeout(demoTimer);
  startBtn.disabled = false;
  cameraPlaceholder.querySelector('p').textContent = 'Camera preview appears here once monitoring starts.';
  stopBtn.hidden = true;
  demoBtn.disabled = false;
  resetAlertState();
  showSummary();
}

// stop button should also end an in-progress demo
stopBtn.addEventListener('click', () => { if (demoRunning) endDemo(); });

// ---------- Service worker registration ----------
// APP_BUILD is bumped alongside sw.js's CACHE_VERSION — check the footer on screen
// to confirm which build is actually running on this device.
const APP_BUILD = 'v4';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
  // If a new service worker takes control (i.e. an update was just installed),
  // reload once automatically so the fix is actually visible instead of requiring
  // a manual cache-clear. The reload guard prevents a refresh loop.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
const footerEl = document.querySelector('.footer p');
if (footerEl) footerEl.textContent += ` (build ${APP_BUILD})`;

})();
