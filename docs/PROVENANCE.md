# Source provenance

Where each part of SIYA's code came from, for the research paper. It
distinguishes code recovered from the author's own earlier build, code
reconstructed by inference, code modified after recovery, code written after
recovery, and third-party components.

Reference point: tag `paper-baseline-2026-10-09` (commit `4ce93df`). Change
counts are from git (`+added / -removed` lines). Where git cannot tell us
something, the row says **to confirm** and the author must fill it in.

## How SIYA was recovered

The repository begins at commit `b2e11ae` (2026-09-24), a snapshot taken
after the code had been recovered from the author's own installer,
`SIYA-Setup-1.0.1.exe`. Three different methods were used:

1. **Backend (TypeScript): recovered verbatim from a sourcemap** embedded in
   the installer's server bundle. Sourcemaps carry the original source text,
   so these files are the original code, not an approximation.
2. **Frontend (React/TypeScript): de-minified** from the installer's
   minified Vite bundle, which had no sourcemap. Structure and behaviour were
   preserved; top-level names were restored by hand, and local variable names
   inside functions are still the minifier's (e.g. `L`, `b`, `$t`).
3. **Desktop agent (Python): decompiled** from a PyInstaller build of the
   original Windows agent using `pyinstxtractor-ng` and `pycdc`. Several
   function bodies could not be decompiled. The agent in this repository is a
   Linux/Hyprland **port** of that Windows agent with the same tool surface,
   not the decompiled code itself.

The first commit also kept verbatim copies of four recovered files
(`docs/originals/`, removed later but still in git history at `b2e11ae`).
Those give an exact before/after for the most-changed files.

The original installer and its extracted sourcemap are not in this
repository or on the development machine. **To confirm:** whether the author
still holds them; they are the strongest evidence for category 1.

## 1. Recovered from the original build via sourcemap

The original `server.ts` imported exactly these modules, which fixes the
original backend module set.

| File (now) | Original name | Lines | Change since recovery |
| --- | --- | --- | --- |
| `server/index.ts` | `server.ts` | 3,844 | **+442 / -500** vs the verbatim original (heavily modified) |
| `server/memory.ts` | `server_memory.ts` | 245 | +8 / -5 since first commit |
| `server/paths.ts` | `server_paths.ts` | 97 | none recorded |
| `server/screenVision.ts` | `server_screenVision.ts` | 277 | none recorded |
| `server/cognition/*.ts` (22 files, excluding `index.ts`, `types.ts`) | `cognition/` | 3,417 | `structuredMemory.ts` +17/-2, `goalManager.ts` +15/-2 (encryption), `runtime.ts` +2/-1; others none recorded |
| `server/api-hub/*.ts` (7 files, excluding `index.ts`, `types.ts`) | `api_hub/` | 1,027 | none recorded |

`server_health.ts` was also original. It was removed with the smartwatch
feature after the baseline.

"None recorded" means no change since the first commit. Changes made between
recovery and the first commit cannot be seen in git.

## 2. Reconstructed by inference

These were imported by recovered code but were not in the sourcemap (type-only
and re-export files are erased by the bundler). They were rebuilt from how the
rest of the code uses them, and each file says so in its header.

| File | Basis |
| --- | --- |
| `server/cognition/index.ts` | Re-exports inferred from `server.ts` imports |
| `server/cognition/types.ts` | Types inferred from usage across `cognition/` |
| `server/api-hub/index.ts` | Re-exports inferred from `server.ts` imports |
| `server/api-hub/types.ts` | Types inferred from usage across `api_hub/` |
| `shared/memoryTypes.ts` | `Memory` type; its category list is copied from the Gemini schema in `server/memory.ts` |

## 3. Recovered by de-minifying the original UI bundle

Each file says so in its header.

| File | Lines | Change since recovery |
| --- | --- | --- |
| `src/character/characterEngine.ts` | 4,787 | **+152 / -36** vs verbatim original |
| `src/components/MainExperience.tsx` | 1,349 | +212 / -191 since first commit |
| `src/components/SettingsPanel.tsx` | 879 | +39 / -15 since first commit |
| `src/character/CharacterStage.tsx` | 632 | **+138 / -19** vs verbatim original |
| `src/api/liveSession.ts` | 618 | **+133 / -22** vs verbatim original |
| `src/components/MemoriesPanel.tsx` | 437 | +7 / -5 since first commit |
| `src/App.tsx` | 191 | none recorded |
| `src/settings/wakeWordListener.ts` | 182 | none recorded |
| `src/index.css` | 89 | +74 / -0 since first commit (new "Dusk" skin) |
| `src/settings/settingsStore.ts` | 67 | +2 / -0 since first commit |
| `src/main.tsx` | 30 | +12 / -1 since first commit |

