# Reliability fixes and desktop releases

The app now applies the selected microphone, preserves text-only mode when
changing voice, waits for settings saves before reconnecting, and reports save
failures. Settings writes are serialized. UI animations can be disabled; avatar
speech and expressions continue to work. The wake-word control is accurately
labelled as re-arm speed, since it adjusts the cooldown between activations.

Temporary connection failures retry up to five times with exponential backoff.
Manual disconnect cancels retries. Only unsent text is retained; sent messages
and interrupted tool actions are not replayed. Reconnection opens a new live
session using the existing persistent memory; it does not resume the previous
Gemini audio stream.

Closing the desktop window hides it when a tray icon was created successfully.
Use the tray menu to show Siya, check for updates, or quit. Window placement and
maximized state persist, with off-screen positions discarded when a monitor is
removed.

## Motion

Local procedural gestures are the default and require no external motion
server. Optional generated motion can be enabled by setting
`SIYA_MOTION_SERVICE_URL` before starting the app. An unavailable server leaves
procedural motion working, with a one-minute delay between failed retries.
This does not bundle a generative motion model.

## Checks

```sh
npm test
npm run typecheck   # server, desktop UI and mobile app
npm run build
```

## Updates and packaging

`npm run package` builds a local package without publishing it. The Linux target
is AppImage; Windows uses NSIS and macOS uses DMG/ZIP. The Python desktop agent
still requires its Python dependencies on the target machine. This change does
not bundle a Python interpreter.

To enable automatic updates, set `SIYA_UPDATE_URL` to the real HTTPS directory
hosting Siya releases **when packaging**. The builder generates the updater
configuration and release metadata. Upload the matching platform packages,
metadata, and blockmaps to that directory. macOS distribution additionally
requires signing/notarization credentials. No releases are uploaded by the
package script.

Packaged builds with an update source check after startup and every six hours,
download available updates, and offer a restart to install. Installation waits
for the user's choice. The tray also provides a manual check. Development
builds and packages without a source explain why updating is unavailable.

An actual release source and published newer version are needed to verify the
download/install lifecycle end to end. No update source is configured in this
repository yet.
