# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_search.pyc (Python 3.12 bytecode).
# Status: CLEAN decompile (pycdc) — no unsupported-opcode markers, likely accurate

# Source Generated with Decompyle++
# File: tools_search.pyc (Python 3.12)

"""
Search commands: open a search results page for a query on a given engine.

These launch in the user's actual Windows default browser. In-page interaction
uses the native screen, mouse, and keyboard tools.
"""
from __future__ import annotations
from typing import Any, Dict
from registry import ToolError, register
from tools_websites import _build_search_url, open_url
search_web = (lambda args = None: if not args.get('query'):
args.get('query')query = args.get('q')if not args.get('engine'):
args.get('engine')engine = 'google'.strip().lower()if not query:
raise ToolError("Parameter 'query' is required.")url = _build_search_url(engine, str(query))resolved = open_url(url){
'result': f'''Searching {engine} for \'{query}\': opened {resolved}.''' })()
search_youtube = (lambda args = None: if not args.get('query'):
args.get('query')query = args.get('q')if not query:
raise ToolError("Parameter 'query' is required.")url = _build_search_url('youtube', str(query))resolved = open_url(url){
'result': f'''YouTube search for \'{query}\' opened at {resolved}.''' })()
search_google = (lambda args = None: if not args.get('query'):
args.get('query')query = args.get('q')if not query:
raise ToolError("Parameter 'query' is required.")url = _build_search_url('google', str(query))resolved = open_url(url){
'result': f'''Google search for \'{query}\' opened at {resolved}.''' })()
search_github = (lambda args = None: if not args.get('query'):
args.get('query')query = args.get('q')if not query:
raise ToolError("Parameter 'query' is required.")url = _build_search_url('github', str(query))resolved = open_url(url){
'result': f'''GitHub search for \'{query}\' opened at {resolved}.''' })()
__all__ = [
    'search_web',
    'search_youtube',
    'search_google',
    'search_github']
