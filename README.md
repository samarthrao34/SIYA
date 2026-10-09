<p align="center">
  <img src="docs/images/siya-logo-rounded.png" alt="SIYA" width="320" />
</p>

<p align="center">
  <b>A private, emotionally aware 3D AI companion for your desktop and phone.</b><br/>
  Real-time voice, a living 3D avatar, on-device emotion sensing, long-term memory and hands-on desktop control.
</p>

<p align="center">
  <a href="https://github.com/samarthrao34/SIYA/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/samarthrao34/SIYA/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-0.180-000000?logo=threedotjs" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" />
  <a href="LICENSE"><img alt="License: Proprietary" src="https://img.shields.io/badge/License-Proprietary-red.svg" /></a>
</p>

---

## What is SIYA?

SIYA is a desktop companion you talk to like a person. She listens and answers
in real time, reacts with a fully animated 3D body and face, notices how you
are doing through your camera and your words, remembers what matters to you,
and can act on your computer when you ask: open apps, manage files, read your
screen, search the web.

Privacy comes first. Each user brings their own Gemini API key. Emotion
sensing runs on-device. Personal data is encrypted at rest with a key held in
the OS keyring. For a fully offline setup, a local brain (Gemma + local
speech) can replace Gemini entirely.

## Features

| Area | What it does |
| --- | --- |
| **Live conversation** | Full-duplex voice and text over Gemini Live, with interruption, reconnect with backoff, wake word, and time-of-day greetings. |
| **3D avatar** | SIYA's own VRoid (VRM) model, rendered with Three.js: lip-sync from the audio stream, gaze, idle behaviour, procedural gestures, expressions and physics. |
| **Emotion & behaviour sensing** | MediaPipe face and hand landmarks, run locally in WASM, read facial emotion plus longer-term cues such as yawning, fatigue, head-in-hands and fidgeting. Optional text-emotion reading of the user's words. |
| **Memory** | Long-term memories consolidated from conversations, browsable and editable in the Memories panel. |
| **Cognition** | An autonomous layer for attention, goals, planning, curiosity, social initiative, proactive check-ins, and a critic that reviews tool use. |
| **Desktop control** | 60+ tools through a local Python agent: apps and windows, files, mouse and keyboard, clipboard, screenshots and OCR, volume and brightness, web search, and power actions with two-step confirmation. |
| **Screen vision** | "Look at my screen" captures the display and feeds it to the model so it can answer about what you're seeing. |
| **API hub** | Imports the public-APIs catalogue, health-checks providers, and runs verified adapters as tools. |
| **Offline brain** | Optional local mode: Gemma 4 via LiteRT-LM, Silero VAD and Kokoro / Edge TTS. Same tools, memory and avatar. |
| **Mobile** | A standalone Android app with the same avatar and persona that talks to Gemini directly from the phone. |
| **Desktop shell** | Electron app with splash, tray, window-state persistence, auto-updates, and AppImage / NSIS / DMG packaging. |

## Architecture

```mermaid
flowchart LR
  subgraph Electron["Electron shell (electron/)"]
    UI["React UI + 3D avatar<br/>src/"]
  end
  UI <-- "HTTP /api + WebSocket /live" --> Server["Node backend<br/>server/"]
  Server <-- "Gemini Live" --> Gemini[(Google Gemini)]
  Server <-- "HTTP :8765" --> Agent["Desktop agent<br/>services/desktop_agent (FastAPI)"]
  Server <-. "local brain mode" .-> Voice["Local voice<br/>services/local_voice (VAD + TTS)"]
  Server <-. "local brain mode" .-> LLM[(Gemma via LiteRT-LM)]
  Agent --> OS["OS: windows, files,<br/>input, screen"]
  Phone["Android app<br/>mobile/"] <-- "Gemini Live" --> Gemini
  Phone <-. "memory API (adb reverse)" .-> Server
```

The Electron main process starts the bundled backend (`dist/server.cjs`) and
loads the UI it serves on `localhost:3000`. The backend owns the Gemini Live
session, memory, cognition, safety and screen vision, and it auto-spawns the
Python desktop agent. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a
deeper walkthrough.

## Roadmap: a physical body for SIYA

<p align="center">
  <img src="docs/images/siya-robot-concept.png" alt="Concept render of the SIYA companion robot" width="360" />
  <br/><sub>Concept render of SIYA's companion robot</sub>
</p>

SIYA lives on screen today. We are building a **companion robot** so she can
share your space as well. This is active, ongoing work. The design and
architecture below are what we are building towards; none of the robot side
ships yet.

### The design

A friendly, rounded, wheeled companion about the size of a small bin, with a
soft cream shell and gold accents. SIYA's face is not mechanical: **her
VRoid avatar lives on a large portrait display** at the front, so every
expression, glance and word she has on the desktop carries over to the robot.

