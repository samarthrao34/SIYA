# End-to-end privacy harness (manual)

Runs the real server bundle in an isolated Linux network and PID namespace
(loopback only, no internet, empty temporary data folder, no keys) against fake
downstream services, and checks what actually reaches the "model":

- `services.mjs`: fake local LLM (records every request and image, asks for a
  tool when told `RUN <tool>`), fake voice service, fake desktop agent.
- `launch_server.mjs`: forks `dist/server.cjs` with an IPC channel, playing
  Electron's main process and answering screen-capture requests.
- `client.mjs`: drives `/live` with synthetic camera and screen frames and
  Share screen on/off/in-flight transitions; prints PASS/FAIL per check.
- `consent.sh`: renders the consent screen headlessly in four configurations.

```sh
npm run build
unshare --kill-child -r -n -p -f --mount-proc bash tests/e2e-privacy/run.sh "$PWD" /tmp/siya-e2e agent
unshare --kill-child -r -n -p -f --mount-proc bash tests/e2e-privacy/consent.sh "$PWD" /tmp/siya-consent
```

Run it in a clean clone with no `.env`: the server loads `.env` from its
working directory, and the harness must never see real keys.

Needs user namespaces, `curl` and (for `consent.sh`) Chromium. It is not part
of `npm test`. On Linux the server never uses Electron's capture path (see
`captureViaElectron`), so the `ipc` mode exercises the same agent path.
