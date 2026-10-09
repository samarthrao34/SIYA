# SIYA data flows

What leaves the device, which service receives it, and what is stored,
derived from the code. The consent screen and Privacy Center show a summary
of the same information (`src/components/DataDisclosure.tsx`), filtered to
the flows active in the current setup (`GET /api/privacy/status`, built by
`buildPrivacyStatus` in `server/privacyControls.ts`).

Keep this file, `DataDisclosure.tsx` and the README's privacy section in sync
whenever a data flow changes, and bump `CONSENT_VERSION` in
`src/components/ConsentGate.tsx` so existing users are asked again.

## The two privacy switches

**Share screen** (screen access). Off at every launch and every reconnect;
never saved. SIYA can see the screen only between the user clicking Share
screen and stopping or pausing it.

- The client reports every start, pause, resume and stop
  (`{type: "screen_share"}`, `src/api/liveSession.ts`
  `setScreenShareActive`), synchronously before any frame is sent.
- The server tracks it per live session (`PrivacyControls` in
  `server/privacyControls.ts`). Screen frames from the client
  (`source: "screen"`) are dropped unless that session is sharing.
- Every call to the desktop agent and to Electron's screen capture goes through
  one gate, `createGatedAgentCaller`. Screen-content tools (`takeScreenshot`,
  `saveScreenshot`, `analyzeScreenshot`, `readScreen`, `viewScreen`,
  `locateText`, `clickText`, `waitForUi`) are refused unless a session is
  sharing. A capture still running when sharing stops (or restarts) is
  discarded, not returned.
- Proactive check-ins never take screenshots; they can only use frames from a
  share already in progress. "Look at my screen" without sharing captures
  nothing, and SIYA is told to ask the user to click Share screen.
- Closing the session ends sharing and clears the cached frame.

**Activity awareness**. A saved setting (`activityAwareness` in
`settings.json`), off unless the user turns it on in the Privacy Center.
`SIYA_ENABLE_DESKTOP_AWARENESS=false` keeps it off regardless.

- Off: desktop observation (`DesktopPerception`) is stopped,
  `fetchDesktopObservation` returns nothing, `getActiveWindow`,
  `listVisibleWindows` and `observeDesktopState` are refused, check-in prompts
  carry no app or window name, the remembered app/window are cleared, and
  window titles, app names and similar fields are removed from every
  desktop-tool result before the model sees it (`redactActivity`).
- On: the active app name and window title can be sent with proactive
  check-ins and returned by those tools.
- A shared screen still shows whatever is on it, including window titles in
  the picture itself.

## Desktop app, Gemini mode (default)

| Data | When | Sent to | Code |
| --- | --- | --- | --- |
| Microphone audio (16 kHz PCM) | While a voice session is open | Google Gemini Live | `server/index.ts` (`msg.audio`) |
| Typed messages, SIYA's replies | Every turn | Google Gemini Live | `server/index.ts` |
| **Camera still**: JPEG, max 480 px | Every 2.5 s while the camera is on and a session is connected | Google Gemini Live | `src/components/MainExperience.tsx` (`sendCameraFrame`), `server/index.ts` (`msg.type === "video"`, `source: "camera"`) |
| **Facial-expression label**, **behaviour state and cues** | With camera stills; turned into model prompts when they change | Google Gemini Live, as text | `src/vision/*`, `server/index.ts` |
| **Screen frames**: JPEG, max 720 px, every 2.5 s when the screen changes (30 s heartbeat) | Only while Share screen is on | Google Gemini Live | `MainExperience.tsx`, `server/index.ts` |
| **Screenshots and screen text** from the tools above | Only while Share screen is on | Google Gemini Live | `server/privacyControls.ts`, `server/screenVision.ts` |
| **Active app name and window title** | Only with Activity awareness on | Google Gemini Live, as text | `server/cognition/desktopPerception.ts`, `server/index.ts` (`buildInitiativePrompt`) |
| Last ≤ 12 dialogue turns and **up to 30 memories most related to them** (all memories if there are 30 or fewer) | After turns, to consolidate memories | Google Gemini (`generateContent`) | `server/memory.ts` (`selectMemoriesForConsolidation`, `processConversationSlice`) |
| A few relevant memories | At session start | Google Gemini Live (system prompt) | `server/index.ts` |
| Goal objective, constraints, success criteria | When a goal is planned | Google Gemini (`generateContent`) | `server/cognition/planner.ts` |
| **What the user says or types** (turns ≥ 12 characters, first 2,000) | After each turn, only if `TYPESAFE_API_KEY` is set and `SIYA_TEXT_EMOTION` is not `off` | TypeSafe (`api.typesafe.ai`) | `server/textEmotion.ts` |

Whether Google may use this data depends on the user's Gemini plan; on the
free tier it may be used to improve Google's products.

## Desktop app, local mode (`SIYA_BRAIN=local`)

Conversation, camera and shared-screen frames go to `SIYA_LOCAL_LLM_URL`
(default `127.0.0.1`), voice to `SIYA_VOICE_URL` (default `127.0.0.1`). Text
emotion and memory consolidation are skipped. Local mode is **not** fully
local while any of these apply, and the consent screen lists each one that
does (`externalInLocalMode`):

