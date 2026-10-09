"""
Coding assistance: create code files, run Python scripts, scaffold projects.

  createPythonFile    -> write a .py file (uses createFile semantics w/ safety)
  writeCodeFile       -> write an arbitrary-language file with proper extension
  createProjectFolder -> make a folder structure (with optional subfolders)
  runPythonScript     -> execute a .py file with the known-good interpreter,
                         capturing stdout/stderr and exit code.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List

from .registry import ToolError, register
from .tools_files import _resolve_file, _ensure_safe, _resolve_folder


@register("createPythonFile")
def create_python_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content", "")
    overwrite = bool(args.get("overwrite", False))
    p = _resolve_file(path)
    if p.suffix != ".py":
        p = p.with_suffix(".py")
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    if p.exists() and not overwrite:
        raise ToolError(f"File already exists: {p}. Pass overwrite=true to replace it.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content), encoding="utf-8")
    return {"result": f"Created Python file: {p}", "path": str(p)}


@register("writeCodeFile")
def write_code_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content", "")
    overwrite = bool(args.get("overwrite", False))
    p = _resolve_file(path)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    if p.exists() and not overwrite:
        raise ToolError(f"File already exists: {p}. Pass overwrite=true to replace it.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content), encoding="utf-8")
    return {"result": f"Wrote code file: {p}", "path": str(p)}


@register("createProjectFolder")
def create_project_folder(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path") or args.get("name")
    if not path:
        raise ToolError("Parameter 'path' or 'name' is required.")
    if args.get("under"):
        root = _resolve_folder(args.get("under")) / Path(str(path)).name
    else:
        root = _resolve_file(str(path))
    _ensure_safe(root, bool(args.get("allow_anywhere", False)))
    root.mkdir(parents=True, exist_ok=True)
    subfolders: List[str] = args.get("subfolders") or []
    created = [str(root)]
    for sub in subfolders:
        sub_path = root / str(sub)
        sub_path.mkdir(parents=True, exist_ok=True)
        created.append(str(sub_path))
    return {"result": f"Created project folder: {root} ({len(subfolders)} subfolder(s)).", "path": str(root), "created": created}


@register("runPythonScript")
def run_python_script(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    p = _resolve_file(path, must_exist=True)
    _ensure_safe(p, bool(args.get("allow_anywhere", False)))
    if p.suffix != ".py":
        raise ToolError(f"Not a Python file: {p}")
    script_args = args.get("args") or []
    timeout = min(120, float(args.get("timeout", 30)))
    try:
        proc = subprocess.run(
            [sys.executable, str(p), *[str(a) for a in script_args]],
            capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise ToolError(f"Script timed out after {timeout}s: {p}")
    stdout = proc.stdout[-4000:]
    stderr = proc.stderr[-2000:]
    return {
        "result": f"Ran {p.name}, exit code {proc.returncode}.",
        "exit_code": proc.returncode,
        "stdout": stdout,
        "stderr": stderr,
    }


__all__ = ["create_python_file", "write_code_file", "create_project_folder", "run_python_script"]
