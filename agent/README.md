# SIYA desktop agent — recovery notes

Recovered from `resources/agent/siya-agent.exe` (a PyInstaller onedir build, Python 3.12,
x86-64 Windows) via `pyinstxtractor-ng` extraction + `pycdc` (zrax/pycdc, built from source
with 3.12 opcode support) decompilation. Unlike the backend (`../server.ts` etc., recovered
verbatim from an embedded sourcemap), there is **no sourcemap equivalent for compiled Python** —
everything here is decompiled bytecode, not original source. Docstrings, comments, imports,
and most control flow came back faithfully; a handful of Python-3.12-only opcodes
(`POP_JUMP_IF_NONE`, `MAKE_CELL`, `LOAD_FAST_AND_CLEAR`, `CLEANUP_THROW` — mostly from
walrus operators / structural pattern matching / exception-group handling) aren't yet
supported by pycdc and truncate a minority of function bodies.

First-party package layout (confirmed via PYZ extraction — `desktop_agent` is not a known
PyPI package name, everything else in the PYZ was stdlib or a known third-party dependency):

- `run_agent.py` — entry point
- `desktop_agent/__init__.py`, `main.py`, `perception.py`, `registry.py`
- `desktop_agent/tools_*.py` — 15 tool modules: applications, clipboard, coding, confirmation,
  files, input, pc, screenshot, search, startup, system, targeting, websites, windows

## Recovery status per file

Each `.py` file has a header comment stating its status:
- **CLEAN** — no unsupported-opcode markers (`__init__`, `run_agent`, `tools_search`, `tools_startup`)
- **MOSTLY CLEAN** — 1-4 gaps (`main`, `registry`, `tools_applications`, `tools_clipboard`,
  `tools_coding`, `tools_confirmation`, `tools_files`, `tools_system`, `tools_websites`, `tools_windows`)
- **PARTIAL** — 5+ gaps, real code but some function bodies truncate at
  `# WARNING: Decompyle incomplete` (`perception`, `tools_input`, `tools_pc`, `tools_targeting`)

`tools_screenshot.py` is a special case: pycdc **segfaults** on the whole module (a control-flow
edge case, not just an unsupported opcode), even after isolating each function into its own
standalone code object for separate decompilation (every one independently hit a different
unsupported opcode). What's recovered there is a **stub**: real module/function docstrings and
signatures pulled directly via `marshal`/introspection on the bytecode's constant pool (these are
verbatim from the original code, not inferred), with `...` in place of unrecoverable function
bodies. Screenshot capture uses GDI/mss for region capture, pytesseract for OCR, and has an
explicit `view_screen()` used for SIYA's screen-vision feature — see the docstrings in that file
for the exact original design notes. Raw pycdas disassembly is kept at `_disassembly/tools_screenshot.dis`
for anyone who wants to hand-reconstruct the remaining bodies from bytecode.

## What this confirms about the agent

It's a local desktop-automation/perception companion process for SIYA, exposing tools over
(likely) the `registry.py` tool-registration system to the Node backend (`../server.ts` spawns
it as a child process per `../electron/main.cjs`'s comments). Capabilities: screenshot + OCR
(Tesseract via pytesseract), clipboard, file operations, keyboard/mouse input (pyautogui/pywinauto),
window management (pygetwindow), system/PC info (psutil, wmi, pycaw for audio), startup/app
launching, and web search/site tools — consistent with `desktopPerception.ts` and
`server_screenVision.ts` already recovered on the backend side.

## Not attempted here

Third-party dependency source (click, pydantic, websockets, fastapi, pyautogui, mss, pytesseract,
etc.) — those are public PyPI packages, just `pip install` them per the versions seen in
`_internal/*.dist-info` (click 8.5.0, pydantic 2.13.5, websockets 17.1) rather than decompiling.