| Data | When | Sent to |
| --- | --- | --- |
| Conversation, camera and screen frames | `SIYA_LOCAL_LLM_URL` is not a loopback address | That model server |
| Voice audio | `SIYA_VOICE_URL` is not a loopback address | That voice server |
| SIYA's reply text | Default `SIYA_TTS_ENGINE=edge` (better Hindi) | Microsoft Edge read-aloud service (`services/local_voice/server.py`) |
| Goal objective etc. | A goal is planned and a Gemini key is saved | Google Gemini |

`SIYA_TTS_ENGINE=kokoro` keeps speech synthesis on the device.

## Tool calls (either mode, when SIYA uses the tool)

| Data | Sent to | Code |
| --- | --- | --- |
| Latitude and longitude | Open-Meteo (weather) | `server/api-hub/builtInAdapters.ts` |
| Currency codes | Frankfurter (exchange rates) | `server/api-hub/builtInAdapters.ts` |
| Nothing user-specific | The Space Devs (launches); GitHub (public-APIs catalogue download) | `server/api-hub/` |
| Search query | YouTube (`/api/youtube-search`) | `server/index.ts` |
| Requested URL | That website (`/api/proxy`, web proxy) | `server/index.ts` |
| Search query or URL | Opened in the user's browser | `services/desktop_agent/tools_websites.py` |
| Fixed gesture prompts (no user data) | Motion service, only if `SIYA_MOTION_SERVICE_URL` is set | `src/character/characterEngine.ts` |

## Mobile app

The Android app talks to Gemini directly from the phone with the user's key,
which is entered on the phone and never compiled into the app.

| Data | When | Sent to | Code |
| --- | --- | --- | --- |
| Microphone audio, typed messages | During a session | Google Gemini Live | `mobile/app/mobileLiveSession.ts` |
| Camera still (JPEG) | Every 5 s while the camera is on | Google Gemini Live | `mobile/app/mobileLiveSession.ts` |
| Memory cards, profile facts, recall queries (the user's words) | When SIYA saves or recalls memories | The owner's memory gateway (`VITE_SIYA_MEMORY_URL`) over the tailnet, then the self-hosted memory server | `mobile/app/memoryClient.ts`, `services/memory_gateway/` |
| Currency codes | Currency tool | Frankfurter | `mobile/app/mobileLiveSession.ts` |

The phone holds **no memory-server credential**. The gateway identifies it
by its Tailscale device identity and adds the server's token on the server.
`vite.mobile.config.ts` refuses to build if any `VITE_*` variable looks like a
credential.

## Processed only on the device

- Facial landmarks and blendshapes, hand landmarks (MediaPipe, WASM). Only the
  resulting labels leave the device, as listed above.
- Crisis-language detection (`server/safety.ts`).
- OCR (Tesseract, desktop agent), but its text reaches the model while Share
  screen is on.
- Voice activity detection and Kokoro speech synthesis (local mode).

## Stored on the device

Location: `SIYA_DATA_DIR` (Electron `userData` when packaged). The backend
runs with umask `077` (`server/privateUmask.ts`), so files and folders it
creates are readable only by the user's account; files rewritten in place
(`memories.json`, logs) are also set to `0600` when written, and the data,
logs and cognition folders to `0700` at startup. Files the backend has not
written since this change keep their earlier permissions. The desktop agent
keeps the user's normal umask, because files it creates (documents, saved
screenshots) belong to the user.

| File | Contents | Encrypted |
| --- | --- | --- |
| `memories.json`, `cognition/memories.v1.json` | Long-term memories | Yes, when a data key is present (AES-256-GCM, key in OS keyring) |
| `cognition/goals.v1.json` | Goals | Same as above |
| `cognition/last-session.json` | Notes from the last session | Same as above |
| `cognition/skills.v1.json` | Learned skills: tool steps with their arguments (can include file names or text to type) | No |
| `settings.json` | Settings (including `activityAwareness`), consent record | No |
| `secrets.json` | Gemini API key | No; file mode `0600` |
| `logs/commands.log` | Tool names and argument **names**, settings changes, screen-share on/off, crisis-card events | No |
| `logs/errors.log`, `logs/startup.log` | Errors (can include file names or short agent responses), startup events | No |
| `logs/cognition.log` | Timeline of internal events (event types, attention scores, decisions). Written **only** with `SIYA_COGNITION_DEBUG=true`, capped at 5 MB with one previous file kept | No |
| `api-hub/*.json` | Public API catalogue and adapters | No (not personal) |

Not stored: camera images, microphone audio, conversation transcripts (the
dialogue history is in memory only). Screenshots are written to disk only by
the `saveScreenshot` tool, and only while Share screen is on.

**Delete all my data** (`POST /api/privacy/delete-all`) erases memories,
goals, last-session notes and learned skills, truncates every log and resets
consent. It keeps settings, the Gemini key and the API-hub catalogue. It
cannot delete anything already sent to Google, TypeSafe or Microsoft, or
memories stored on the mobile app's memory server.