| Part | Role |
| --- | --- |
| **Portrait display** | Renders SIYA's 3D avatar with live lip-sync, gaze and expressions, using the same character engine as the desktop app. |
| **Stereo camera array** (above the display) | Depth vision for seeing and recognising the person she is talking to, reading emotion and behaviour, and navigation. Flanking sensors add ambient light and proximity. |
| **Side speakers with light rings** | SIYA's voice, with gold rings that glow and pulse as she speaks. |
| **Microphones** | Far-field listening and wake word, so you can talk to her from across the room. |
| **Star beacon** | A glowing star on top that shows her state at a glance: listening, thinking, speaking, or asleep. |
| **Base light band** | An ambient glow around the base that reflects mood and status. |
| **Front sensor** | Obstacle and edge detection for safe movement. |
| **Wheeled base** | Lets her come to you, follow you between rooms, face whoever is speaking, and return to her charging dock. |

### Architecture

The robot is **a second body for the same SIYA**, not a separate product.
Her brain, memory, personality and safety stay in the existing backend. The
display runs the existing avatar renderer, and the signals that animate her
today (speaking state, lip-sync visemes, expressions, gaze; see
`shared/runtime/`) also drive the robot's lights and movement.

```mermaid
flowchart LR
  subgraph Today["Today"]
    Brain["SIYA backend<br/>server/<br/>(conversation, memory,<br/>cognition, safety)"]
    Events["Avatar events<br/>shared/runtime/<br/>state · visemes ·<br/>expression · gaze"]
    Avatar["3D avatar<br/>src/character/"]
    Brain --> Events --> Avatar
  end

  subgraph Robot["In development: companion robot"]
    Bridge["Embodiment bridge<br/>(planned server module)"]
    Controller["Onboard controller"]
    Display["Portrait display<br/>SIYA's avatar"]
    Voice["Speakers + light rings<br/>microphones"]
    Lights["Star beacon<br/>base light band"]
    Base["Wheeled base<br/>+ charging dock"]
    Senses["Stereo cameras<br/>front sensor"]
    Safety["Motion safety<br/>speed limits · e-stop"]
    Bridge --> Controller
    Controller --> Display
    Controller --> Voice
    Controller --> Lights
    Controller --> Base
    Senses --> Controller
    Safety -.- Base
  end

  Events -. "same event stream" .-> Bridge
  Avatar -. "same renderer" .-> Display
  Controller -. "what the robot<br/>sees and hears" .-> Brain
```

### Milestones

| # | Milestone | What it unlocks |
| --- | --- | --- |
| 1 | **Embodiment protocol** | A versioned, transport-neutral event stream (state, speech timing, visemes, expressions, gaze) from the backend, so any body can subscribe. |
| 2 | **SIYA on the display** | A full-screen build of the avatar for the robot's portrait display, with lip-sync and expressions driven live. |
| 3 | **Voice and light** | Far-field microphones and speakers, with the star beacon, speaker rings and base band mapped to listening, thinking, speaking and mood. |
| 4 | **Embodied perception** | The stereo cameras feed SIYA's existing emotion and behaviour pipelines, so she can tell who is in front of her and how they are doing. |
| 5 | **Mobility** | Turn to face whoever is speaking, come when called, follow between rooms, avoid obstacles, and dock to charge. |
| 6 | **Safety and autonomy** | Speed limits, edge and obstacle stops, an emergency stop, consent rules for when she may move, and proactive presence in the room. |

Hardware components are still being evaluated and will be documented as each
milestone lands.

## Repository layout

```
SIYA/
├── src/                    Desktop UI (React 19 + Vite + Tailwind 4)
│   ├── api/                Live session client (audio in/out, reconnect, tool events)
│   ├── character/          Three.js character engine, VRM loader, SIYA's preset
│   ├── components/         Main experience and panels (Settings, Memories, Themes, Privacy…)
│   ├── settings/           Settings store and wake-word listener
│   └── vision/             On-device emotion and behaviour analysis (MediaPipe)
├── server/                 Node backend (Express + ws), bundled to dist/server.cjs
│   ├── index.ts            Entry point: HTTP API, /live relay, Gemini Live, tool routing
│   ├── cognition/          Autonomous mind: attention, goals, planner, critic, initiative…
│   ├── api-hub/            Public-API catalogue, adapters and health checks
│   ├── localLive.ts        Offline brain (Gemma + local voice) with the Gemini Live surface
│   ├── memory.ts           Long-term memory storage and consolidation
│   ├── safety.ts           Crisis-language detection and helplines
│   ├── screenVision.ts     Screen capture → model pipeline
│   ├── secureStore.ts      AES-256-GCM encryption at rest
│   └── …                   paths, liveAudio, textEmotion
├── shared/                 Code shared by UI, mobile and server
│   ├── runtime/            Avatar event bus and speech timeline (lip-sync)
│   └── memoryTypes.ts
├── electron/               Desktop shell: main process, preload, splash, tray, updates
├── services/               Python sidecars
│   ├── desktop_agent/      FastAPI desktop-control agent (Linux / Hyprland)
│   └── local_voice/        Silero VAD + Kokoro / Edge TTS for the offline brain
├── mobile/
│   ├── app/                Standalone mobile web app (React), packed into the APK
│   ├── android/            Minimal Android WebView shell + local asset server
│   ├── build-mobile.sh     Builds and signs the APK (no Gradle)
│   └── connect-phone.sh    adb reverse so the phone reaches the desktop backend
├── public/                 Static assets: avatar models, MediaPipe WASM + models, brand
├── tests/                  Node test runner suites (desktop shell, live session, speech…)
├── docs/                   Architecture and reliability notes, robot concept art
├── build/                  App icon used by electron-builder
└── .github/workflows/      CI: typecheck, tests, build
```

