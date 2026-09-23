# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_files.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_files.pyc (Python 3.12)

'''
File management: create / read / rename / delete / move / open / search.

Safety model:
  * All paths are resolved with expanduser and normalized to absolute.
  * Deletion sends files/folders to the Recycle Bin via `send2trash` when
    available (preferred), and otherwise refuses to delete rather than
    permanently removing data.
  * Operations are confined to a set of SAFE_ROOTS by default; paths that
    escape these roots (e.g. C:\\Windows) are rejected unless explicitly
    marked `allow_anywhere` by the caller.
'''
from __future__ import annotations
import fnmatch
import os
import platform
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional
from registry import ToolError, register
HOME = Path(os.path.expanduser('~'))
SAFE_ROOTS: 'List[Path]' = [
    HOME,
    HOME / 'Desktop',
    HOME / 'Documents',
    HOME / 'Downloads',
    HOME / 'Pictures',
    HOME / 'Music',
    HOME / 'Videos',
    Path(os.getcwd())]
FOLDER_ALIASES: 'Dict[str, Path]' = {
    'desktop': HOME / 'Desktop',
    'documents': HOME / 'Documents',
    'downloads': HOME / 'Downloads',
    'pictures': HOME / 'Pictures',
    'photos': HOME / 'Pictures',
    'music': HOME / 'Music',
    'videos': HOME / 'Videos',
    'home': HOME,
    'this pc': Path('C:\\'),
    'c drive': Path('C:\\') }

def _resolve_folder(name_or_path = None):
    if not name_or_path:
        raise ToolError("Parameter 'name' or 'path' is required.")
    key = str(name_or_path).strip().lower()
    if key in FOLDER_ALIASES:
        return FOLDER_ALIASES[key]
    p = None(os.path.expandvars(os.path.expanduser(str(name_or_path)))).resolve()
    return p


def _resolve_file(path = None, *, must_exist):
    if not path:
        raise ToolError("Parameter 'path' is required.")
    p = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    if not must_exist and p.exists():
        raise ToolError(f'''File does not exist: {p}''')
    return p


def _ensure_safe(p = None, allow_anywhere = None):
    if allow_anywhere:
        return None
    real = str(p)
    for root in SAFE_ROOTS:
        root_real = str(root.resolve())
        if not real == root_real and real.startswith(root_real + os.sep):
            continue
        SAFE_ROOTS
        return None
    raise ToolError(f'''Path \'{p}\' is outside SIYA\'s safe folders (Desktop, Documents, Downloads, Pictures, Music, Videos, home, and the project folder). Pass allow_anywhere=true only if you really mean it.''')
    except Exception:
        continue

create_file = (lambda args = None: path = args.get('path')content = args.get('content', '')overwrite = bool(args.get('overwrite', False))p = _resolve_file(path)_ensure_safe(p)if not p.exists() and overwrite:
raise ToolError(f'''File already exists: {p}. Pass overwrite=true to replace it.''')p.parent.mkdir(parents = True, exist_ok = True)p.write_text(str(content), encoding = 'utf-8'){
'result': f'''Created file: {p}''',
'path': str(p) })()
read_file = (lambda args = None: path = args.get('path')max_chars = int(args.get('max_chars', 8000))p = _resolve_file(path, must_exist = True)_ensure_safe(p)try:
text = p.read_text(encoding = 'utf-8', errors = 'replace')if len(text) > max_chars:
text = text[:max_chars] + f'''\n…[truncated, {len(text) - max_chars} more chars]'''{
'result': text,
'path': str(p) }except UnicodeDecodeError:
)()
rename_file = (lambda args = None: path = args.get('path')new_name = args.get('new_name')if not new_name:
raise ToolError("Parameter 'new_name' is required.")p = _resolve_file(path, must_exist = True)_ensure_safe(p)target = (p.parent / str(new_name)).resolve()_ensure_safe(target)if target.exists():
raise ToolError(f'''A file already exists at the target name: {target}''')p.rename(target){
'result': f'''Renamed {p.name} -> {target.name}''',
'path': str(target) })()
delete_file = (lambda args = None: path = args.get('path')permanent = bool(args.get('permanent', False))p = _resolve_file(path, must_exist = True)_ensure_safe(p)if permanent:
if p.is_dir():
import shutilshutil.rmtree(p)else:
p.unlink(){
'result': f'''Permanently deleted: {p}''' }try:
import send2trashsend2trash.send2trash(str(p)){
'result': f'''Moved to Recycle Bin: {p}''' }except ImportError:
raise ToolError("Safe deletion requires the 'send2trash' package. Install it or pass permanent=true (use with care).")except Exception:
e = Noneraise ToolError(f'''Could not move to Recycle Bin: {e}''')e = Nonedel e)()
move_file = (lambda args = None: path = args.get('path')destination = args.get('destination')p = _resolve_file(path, must_exist = True)_ensure_safe(p)dest = Path(os.path.expandvars(os.path.expanduser(str(destination)))).resolve()if dest.is_dir():
dest = dest / p.name_ensure_safe(dest)if dest.exists():
raise ToolError(f'''Destination already exists: {dest}''')dest.parent.mkdir(parents = True, exist_ok = True)p.rename(dest){
'result': f'''Moved {p.name} -> {dest}''',
'path': str(dest) })()
open_folder = (lambda args = None: if not args.get('name'):
args.get('name')folder = _resolve_folder(args.get('path'))if not folder.exists():
raise ToolError(f'''Folder does not exist: {folder}''')if platform.system() == 'Windows':
subprocess.Popen(f'''explorer "{folder}"''', shell = True, close_fds = True)elif platform.system() == 'Darwin':
subprocess.Popen([
'open',
str(folder)], close_fds = True)else:
subprocess.Popen([
'xdg-open',
str(folder)], close_fds = True){
'result': f'''Opened folder: {folder}''',
'path': str(folder) })()
list_files = (lambda args = None: if not args.get('name'):
args.get('name')folder = _resolve_folder(args.get('path'))if not folder.exists():
raise ToolError(f'''Folder does not exist: {folder}''')if not args.get('pattern'):
args.get('pattern')pattern = '*'# WARNING: Decompyle incomplete
)()
search_files = (lambda args = None: if not args.get('folder'):
args.get('folder')if not args.get('under'):
args.get('under')folder = _resolve_folder('home')if not args.get('name'):
args.get('name')name = args.get('pattern')extension = args.get('extension')limit = int(args.get('limit', 100))if extension:
if not str(extension).startswith('.'):
extension = '.' + str(extension)pattern = '*' + str(extension)elif name:
pattern = str(name)else:
raise ToolError("Provide 'name' glob or 'extension'.")if not folder.exists():
raise ToolError(f'''Folder does not exist: {folder}''')matches = []for root, _dirs, files in os.walk(folder):
for fname in files:
if not fnmatch.fnmatch(fname.lower(), pattern.lower()):
continuematches.append(os.path.join(root, fname))if not len(matches) >= limit:
continuefilesif not len(matches) >= limit:
continue{
'result': f'''Found {len(matches)} file(s) matching \'{pattern}\' under {folder}''',
'matches': matches,
'count': len(matches) })()
__all__ = [
    'create_file',
    'read_file',
    'rename_file',
    'delete_file',
    'move_file',
    'open_folder',
    'list_files',
    'search_files']
