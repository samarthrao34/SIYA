"""
File management: create / read / rename / delete / move / open / search.

Safety model:
  * All paths are resolved with expanduser and normalized to absolute.
  * Deletion sends files/folders to the trash via `send2trash` when
    available (preferred), and otherwise refuses to delete rather than
    permanently removing data.
  * Operations are confined to a set of SAFE_ROOTS by default; paths that
    escape these roots (e.g. /etc) are rejected unless explicitly marked
    allow_anywhere by the caller.
"""
from __future__ import annotations

import fnmatch
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import ToolError, register

HOME = Path(os.path.expanduser("~"))
SAFE_ROOTS: List[Path] = [
    HOME,
    HOME / "Desktop",
    HOME / "Documents",
    HOME / "Downloads",
    HOME / "Pictures",
    HOME / "Music",
    HOME / "Videos",
    Path(os.getcwd()),
]
FOLDER_ALIASES: Dict[str, Path] = {
    "desktop": HOME / "Desktop",
    "documents": HOME / "Documents",
    "downloads": HOME / "Downloads",
    "pictures": HOME / "Pictures",
    "photos": HOME / "Pictures",
    "music": HOME / "Music",
    "videos": HOME / "Videos",
    "home": HOME,
}


def _resolve_folder(name_or_path) -> Path:
    if not name_or_path:
        raise ToolError("Parameter 'name' or 'path' is required.")
    key = str(name_or_path).strip().lower()
    if key in FOLDER_ALIASES:
        return FOLDER_ALIASES[key]
    return Path(os.path.expandvars(os.path.expanduser(str(name_or_path)))).resolve()


def _resolve_file(path, *, must_exist: bool = False) -> Path:
    if not path:
        raise ToolError("Parameter 'path' is required.")
    p = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    if must_exist and not p.exists():
        raise ToolError(f"File does not exist: {p}")
    return p


def _ensure_safe(p: Path, allow_anywhere: bool = False) -> None:
    if allow_anywhere:
        return
    real = str(p)
    for root in SAFE_ROOTS:
        try:
            root_real = str(root.resolve())
        except OSError:
            continue
        if real == root_real or real.startswith(root_real + os.sep):
            return
    raise ToolError(
        f"Path '{p}' is outside SIYA's safe folders (Desktop, Documents, Downloads, "
        f"Pictures, Music, Videos, home, and the project folder). Pass allow_anywhere=true "
        f"only if you really mean it."
    )


@register("createFile")
def create_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content", "")
    overwrite = bool(args.get("overwrite", False))
    p = _resolve_file(path)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    if p.exists() and not overwrite:
        raise ToolError(f"File already exists: {p}. Pass overwrite=true to replace it.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content), encoding="utf-8")
    return {"result": f"Created file: {p}", "path": str(p)}


@register("readFile")
def read_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    max_chars = int(args.get("max_chars", 8000))
    p = _resolve_file(path, must_exist=True)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except (UnicodeDecodeError, IsADirectoryError) as e:
        raise ToolError(f"Could not read file as text: {e}")
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n…[truncated, {len(text) - max_chars} more chars]"
    return {"result": text, "path": str(p)}


@register("renameFile")
def rename_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    new_name = args.get("new_name")
    if not new_name:
        raise ToolError("Parameter 'new_name' is required.")
    p = _resolve_file(path, must_exist=True)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    target = (p.parent / str(new_name)).resolve()
    _ensure_safe(target, bool(args.get("allow_anywhere", False)))
    if target.exists():
        raise ToolError(f"A file already exists at the target name: {target}")
    p.rename(target)
    return {"result": f"Renamed {p.name} -> {target.name}", "path": str(target)}


@register("deleteFile")
def delete_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    permanent = bool(args.get("permanent", False))
    p = _resolve_file(path, must_exist=True)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    if permanent:
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        return {"result": f"Permanently deleted: {p}"}
    try:
        import send2trash
        send2trash.send2trash(str(p))
        return {"result": f"Moved to trash: {p}"}
    except ImportError:
        raise ToolError("Safe deletion requires the 'send2trash' package. Install it or pass permanent=true (use with care).")
    except Exception as e:
        raise ToolError(f"Could not move to trash: {e}")


@register("moveFile")
def move_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    destination = args.get("destination")
    p = _resolve_file(path, must_exist=True)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    dest = Path(os.path.expandvars(os.path.expanduser(str(destination)))).resolve()
    if dest.is_dir():
        dest = dest / p.name
    _ensure_safe(dest, bool(args.get("allow_anywhere", False)))
    if dest.exists():
        raise ToolError(f"Destination already exists: {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    p.rename(dest)
    return {"result": f"Moved {p.name} -> {dest}", "path": str(dest)}


@register("openFolder")
def open_folder(args: Dict[str, Any]) -> Dict[str, Any]:
    folder = _resolve_folder(args.get("name") or args.get("path"))
    if not folder.exists():
        raise ToolError(f"Folder does not exist: {folder}")
    subprocess.Popen(["xdg-open", str(folder)], close_fds=True)
    return {"result": f"Opened folder: {folder}", "path": str(folder)}


@register("listFiles")
def list_files(args: Dict[str, Any]) -> Dict[str, Any]:
    folder = _resolve_folder(args.get("name") or args.get("path"))
    if not folder.exists():
        raise ToolError(f"Folder does not exist: {folder}")
    pattern = str(args.get("pattern") or "*")
    limit = int(args.get("limit", 200))
    entries = []
    for entry in sorted(folder.iterdir()):
        if fnmatch.fnmatch(entry.name.lower(), pattern.lower()):
            entries.append({"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)})
        if len(entries) >= limit:
            break
    return {"result": f"Found {len(entries)} entries matching '{pattern}' in {folder}", "entries": entries, "count": len(entries)}


@register("searchFiles")
def search_files(args: Dict[str, Any]) -> Dict[str, Any]:
    folder = _resolve_folder(args.get("folder") or args.get("under") or "home")
    name = args.get("name") or args.get("pattern")
    extension = args.get("extension")
    limit = int(args.get("limit", 100))
    if extension:
        extension = str(extension)
        if not extension.startswith("."):
            extension = "." + extension
        pattern = "*" + extension
    elif name:
        pattern = str(name)
    else:
        raise ToolError("Provide 'name' glob or 'extension'.")
    if not folder.exists():
        raise ToolError(f"Folder does not exist: {folder}")
    matches: List[str] = []
    for root, _dirs, files in os.walk(folder):
        for fname in files:
            if fnmatch.fnmatch(fname.lower(), pattern.lower()):
                matches.append(os.path.join(root, fname))
                if len(matches) >= limit:
                    break
        if len(matches) >= limit:
            break
    return {"result": f"Found {len(matches)} file(s) matching '{pattern}' under {folder}", "matches": matches, "count": len(matches)}


__all__ = ["create_file", "read_file", "rename_file", "delete_file", "move_file", "open_folder", "list_files", "search_files"]
