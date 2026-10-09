"""
Search commands: open a search results page for a query on a given engine.

These launch in the user's actual default browser. In-page interaction uses
the native screen, mouse, and keyboard tools.
"""
from __future__ import annotations

from typing import Any, Dict

from .registry import ToolError, register
from .tools_websites import _build_search_url, open_url


def _query(args: Dict[str, Any]) -> str:
    query = args.get("query") or args.get("q")
    if not query:
        raise ToolError("Parameter 'query' is required.")
    return str(query)


@register("searchWeb")
def search_web(args: Dict[str, Any]) -> Dict[str, Any]:
    query = _query(args)
    engine = str(args.get("engine") or "google").strip().lower()
    url = _build_search_url(engine, query)
    resolved = open_url(url)
    return {"result": f"Searching {engine} for '{query}': opened {resolved}."}


@register("searchYouTube")
def search_youtube(args: Dict[str, Any]) -> Dict[str, Any]:
    query = _query(args)
    url = _build_search_url("youtube", query)
    resolved = open_url(url)
    return {"result": f"YouTube search for '{query}' opened at {resolved}."}


@register("searchGoogle")
def search_google(args: Dict[str, Any]) -> Dict[str, Any]:
    query = _query(args)
    url = _build_search_url("google", query)
    resolved = open_url(url)
    return {"result": f"Google search for '{query}' opened at {resolved}."}


@register("searchGitHub")
def search_github(args: Dict[str, Any]) -> Dict[str, Any]:
    query = _query(args)
    url = _build_search_url("github", query)
    resolved = open_url(url)
    return {"result": f"GitHub search for '{query}' opened at {resolved}."}


__all__ = ["search_web", "search_youtube", "search_google", "search_github"]