## 4. Ported from the decompiled Windows agent

`services/desktop_agent/` (19 Python files, 2,239 lines). A Linux
rewrite of the decompiled Windows agent's tool surface and confirmation flow.
`_linux.py` (Hyprland/`hyprctl` helpers) has no Windows counterpart. **To
confirm:** which modules were rewritten from scratch and which were adapted
from the decompiled code.

## 5. Written after recovery

Added in this repository's history after the first commit:

| File | Purpose |
| --- | --- |
| `server/safety.ts` | Crisis-language safety net |
| `server/secureStore.ts` | AES-256-GCM encryption at rest |
| `server/textEmotion.ts` | Optional TypeSafe text-emotion reading |
| `src/vision/behaviorAnalyzer.ts` | Behaviour and gesture analysis |
| `src/character/siyaCharacter.ts`, `src/character/vrmModelSource.ts` | SIYA's own VRM avatar |
| `src/components/ConsentGate.tsx`, `PrivacyCenter.tsx`, `SafetyCard.tsx` | Consent, privacy and crisis UI |
| `src/components/DataDisclosure.tsx`, `docs/DATA_FLOWS.md` | Data-flow disclosure (after the baseline) |
| `.github/workflows/ci.yml`, docs, repository restructure | Engineering |

## 6. Present at the first commit, no recovery marker

These were already in the snapshot but carry no header saying they were
recovered. Git cannot tell whether they came from the installer or were written
between recovery and the first commit. **To confirm each:**

| File(s) | Notes |
| --- | --- |
| `server/localLive.ts`, `services/local_voice/server.py` | First commit message calls these the "optional offline brain", added before the snapshot; likely written after recovery |
| `server/liveAudio.ts` | Not imported by the original `server.ts`, so added after recovery |
| `src/vision/emotionDetector.ts` | Facial emotion classifier (+32 / -12 since first commit) |
| `src/character/kimodoRetarget.ts` | Retargeting for the optional Kimodo motion service |
| `shared/runtime/avatarEvents.js`, `speechTimeline.js` | Avatar event bus and lip-sync timing |
| `mobile/app/*`, `mobile/android/*`, `mobile/*.sh` | Mobile app; `MobileApp.tsx` +378 / -209 since first commit |
| `electron/*` | Desktop shell. In an unpacked (`asar: false`) installer these ship as plain JS, so they may be original |
| `tests/*.test.mjs` | Test suites |

## Third-party components

| Component | Where | Licence |
| --- | --- | --- |
| MediaPipe Tasks Vision WASM runtime | `public/mediapipe/wasm/` | Apache-2.0 (Google) |
| Face Landmarker, Hand Landmarker models | `public/models/*.task` | Apache-2.0 (Google) |
| npm dependencies (React, Three.js, Express, `ws`, `@google/genai`, `mmd-parser`, `motion`, `lucide-react`, Vite, Tailwind, Electron, …) | `package.json`, `package-lock.json` | Each package's own licence |
| Python dependencies (FastAPI, uvicorn, pydantic, psutil, Pillow, pytesseract, send2trash, numpy, onnxruntime, …) | `services/*/requirements.txt` | Each package's own licence |
| Silero VAD, Kokoro TTS models | Downloaded to `services/local_voice/models/`, not in git | MIT (Silero), Apache-2.0 (Kokoro) |
| Edge TTS (`edge-tts`) | Local voice service | Unofficial client for a Microsoft service |
| Tesseract OCR | System dependency | Apache-2.0 |
| Google Gemini, TypeSafe | Remote services | Their terms of service |

## Assets

| Asset | Origin |
| --- | --- |
| `public/assets/characters/siya/SIYA.vrm` | Created by the author in VRoid Studio; the source project (`model.vroid`) is kept outside the repository |
| `public/assets/brand/*.png`, `docs/images/siya-logo-rounded.png` | **To confirm:** who made the logo and how |
| `docs/images/siya-robot-concept.png` | **To confirm:** how the concept render was made (e.g. an image-generation tool) |

## AI assistance

- All 27 commits up to the baseline carry a `Co-Authored-By: Claude` trailer:
  recovery, porting, new features and documentation were done with Claude
  Code. The paper should disclose this.
- The original recovered `server.ts` sends `User-Agent: aistudio-build` on its
  Gemini calls (still present in `server/index.ts` and `server/memory.ts`).
  This suggests the original application began from a Google AI Studio "Build"
  app. **To confirm:** how the original application was created.