## Getting started

### Prerequisites

- **Node.js 20+** (22 recommended) and npm
- **Python 3.10+** for the desktop agent (and the optional local voice service)
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)
- Linux desktop control targets **Hyprland** (`hyprctl`). OCR tools need
  `tesseract`.

### Install

```bash
git clone https://github.com/samarthrao34/SIYA.git   # private: access by invitation
cd SIYA
npm install

# Desktop agent dependencies
pip install -r services/desktop_agent/requirements.txt
```

### Configure

```bash
cp .env.example .env      # then set GEMINI_API_KEY (or enter it later in Settings)
```

All variables are documented in [`.env.example`](.env.example).

### Run

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend + UI with hot reload on <http://localhost:3000>. The desktop agent is auto-spawned. |
| `npm run build && npm start` | Builds the UI and backend bundle, then launches the Electron app. |
| `npm run package` | Builds an installable package into `release/` (AppImage / NSIS / DMG). |

### Offline brain (optional)

```bash
python3 -m venv services/local_voice/.venv
services/local_voice/.venv/bin/pip install -r services/local_voice/requirements.txt
# put silero_vad.onnx, kokoro-v1.0.onnx and voices-v1.0.bin in services/local_voice/models/
SIYA_BRAIN=local npm run dev
```

The backend starts the voice service on demand and expects an
OpenAI-compatible Gemma endpoint at `SIYA_LOCAL_LLM_URL`.

### Mobile (Android)

```bash
cp mobile/app/.env.example mobile/app/.env   # set VITE_SIYA_BRAIN_TOKEN
./mobile/build-mobile.sh                     # → mobile/build/siya-mobile.apk
./mobile/connect-phone.sh                    # optional: link phone to desktop memory over USB
```

The build script needs the Android SDK build tools (36.x) and JDK 17. It
assembles the APK with `aapt2`/`d8`/`apksigner` directly, without Gradle.

## Development

```bash
npm run typecheck   # server, desktop UI and mobile app
npm run build       # production UI + server bundle
npm test            # node:test suites in tests/ (the desktop shell test needs the build)
```

CI runs the same three steps on every push and pull request, plus a Python
byte-compile of `services/`.

Conventions:

- Backend code lives in `server/` and is type-checked strictly
  (`tsconfig.json`). UI and mobile have their own configs.
- Anything used by more than one of UI, mobile and server goes in `shared/`.
- The tool list in `services/desktop_agent/registry.py` must match
  `DESKTOP_TOOLS` in `server/index.ts`. The agent logs a warning on mismatch.
- Never commit `.env`, keystores, `.siya-data/` or `logs/`; they hold keys and
  personal conversations. `.gitignore` covers them.

## Privacy & safety

- **Your key, your data.** No SIYA-operated backend. Requests go from your
  machine to Gemini with your own key. The two optional services that send
  text elsewhere (TypeSafe text-emotion, Edge TTS in local mode) are marked
  in `.env.example` and can be turned off.
- **Encrypted at rest.** Memories, goals and session state
  are encrypted with AES-256-GCM. The key is sealed in the OS keyring via
  Electron `safeStorage`.
- **On-device perception.** Camera frames are analysed locally. Only derived
  emotion and behaviour states reach the model.
- **Consent and control.** A first-run consent and age gate, a Privacy Center
  that explains what is stored and offers "delete all my data", and two-step
  confirmation for destructive desktop actions.
- **Crisis safety net.** Deterministic detection on every message, independent
  of the model, shows helpline numbers on screen.

SIYA is a companion, not a medical device or a replacement for professional
care.

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together
- [docs/RELIABILITY.md](docs/RELIABILITY.md): reconnects, tray behaviour, updates and packaging

## License

Copyright © 2026 Samarth Rao. All rights reserved. This is proprietary
software; see [LICENSE](LICENSE). No use, copying or distribution is
permitted without written permission.

## Author

Built by **Samarth Rao** ([@samarthrao34](https://github.com/samarthrao34)).
