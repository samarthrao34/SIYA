"""
Website control: open named sites or arbitrary URLs in the default browser.

Uses `xdg-open` (the Linux desktop-environment default-handler mechanism) so
the user's real default browser opens at the requested destination.
"""
from __future__ import annotations

import subprocess
from typing import Any, Dict
from urllib.parse import quote

from .registry import ToolError, register

NAMED_SITES: Dict[str, str] = {
    "youtube": "https://youtube.com",
    "google": "https://google.com",
    "github": "https://github.com",
    "gmail": "https://mail.google.com",
    "reddit": "https://reddit.com",
    "twitter": "https://twitter.com",
    "x": "https://twitter.com",
    "wikipedia": "https://wikipedia.org",
    "amazon": "https://amazon.com",
    "netflix": "https://netflix.com",
    "spotify": "https://open.spotify.com",
}

SEARCH_ENGINES: Dict[str, str] = {
    "google": "https://www.google.com/search?q={q}",
    "youtube": "https://www.youtube.com/results?search_query={q}",
    "github": "https://github.com/search?q={q}",
    "bing": "https://www.bing.com/search?q={q}",
    "duckduckgo": "https://duckduckgo.com/?q={q}",
}


def _build_search_url(engine: str, query: str) -> str:
    template = SEARCH_ENGINES.get(engine, SEARCH_ENGINES["google"])
    return template.format(q=quote(query))


def open_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        subprocess.Popen(["xdg-open", url], close_fds=True)
    except FileNotFoundError:
        raise ToolError("xdg-open is not available; cannot open a browser.")
    return url


@register("openWebsite")
def open_website(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("url")
    if not name:
        raise ToolError("Parameter 'name' or 'url' is required.")
    key = str(name).strip().lower()
    url = NAMED_SITES.get(key, str(name))
    resolved = open_url(url)
    return {"result": f"Opened website: {resolved}"}


__all__ = ["open_website", "open_url", "_build_search_url", "NAMED_SITES"]
