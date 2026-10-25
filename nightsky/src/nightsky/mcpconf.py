"""Cursor MCP config for the Bright Data local server.

The API token is referenced from the environment. It is not written into the file.
"""

from __future__ import annotations

import json
from pathlib import Path

from nightsky.paths import ROOT

SERVER = {
    "command": "npx",
    "args": ["-y", "@brightdata/mcp"],
    "env": {
        "API_TOKEN": "${env:BRIGHTDATA_API_TOKEN}",
        "GROUPS": "advanced_scraping",
        "WEB_UNLOCKER_ZONE": "mcp_unlocker",
    },
}


def project_config_path() -> Path:
    return ROOT / ".cursor" / "mcp.json"


def user_config_path() -> Path:
    return Path.home() / ".cursor" / "mcp.json"


def write_config(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict = {}
    if path.exists():
        existing = json.loads(path.read_text() or "{}")
    servers = existing.setdefault("mcpServers", {})
    servers["brightdata"] = SERVER
    path.write_text(json.dumps(existing, indent=2) + "\n")
    return path


def install_configs() -> list[Path]:
    return [write_config(project_config_path()), write_config(user_config_path())]
