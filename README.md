# DrowsyGuard

An on-device driver drowsiness detection app. Runs entirely in the browser using webcam-based face-landmark tracking — no wearables, no video ever leaves the device.

## Features

- **Live multi-signal detection** — PERCLOS (percentage of eye closure over time), Eye Aspect Ratio (EAR), and Mouth Aspect Ratio (MAR, for yawn detection), fused into a rolling drowsiness score.
- **Personal calibration** — a 10-second baseline capture at the start of a session, so alert thresholds adapt to the driver's own eye shape and resting blink rate instead of a fixed value.
- **Escalating alert tiers** — mild (micro-break nudge) → moderate (audio + vibration) → critical (full-screen red overlay, synthesized siren via Web Audio, repeating bilingual voice alert, and automatic rest-stop lookup).
- **Bilingual voice alerts** — spoken in English and Tamil, using the browser's built-in speech synthesis. Repeats every 6 seconds while a critical alert is active.
- **Nearby rest-stop finder** — uses your device location and the OpenStreetMap Overpass API to surface real rest areas, fuel stations, and cafés nearby, with one-tap directions.
- **Emergency contacts, opened automatically** — save any number of trusted contacts. Once 3 or more are saved, a critical alert automatically **opens your device's messaging app**, pre-addressed to all of them with your live location filled in — one tap to send. You can also trigger "Notify all contacts now" manually.
- **Session summary report** — a post-drive card with a safe-driving score, alert counts, and a full timeline, downloadable as a text report.
- **Run Demo Scenario** — replays a scripted drowsiness episode without needing a camera, so the pitch demo works reliably regardless of stage lighting or Wi-Fi.
- **Installable, offline-capable** — a manifest + service worker cache the app shell and the face-detection library on first load, so it works as an installed PWA without a live connection afterward. Chrome will prompt to install once it's served over HTTPS (e.g. GitHub Pages); there's also an in-app **Install** button. Location-dependent features (rest stops, SMS location tag) still need a connection when used.
- **Night mode** — dims and warms the whole UI (red/amber, reduced brightness) to protect night vision and cut windshield glare. It also runs the actual detection frame through a brightness/contrast boost before it reaches the face detector — a real low-light detection aid, not just a cosmetic filter on the preview.

## A note on "automatic" emergency messages — read this before your demo

At 3+ saved contacts, a critical alert **automatically opens your messaging app** with all contacts and your location pre-filled — that part is real and automatic.

What it can't do, and what no website can do: **silently transmit an SMS with zero taps.** That's a browser/OS security boundary, not a bug or a corner we cut — it exists so that no site can text people on your behalf without your final confirmation. The two ways around it are (a) you tap Send in your own messaging app, which this app sets up for you, or (b) a paid backend SMS gateway (like Twilio) that you own and hold credentials for, which is a different, server-based project — a static GitHub Pages site can't securely hold those credentials.

If a judge asks "does it send automatically," the accurate answer is: *it automatically prepares and opens the message with your contacts and location — you send it with one tap.*

## Running it

No build step — it's plain HTML/CSS/JS.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Or deploy straight to GitHub Pages:

1. Push this folder's contents to a GitHub repo.
2. Repo **Settings → Pages** → Deploy from branch → `main` / `/(root)`.
3. Open the `https://<username>.github.io/<repo>/` URL. Camera access requires HTTPS — GitHub Pages serves over HTTPS by default, so this works out of the box.
4. On your phone in Chrome, open the same link — you'll get the native "Add to Home Screen" prompt, or tap the in-app **Install** button.

### Before you demo

Open the deployed link once and click through: Start Monitoring → grant camera → Calibrate → toggle Night Mode → add 3 test contacts → Run Demo Scenario → End Session → Download report. Catching anything odd on your actual device beforehand is worth the five minutes.

## How detection works

- Face landmarks come from **MediaPipe FaceMesh**, loaded from a CDN at runtime (and cached by the service worker for offline use afterward).
- **EAR** (Eye Aspect Ratio) = ratio of eye height to eye width across 6 landmark points per eye; it drops sharply when eyes close.
- **PERCLOS** (Percentage of Eye Closure) = share of the last 30 seconds where EAR was below the closed-eye threshold — one of the most widely used metrics in computer-vision drowsiness research.
- **MAR** (Mouth Aspect Ratio) flags yawning as a secondary fatigue signal.

### Research basis for the thresholds

Instead of hand-picked numbers, the defaults are set from published drowsiness-detection literature, then personalized per driver through the 10-second calibration step:

| Parameter | Value used | Source |
|---|---|---|
| EAR closed-eye threshold | 0.25 (confirmed over 20 consecutive frames) | *Real-Time Drowsiness Detection Using Eye Aspect Ratio and Facial Landmark Detection* (arXiv:2408.05836) |
| PERCLOS moderate/alarm threshold | 15% | PERCLOS-based driver eye-tracking evaluated on the NTHU Driver Drowsiness Detection (NTHU-DDD) dataset |
| PERCLOS critical threshold | 30% | *Association of Visual-Based Signals with EEG Patterns in Drowsiness Detection* — PERCLOS ≥30% validated against six-channel EEG (PMC11055081) |
| Personal calibration ratio | 0.82 × driver's own baseline EAR | Derived from the gap between typical open-eye EAR (~0.30) and the closed-eye threshold above |

So the pitch answer to "how was this trained/validated" is: the detection architecture and its thresholds are grounded in peer-reviewed drowsiness research validated on real driver datasets (NTHU-DDD) and against physiological ground truth (EEG), then adapted per-driver via on-device calibration — rather than a black-box model trained from scratch.

### Notes for the judges' round

- This app doesn't run its own trained classifier — it applies literature-backed thresholds, personalized live per driver. That's a legitimate, citable design choice; be upfront about it if asked.
- Not yet tested against sunglasses, poor lighting, extreme head angles, or actual night driving.
- The rest-stop finder depends on OpenStreetMap data completeness, which varies by region — worth a quick venue test beforehand.
- See "A note on automatic emergency messages" above — know the honest answer before you're asked.

## Project structure

```
drowsy-guard/
├── index.html       # UI structure
├── style.css         # Dashboard visual design
├── app.js            # Detection logic, alerts, contacts, rest stops, summary
├── manifest.json      # PWA manifest (installable app)
├── sw.js              # Service worker (offline app-shell + CDN caching)
├── icon.svg           # App icon (source)
├── icon-192.png        # App icon (192×192, for install prompts)
├── icon-512.png        # App icon (512×512, for splash/store)
└── README.md
```
