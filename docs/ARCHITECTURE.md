# SIYA architecture

SIYA is four processes that talk over localhost:

| Process | Code | Port | Role |
| --- | --- | --- | --- |
| Electron main | `electron/` | – | Window, splash, tray, updates, encryption key, screen capture for the backend |
| Node backend | `server/` → `dist/server.cjs` | 3000 | Serves the UI, `/api/*`, the `/live` WebSocket relay to Gemini Live, memory, cognition, safety |
| Desktop agent | `services/desktop_agent/` | 8765 | FastAPI tool server for OS control (`POST /execute {tool, args}`) |
| Local voice *(optional)* | `services/local_voice/` | 8795 | Silero VAD + Kokoro/Edge TTS for the offline brain |

## Startup

1. `electron/main.cjs` shows the splash, loads or creates the data key
   (sealed with `safeStorage`), and spawns `dist/server.cjs` with Electron's
   bundled Node (`ELECTRON_RUN_AS_NODE`). `cwd` is the app root, and
   `SIYA_DATA_DIR` is the per-user data folder.
2. The backend listens on `127.0.0.1:3000`, probes the desktop agent and, if
   it is absent, spawns `python -m uvicorn desktop_agent.main:app --app-dir services`.
3. Electron opens the main window on `http://localhost:3000` and starts the
   `adb reverse` phone bridge.

In development, `npm run dev` runs `server/index.ts` through `tsx`. The backend
then mounts Vite as middleware, so UI changes hot-reload on the same port.

## A conversation turn

```
mic (pcm-capture-worklet) ─► src/api/liveSession.ts ─► ws /live ─► server/index.ts ─► Gemini Live
                                                                        │
          avatar lip-sync ◄─ shared/runtime/speechTimeline ◄─ audio ◄───┤
                                                                        ├─► tool calls ─► desktop agent / API hub / memory
                                                                        ├─► server/safety.ts (every user message)
                                                                        └─► server/cognition (attention, goals, initiative)
```

- **Audio** goes up as 16 kHz PCM and comes back as 24 kHz PCM. The UI turns
  the amplitude envelope into visemes via `shared/runtime/speechTimeline.js`
  and broadcasts avatar events on `shared/runtime/avatarEvents.js`.
- **Camera**: `src/vision/emotionDetector.ts` (face blendshapes) and
  `src/vision/behaviorAnalyzer.ts` (face + hands over time) run MediaPipe
  locally. Only the resulting labels are sent to the backend.
- **Tools** declared to the model are routed by `server/index.ts`: desktop
  tools go to the Python agent, API tools to `server/api-hub`, memory tools to
  `server/memory.ts`. Dangerous power actions need a confirmation token from
  `services/desktop_agent/tools_confirmation.py`.
- **Screen vision** (`server/screenVision.ts`) spots "look at my screen"
  intents, captures through the agent or Electron IPC, and injects the frame
  into the live session.

## Brains

`server/localLive.ts` exposes the same surface as a Gemini Live session
(`sendRealtimeInput`, `sendClientContent`, `sendToolResponse`, `close`,
`onmessage`). With `SIYA_BRAIN=local` the rest of the backend runs unchanged
on Gemma (LiteRT-LM, OpenAI-compatible API) plus `services/local_voice`.

## Cognition (`server/cognition/`)

`CognitiveRuntime` (`runtime.ts`) holds the long-running state:

- `situationModel`, `attentionEngine`: what is going on and what matters now
- `goalManager`, `planner`, `critic`, `toolExecutor`: multi-step tasks, with review
- `autonomousMind`, `curiosityEngine`, `socialInitiativeEngine`,
  `conversationContinuationEngine`, `initiativeEngine`, `proactivePresence`:
  when and how SIYA speaks up unprompted
- `structuredMemory`, `skillManager`: typed memories and learned skills
- `modelRouter`, `speechOrchestrator`, `eventBus`, `safety`: plumbing

State is persisted under `<data dir>/cognition/*.v1.json`, encrypted when a
data key is present.

## Data and privacy

All personal data lives in `SIYA_DATA_DIR` (Electron's `userData` when
packaged, the repo root plus `.siya-data/` in development). This covers
settings, memories, cognition state, API-hub registry and logs.
`server/secureStore.ts` encrypts it with AES-256-GCM. Reads accept legacy
plaintext and re-encrypt it on the next save.

## Avatar

SIYA has one character: her own VRoid model
(`public/assets/characters/siya/SIYA.vrm`, preset in
`src/character/siyaCharacter.ts`). The preset spreads `BASE_CHARACTER` from
`src/character/characterEngine.ts`, which holds the shared rig tuning (bone
map, base pose, idle, gaze, lip-sync, materials, physics) and no model of its
own. `characterEngine.ts` is the Three.js renderer, animation and physics
engine; `vrmModelSource.ts` loads the VRM and maps its skeleton onto the rig.

## Mobile

`mobile/app` is a separate Vite build (`vite.mobile.config.ts`) that reuses
`src/character`, `src/vision` and `shared/` but talks to Gemini directly from
the phone. `mobile/build-mobile.sh` copies the bundle into
`mobile/android/assets/www/`, where `AssetServer.java` serves it to the WebView
on `127.0.0.1`. The script then compiles and signs the APK without Gradle.

## Future: physical embodiment

A wheeled companion robot for SIYA is in development (concept:
`docs/images/siya-robot-concept.png`). Her face is the existing VRoid avatar
on a portrait display, so the robot reuses the character engine directly. A
planned embodiment bridge in the backend will publish the avatar event stream
(`shared/runtime/avatarEvents.js`) to the robot, where the same state, speech
and expression events also drive its star beacon, light rings and motion.
The robot's stereo cameras and microphones feed back into the existing
perception and voice pipelines, so there is one brain, one memory and one
safety layer for both bodies. See the roadmap in the
[README](../README.md#roadmap-a-physical-body-for-siya).
